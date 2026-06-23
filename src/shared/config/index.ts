export const FEATURE_FLAGS = {
  lanSync: false,
  encryption: false,
  ephemeralChats: false,
  cloudApis: false,
} as const;

/**
 * GGUF quantization levels, ordered low → high precision.
 * Lower = smaller file / faster / less accurate; higher = larger / slower / more accurate.
 */
export const QUANTIZATIONS = [
  "Q2_K",
  "Q3_K_M",
  "Q4_K_M",
  "Q5_K_M",
  "Q6_K",
  "Q8_0",
  "F16",
] as const;
export type Quantization = (typeof QUANTIZATIONS)[number];

/** Model parameter-count tiers, ordered small → large. */
export const PARAMETER_SIZES = ["1B", "3B", "7B", "13B", "70B"] as const;
export type ParameterSize = (typeof PARAMETER_SIZES)[number];

/**
 * Curated set of small, on-device-friendly GGUF models the app offers for
 * download. URLs point at public Hugging Face repos. Verify URLs on first use —
 * repo paths occasionally change.
 */
export const RECOMMENDED_MODELS = [
  {
    name: "Llama 3.2 1B Instruct (Q4_K_M)",
    url: "https://huggingface.co/unsloth/Llama-3.2-1B-Instruct-GGUF/resolve/main/Llama-3.2-1B-Instruct-Q4_K_M.gguf",
    parameters: "1B",
    quantization: "Q4_K_M",
  },
  {
    name: "Llama 3.2 3B Instruct (Q4_K_M)",
    url: "https://huggingface.co/unsloth/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct-Q4_K_M.gguf",
    parameters: "3B",
    quantization: "Q4_K_M",
  },
] as const satisfies readonly {
  name: string;
  url: string;
  parameters: ParameterSize;
  quantization: Quantization;
}[];

export const APP_CONSTANTS = {
  dbName: "capsule.db",
  mmkvId: "capsule",
  maxContentWidth: 800,
  bottomTabInset: { ios: 50, android: 80 },
  /**
   * Fraction of total device RAM a model's file size may occupy and still be
   * "recommended". Leaves headroom for the OS plus inference working memory
   * (KV cache, context). A model larger than RAM × this fraction is flagged as
   * likely too large to run comfortably.
   */
  modelRamSafeFraction: 0.6,
} as const;
