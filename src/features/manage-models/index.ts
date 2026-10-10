import type { SQLiteDatabase } from "expo-sqlite";
import {
  deleteModel,
  getAllModels,
  getModelById,
  insertModel,
  setActiveModel,
  type Model,
} from "@/entities/model";
import { insertAuditEntry } from "@/entities/audit";
import { beginEgress } from "@/shared/egress";
import type { ParameterSize, Quantization } from "@/shared/config";
import {
  deleteAppFileIfExists,
  downloadFileInto,
  resolveAppPath,
  safeDecode,
} from "@/shared/fs";
import { generateId } from "@/shared/lib";

const MODELS_DIRECTORY = "models";

export type ModelDownloadSpec = {
  name: string;
  url: string;
  parameters: ParameterSize;
  quantization: Quantization;
  /**
   * Vision models only (8.4): URL of the matching multimodal projector
   * ("mmproj") file. Downloaded alongside the base model; the model is
   * only recorded once both files are on disk.
   */
  mmprojUrl?: string;
};

/**
 * Model files are stored by path RELATIVE to the document directory
 * (`models/<file>.gguf`), via `shared/fs` — iOS can move the app's data
 * container on an update or restore, which would leave an absolute
 * `file://` path pointing nowhere. Rows written before this change hold an
 * absolute path; this re-maps those onto the current document directory
 * (`models/<file>` keeps its name, only the container prefix changes).
 */
export function resolveModelPath(path: string): string {
  const relative = relativeModelPath(path);
  return relative === null ? path : resolveAppPath(relative);
}

/**
 * The app-relative form of a stored path, or null if it can't be
 * expressed. A legacy absolute URI keeps its `models/<file>` tail, with the
 * file name decoded (URIs are percent-encoded; relative paths are not).
 */
function relativeModelPath(path: string): string | null {
  if (!path.includes("://")) return path;
  const at = path.lastIndexOf(`/${MODELS_DIRECTORY}/`);
  if (at === -1) return null;
  return path
    .slice(at + 1)
    .split("/")
    .map(safeDecode)
    .join("/");
}

/**
 * Downloads a GGUF model (and, for a vision model, its projector) into the
 * app's document directory and records it locally. This is the one
 * allowed network action — user-initiated, isolated to this function.
 */
export async function downloadModel(
  db: SQLiteDatabase,
  spec: ModelDownloadSpec,
  onProgress?: (fraction: number) => void,
): Promise<Model> {
  // Marks the one real network call this app makes as "in flight" so
  // widgets/PrivacyBanner can show a live signal — must run before the
  // first await and end unconditionally (success or failure), or a failed
  // download would leave the indicator stuck showing "active" forever.
  const endEgress = beginEgress();
  try {
    return await downloadModelInternal(db, spec, onProgress);
  } finally {
    endEgress();
  }
}

async function downloadModelInternal(
  db: SQLiteDatabase,
  spec: ModelDownloadSpec,
  onProgress?: (fraction: number) => void,
): Promise<Model> {
  const base = await downloadFileInto(spec.url, [MODELS_DIRECTORY]);

  let mmproj: { relativePath: string; size: number } | null = null;
  if (spec.mmprojUrl) {
    try {
      mmproj = await downloadFileInto(spec.mmprojUrl, [MODELS_DIRECTORY]);
    } catch (error) {
      // A vision model without its projector is unusable as one — don't
      // leave half a model on disk or in the list.
      deleteAppFileIfExists(base.relativePath);
      throw error;
    }
  }

  const model: Model = {
    id: generateId(),
    name: spec.name,
    path: base.relativePath,
    // Both files load into memory together, so the combined size is what
    // matters for "will this fit on my phone" (ModelPicker's recommendation).
    size: base.size + (mmproj?.size ?? 0),
    parameters: spec.parameters,
    quantization: spec.quantization,
    isActive: false,
    downloadedAt: Date.now(),
    mmprojPath: mmproj?.relativePath ?? null,
  };

  try {
    insertModel(db, model);
  } catch (error) {
    // Recording failed after the bytes landed. Clean up only files no model
    // row uses: the most likely failure is the UNIQUE path constraint, i.e.
    // this download overwrote a file an existing (maybe active) model still
    // points at — deleting it would break that model. If the rows can't be
    // read at all, keep everything: an orphaned file is far less harmful.
    removeUnreferenced(db, [base.relativePath, mmproj?.relativePath ?? null]);
    throw error;
  }
  // Model download is one of the four actions CLAUDE.md's hard rule names
  // explicitly ("export, decrypt, wipe, model download") — the one allowed
  // network action in this app, so it's the one place that rule applies today.
  insertAuditEntry(db, {
    id: generateId(),
    action: "model_download",
    detail: spec.name,
    createdAt: model.downloadedAt,
  });
  onProgress?.(1);
  return model;
}

function removeUnreferenced(
  db: SQLiteDatabase,
  paths: (string | null)[],
): void {
  let inUse: Set<string>;
  try {
    inUse = new Set(
      getAllModels(db).flatMap((m) =>
        [m.path, m.mmprojPath]
          .filter((p): p is string => p !== null)
          .map((p) => relativeModelPath(p) ?? p),
      ),
    );
  } catch {
    return;
  }
  for (const path of paths) {
    if (path !== null && !inUse.has(path)) deleteAppFileIfExists(path);
  }
}

export function listModels(db: SQLiteDatabase): Model[] {
  return getAllModels(db);
}

export async function deleteModelById(
  db: SQLiteDatabase,
  id: string,
): Promise<void> {
  const model = getModelById(db, id);
  if (!model) return;

  for (const stored of [model.path, model.mmprojPath]) {
    if (stored === null) continue;
    const relative = relativeModelPath(stored);
    if (relative === null) continue;
    try {
      deleteAppFileIfExists(relative);
    } catch {
      // An unexpected stored value — remove the DB record regardless.
    }
  }

  deleteModel(db, id);
}

export function selectModel(db: SQLiteDatabase, id: string): void {
  setActiveModel(db, id);
}
