import { initLlama as _initLlama, LlamaContext } from "llama.rn";

export type { LlamaContext };

export type CompletionParams = {
  prompt: string;
  maxTokens: number;
};

export type CompletionResult = {
  text: string;
};

export async function initLlm(modelPath: string): Promise<LlamaContext> {
  if (!modelPath) {
    throw new Error("Model path is required");
  }
  const ctx = await _initLlama({ model: modelPath });
  return ctx;
}

export async function runCompletion(
  ctx: LlamaContext,
  params: CompletionParams,
  onToken: (token: string) => void,
): Promise<CompletionResult> {
  if (!ctx) {
    throw new Error("LLM context is not initialized");
  }

  const result = await ctx.completion(
    {
      prompt: params.prompt,
      n_predict: params.maxTokens,
    },
    (data: { token: string }) => {
      onToken(data.token);
    },
  );

  return { text: result.text };
}

export function abortCompletion(ctx: LlamaContext): void {
  if (!ctx) return;
  ctx.stopCompletion();
}

export async function releaseLlm(ctx: LlamaContext): Promise<void> {
  if (!ctx) return;
  await ctx.release();
}
