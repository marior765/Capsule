import type { SQLiteDatabase } from "expo-sqlite";
import { beginEgress } from "@/shared/egress";
import {
  appFileExists,
  deleteAppFileIfExists,
  downloadFileInto,
  resolveAppPath,
  safeDecode,
} from "@/shared/fs";
import { insertAuditEntry } from "@/entities/audit";
import { generateId } from "@/shared/lib";
import { getString, remove, setString } from "@/shared/storage";

const STT_MODELS_DIRECTORY = "stt-models";

/** Where the downloaded model's local path is persisted between launches. */
export const STT_MODEL_PATH_KEY = "sttModelPath";

/**
 * The one default STT model this app downloads on first use. Deliberately
 * a single fixed model, not a picker — full multi-model management
 * (`entities/stt-model` + selection UI, mirroring `entities/model`'s LLM
 * story) is deferred to Phase 9 (9.5); this is the minimal path chosen to
 * unblock `features/voice-input` without building that first.
 */
export const DEFAULT_STT_MODEL = {
  name: "Whisper base (English)",
  url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin",
  /** Approximate download size, shown before downloading. */
  sizeLabel: "148 MB",
};

/**
 * The stored path, app-relative (`stt-models/<file>`). Paths stored by
 * older versions are absolute `file://` URIs, which iOS invalidates when it
 * moves the app's container; their `stt-models/<file>` tail is kept.
 */
function storedPath(): string | undefined {
  const value = getString(STT_MODEL_PATH_KEY);
  if (value === undefined) return undefined;
  let relative = value;
  if (value.includes("://")) {
    const at = value.lastIndexOf(`/${STT_MODELS_DIRECTORY}/`);
    if (at === -1) return undefined;
    relative = value
      .slice(at + 1)
      .split("/")
      .map(safeDecode)
      .join("/");
  }
  try {
    return appFileExists(relative) ? relative : undefined;
  } catch {
    return undefined; // not a safe relative path — never resolve it
  }
}

/**
 * The downloaded model's current `file://` URI, without triggering a
 * download — undefined if it isn't downloaded or its file is gone.
 */
export function getSttModelPath(): string | undefined {
  const path = storedPath();
  return path === undefined ? undefined : resolveAppPath(path);
}

let inFlight: Promise<string> | null = null;

/**
 * Downloads the default STT model on first use and returns its current
 * `file://` URI; afterwards the stored model is returned directly (a model
 * whose file has gone is downloaded again). Concurrent calls share one
 * download. This is the one allowed network action for voice input: it is
 * user-triggered, shown as network activity (`shared/egress`) while it
 * runs, and recorded in the audit log ("model download").
 */
export async function ensureSttModelDownloaded(
  db: SQLiteDatabase,
  onProgress?: (fraction: number) => void,
): Promise<string> {
  const existing = getSttModelPath();
  if (existing) {
    onProgress?.(1);
    return existing;
  }
  inFlight ??= download(db).finally(() => {
    inFlight = null;
  });
  const uri = await inFlight;
  onProgress?.(1);
  return uri;
}

/** True while the voice model is downloading (from any screen). */
export function isSttModelDownloading(): boolean {
  return inFlight !== null;
}

/**
 * Resolves once a download in flight (started from the mic or another
 * screen) has finished, either way; right away if there is none.
 */
export async function waitForSttDownload(): Promise<void> {
  try {
    await inFlight;
  } catch {
    // The caller re-reads the state; a failed download just shows "missing".
  }
}

/**
 * Deletes the downloaded voice model and forgets it (10.31) — the next
 * voice input downloads it again. The caller must release a loaded whisper
 * context first (`SttProvider`'s `release`).
 */
export function deleteSttModel(): void {
  const path = storedPath();
  if (path !== undefined) {
    try {
      deleteAppFileIfExists(path);
    } catch {
      // An unsafe stored value is simply forgotten, never acted on.
    }
  }
  remove(STT_MODEL_PATH_KEY);
}

async function download(db: SQLiteDatabase): Promise<string> {
  const endEgress = beginEgress();
  try {
    const { relativePath } = await downloadFileInto(DEFAULT_STT_MODEL.url, [
      STT_MODELS_DIRECTORY,
    ]);
    setString(STT_MODEL_PATH_KEY, relativePath);
    insertAuditEntry(db, {
      id: generateId(),
      action: "model_download",
      detail: DEFAULT_STT_MODEL.name,
      createdAt: Date.now(),
    });
    return resolveAppPath(relativePath);
  } finally {
    endEgress();
  }
}
