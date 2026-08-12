import type { SQLiteDatabase } from "expo-sqlite";
import { updateConversation } from "@/entities/conversation";
import { DEFAULT_INFERENCE, type InferenceSettings } from "@/shared/config";
import { getString, remove, setString } from "@/shared/storage";

const STORAGE_KEY = "inference.settings";

/**
 * Reads the persisted settings, filling any missing field from the defaults.
 * Corrupted storage falls back to defaults rather than throwing — these are
 * app preferences, not data worth failing a chat screen over.
 */
export function getInferenceSettings(): InferenceSettings {
  const raw = getString(STORAGE_KEY);
  if (!raw) return { ...DEFAULT_INFERENCE };

  try {
    const stored = JSON.parse(raw) as Partial<InferenceSettings>;
    return { ...DEFAULT_INFERENCE, ...stored };
  } catch {
    return { ...DEFAULT_INFERENCE };
  }
}

export function updateInferenceSettings(
  patch: Partial<InferenceSettings>,
): InferenceSettings {
  const next: InferenceSettings = { ...getInferenceSettings(), ...patch };
  setString(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function resetInferenceSettings(): void {
  remove(STORAGE_KEY);
}

/**
 * True when applying `patch` requires reloading the model into memory.
 *
 * Sampling params are passed per completion, but `contextLength` maps to
 * llama.rn's `n_ctx` — a context *init* param — so it only takes effect on a
 * fresh `initLlm`. Callers should trigger `LlmProvider.reload()` when true.
 */
export function requiresModelReload(
  patch: Partial<InferenceSettings>,
): boolean {
  if (patch.contextLength === undefined) return false;
  return patch.contextLength !== getInferenceSettings().contextLength;
}

/** Assigns (or clears, with null) the persona used for a conversation. */
export function selectPersona(
  db: SQLiteDatabase,
  conversationId: string,
  personaId: string | null,
): void {
  updateConversation(db, conversationId, { personaId });
}
