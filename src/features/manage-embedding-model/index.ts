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
  /** Approximate download size, for the UI (the server's actual size may differ slightly). */
  sizeLabel: "35 MB",
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

// Bumped by `cancelEmbeddingDownload`. A download remembers the generation
// it started in; if that changed by the time the bytes land (e.g. a full
// wipe ran meanwhile), it deletes the file and stores nothing.
let generation = 0;
let inFlight: { generation: number; promise: Promise<string> } | null = null;

/**
 * True while an embedding-model download is in progress — including a
 * cancelled one that hasn't finished yet (its bytes are still arriving and
 * it still has cleanup to do).
 */
export function isEmbeddingModelDownloading(): boolean {
  return inFlight !== null;
}

/** Resolves once the current download (if any) has settled. Never rejects. */
export function waitForEmbeddingDownload(): Promise<void> {
  return inFlight === null
    ? Promise.resolve()
    : inFlight.promise.then(
        () => undefined,
        () => undefined,
      );
}

/**
 * Makes any in-flight download discard its result. Call this when the
 * app's data is being wiped, so a download that finishes afterwards can't
 * put the model (or its stored path) back.
 *
 * The cancelled download keeps running until its bytes land (there's no
 * native abort here) and then deletes them. Every attempt writes the SAME
 * file name, so a download requested meanwhile waits for the cancelled one
 * to settle first — otherwise that cleanup would delete the new file.
 */
export function cancelEmbeddingDownload(): void {
  generation++;
}

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
  if (inFlight !== null && inFlight.generation === generation) {
    return inFlight.promise;
  }
  const startedIn = generation;
  // A stale (cancelled) download may still be running — let it finish its
  // cleanup before this one writes the same file name.
  const previous = waitForEmbeddingDownload();
  const entry = {
    generation: startedIn,
    promise: previous
      .then(() => runDownload(db, startedIn))
      .finally(() => {
        if (inFlight === entry) inFlight = null;
      }),
  };
  inFlight = entry;
  return entry.promise;
}

async function runDownload(
  db: SQLiteDatabase,
  startedIn: number,
): Promise<string> {
  // Cancelled while waiting behind an earlier download: never touch the
  // network at all (a wipe means no more traffic, not "download, then delete").
  if (startedIn !== generation) {
    throw new Error("Embedding model download was cancelled");
  }
  const endEgress = beginEgress();
  try {
    const { relativePath } = await downloadFileInto(
      DEFAULT_EMBEDDING_MODEL.url,
      [EMBEDDING_MODEL_DIRECTORY],
    );
    if (startedIn !== generation) {
      try {
        deleteAppFileIfExists(relativePath);
      } catch {
        // best effort; the wipe already removed the folder in most cases
      }
      throw new Error("Embedding model download was cancelled");
    }
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
