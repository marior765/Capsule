import { Directory, File, Paths } from "expo-file-system";
import type { SQLiteDatabase } from "expo-sqlite";
import { insertAuditEntry } from "@/entities/audit";
import { generateId } from "@/shared/lib";
import { getString, setString } from "@/shared/storage";

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
};

/** Reads the downloaded model's local path without triggering a download. */
export function getSttModelPath(): string | undefined {
  return getString(STT_MODEL_PATH_KEY);
}

/**
 * Downloads the default STT model on first use and returns its local path.
 * A no-op past the first call — the stored path is returned directly once
 * it exists, matching `features/manage-models`' download-once shape for the
 * LLM side. This is the one allowed network action for voice input; see
 * CLAUDE.md's hard rule on privacy-sensitive actions writing to the audit
 * entity ("model download" is one of the four named).
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

  const dir = new Directory(Paths.document, "stt-models");
  if (!dir.exists) {
    dir.create();
  }

  const file = await File.downloadFileAsync(DEFAULT_STT_MODEL.url, dir);

  setString(STT_MODEL_PATH_KEY, file.uri);
  insertAuditEntry(db, {
    id: generateId(),
    action: "model_download",
    detail: DEFAULT_STT_MODEL.name,
    createdAt: Date.now(),
  });

  onProgress?.(1);
  return file.uri;
}
