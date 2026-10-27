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
    const stored = JSON.parse(raw) as Record<string, unknown>;
    // Each value is checked like a typed one (10.29): settings saved before
    // validation existed (temperature 50, a 100000-token context) or edited
    // by hand fall back to that field's default instead of reaching the model.
    const settings = { ...DEFAULT_INFERENCE };
    for (const key of Object.keys(
      DEFAULT_INFERENCE,
    ) as (keyof InferenceSettings)[]) {
      const value = stored[key];
      if (typeof value === "number" && isAllowed(key, value)) {
        settings[key] = value;
      }
    }
    return settings;
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

type Rule = { min: number; max: number; integer: boolean; message?: string };

function isAllowed(key: keyof InferenceSettings, value: number): boolean {
  const rule = RULES[key];
  return (
    Number.isFinite(value) &&
    (!rule.integer || Number.isInteger(value)) &&
    value >= rule.min &&
    value <= rule.max
  );
}

const RULES: Record<keyof InferenceSettings, Rule> = {
  temperature: { min: 0, max: 2, integer: false },
  topP: { min: 0, max: 1, integer: false },
  topK: { min: 0, max: 1000, integer: true },
  repeatPenalty: { min: 0.5, max: 2, integer: false },
  contextLength: { min: 256, max: 32768, integer: true },
  seed: {
    min: -1,
    max: 2_147_483_647,
    integer: true,
    message: "Use -1 for a random seed, or 0 or more.",
  },
};

const PLAIN_NUMBER = /^-?(\d+(\.\d*)?|\.\d+)$/;

/**
 * Checks one typed inference setting (10.29): a plain number ("1.2abc" is
 * not), whole where it must be, inside a range the model can use. Returns
 * the number, or a short message to show next to the field.
 */
export function validateInferenceValue(
  key: keyof InferenceSettings,
  raw: string,
): { value: number } | { error: string } {
  const text = raw.trim();
  if (!PLAIN_NUMBER.test(text)) return { error: "Enter a number." };
  const value = Number(text);
  const rule = RULES[key];
  if (rule.integer && !Number.isInteger(value)) {
    return { error: "Enter a whole number." };
  }
  if (value < rule.min || value > rule.max) {
    return {
      error: rule.message ?? `Must be between ${rule.min} and ${rule.max}.`,
    };
  }
  return { value };
}
