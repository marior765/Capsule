import { Directory, File, Paths } from "expo-file-system";
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
import type { ParameterSize, Quantization } from "@/shared/config";
import { generateId } from "@/shared/lib";

export type ModelDownloadSpec = {
  name: string;
  url: string;
  parameters: ParameterSize;
  quantization: Quantization;
};

/**
 * Downloads a GGUF model from a user-provided URL into the app's document
 * directory and records it locally. This is the one allowed network action —
 * user-initiated, isolated to this function.
 */
export async function downloadModel(
  db: SQLiteDatabase,
  spec: ModelDownloadSpec,
  onProgress?: (fraction: number) => void,
): Promise<Model> {
  const dir = new Directory(Paths.document, "models");
  if (!dir.exists) {
    dir.create();
  }

  const file = await File.downloadFileAsync(spec.url, dir);

  const model: Model = {
    id: generateId(),
    name: spec.name,
    path: file.uri,
    size: file.size,
    parameters: spec.parameters,
    quantization: spec.quantization,
    isActive: false,
    downloadedAt: Date.now(),
  };

  insertModel(db, model);
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

export function listModels(db: SQLiteDatabase): Model[] {
  return getAllModels(db);
}

export async function deleteModelById(
  db: SQLiteDatabase,
  id: string,
): Promise<void> {
  const model = getModelById(db, id);
  if (!model) return;

  try {
    new File(model.path).delete();
  } catch {
    // File may already be gone — proceed to remove the DB record regardless.
  }

  deleteModel(db, id);
}

export function selectModel(db: SQLiteDatabase, id: string): void {
  setActiveModel(db, id);
}
