import type { SQLiteDatabase } from "expo-sqlite";
import { insertAuditEntry } from "@/entities/audit";
import { beginEgress } from "@/shared/egress";
import {
  appFileExists,
  deleteAppFileIfExists,
  downloadFileInto,
  resolveAppPath,
} from "@/shared/fs";
import { generateId } from "@/shared/lib";
import { getString, remove, setString } from "@/shared/storage";

/**
 * The dedicated embedding model for "chat with your capsules" (7.2), as
 * decided 2026-10-09: one small purpose-built GGUF, downloaded only when
 * the user asks — the same single-default-model shape as
 * `features/manage-stt-model`, not a multi-model picker.
 *
 * Differences from the STT manager, on purpose:
 * - the stored path is RELATIVE to the document directory (via
 *   `shared/fs`), so it survives iOS moving the app's container;
 * - the download is marked with `beginEgress`, so the privacy banner shows
 *   it like any other model download.
 *
 * Model choice (BGE small en v1.5, Q8_0, ~35 MB, 384-dim, 512-token
 * context) is a reasonable default for short capsule texts on a phone; its
 * retrieval quality on real capsules is part of 7.1's device check in
 * `.claude/loop/BLOCKED.md`.
 */

export const EMBEDDING_MODEL_PATH_KEY = "embeddingModelPath";
const EMBEDDING_MODEL_DIRECTORY = "embedding-models";

export const DEFAULT_EMBEDDING_MODEL = {
  name: "BGE small English v1.5 (Q8_0)",
  url: "https://huggingface.co/CompendiumLabs/bge-small-en-v1.5-gguf/resolve/main/bge-small-en-v1.5-q8_0.gguf",
  /** Tokens per input; capsule text beyond this is truncated by the model. */
  contextLength: 512,
};

function storedPath(): string | undefined {
  const value = getString(EMBEDDING_MODEL_PATH_KEY);
  if (value === undefined) return undefined;
  try {
    return appFileExists(value) ? value : undefined;
  } catch {
    return undefined; // not a safe relative path — never resolve it
  }
}

/** The downloaded model's current `file://` URI, or undefined if it isn't downloaded (or the file is gone). */
export function getEmbeddingModelUri(): string | undefined {
  const path = storedPath();
  return path === undefined ? undefined : resolveAppPath(path);
}

let inFlight: Promise<string> | null = null;

/**
 * Downloads the default embedding model if it isn't already present and
 * returns its `file://` URI. Must only be called from an explicit user
 * action — this is a network request (CLAUDE.md's one allowed action).
 *
 * Concurrent calls share one download. The audit entry is written before
 * the path is stored, so a model the app considers downloaded always has
 * its audit record; if storing fails afterwards, the next call simply
 * downloads again (overwriting the same file).
 */
export function downloadEmbeddingModel(db: SQLiteDatabase): Promise<string> {
  const existing = storedPath();
  if (existing !== undefined) return Promise.resolve(resolveAppPath(existing));
  if (inFlight === null) {
    inFlight = runDownload(db).finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

async function runDownload(db: SQLiteDatabase): Promise<string> {
  const endEgress = beginEgress();
  try {
    const { relativePath } = await downloadFileInto(
      DEFAULT_EMBEDDING_MODEL.url,
      [EMBEDDING_MODEL_DIRECTORY],
    );
    insertAuditEntry(db, {
      id: generateId(),
      action: "model_download",
      detail: DEFAULT_EMBEDDING_MODEL.name,
      createdAt: Date.now(),
    });
    setString(EMBEDDING_MODEL_PATH_KEY, relativePath);
    return resolveAppPath(relativePath);
  } finally {
    endEgress();
  }
}

/** Deletes the downloaded embedding model and forgets its path. */
export function deleteEmbeddingModel(): void {
  const value = getString(EMBEDDING_MODEL_PATH_KEY);
  if (value === undefined) return;
  try {
    deleteAppFileIfExists(value);
  } catch {
    // An unsafe stored value is simply forgotten, never acted on.
  }
  remove(EMBEDDING_MODEL_PATH_KEY);
}
