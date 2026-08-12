import { initLlama as _initLlama, LlamaContext } from "llama.rn";

export type { LlamaContext };

export type ChatRole = "system" | "user" | "assistant";

export type ChatMessage = {
  role: ChatRole;
  content: string;
};

/**
 * Wrapper-level completion params. Names are ours (camelCase); the mapping to
 * llama.rn's snake_case sampling fields happens in `runCompletion`, so callers
 * never touch llama.rn naming directly.
 *
 * Callers pass structured `messages`, never a pre-rendered prompt string: every
 * model expects its own chat markup (Llama 3.2 wants `<|start_header_id|>`),
 * and each GGUF ships its template inside the file. `runCompletion` hands the
 * messages to llama.rn, which applies that template. Hand-rolling the prompt
 * makes the model see junk and stop immediately.
 */
export type CompletionParams = {
  messages: ChatMessage[];
  maxTokens: number;
  temperature?: number;
  topP?: number;
  topK?: number;
  repeatPenalty?: number;
  seed?: number;
};

export type CompletionResult = {
  text: string;
};

/**
 * Loads a model into memory.
 *
 * `contextLength` maps to llama.rn's `n_ctx` and must be passed here, not per
 * completion — it sizes the KV cache allocated at load time. Left unset,
 * llama.rn hands the prompt-length check an `n_ctx` small enough that a
 * ~50-token prompt already counts as a full context, and every completion
 * returns empty without generating a token.
 *
 * Required rather than defaulted: the default lives in `shared/config`, which
 * this slice may not import, and a wrapper that silently picks a context size
 * is what hid this bug in the first place.
 */
export async function initLlm(
  modelPath: string,
  contextLength: number,
): Promise<LlamaContext> {
  if (!modelPath) {
    throw new Error("Model path is required");
  }
  if (contextLength <= 0) {
    throw new Error("Context length must be greater than zero");
  }
  const ctx = await _initLlama({ model: modelPath, n_ctx: contextLength });
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
  if (params.messages.length === 0) {
    throw new Error("At least one message is required");
  }

  // TEMPORARY DIAGNOSTIC — remove once the empty-reply bug is settled.
  // The prompt is rendered by native code from the template inside the GGUF,
  // so it is invisible from JS unless we ask for it explicitly.
  if (__DEV__) {
    try {
      const formatted = await ctx.getFormattedChat(params.messages, undefined, {
        jinja: true,
      });
      console.log("[llm] rendered prompt >>>", JSON.stringify(formatted));
    } catch (error) {
      console.log("[llm] getFormattedChat FAILED >>>", error);
    }
  }

  let streamed = 0;
  const result = await ctx.completion(
    {
      messages: params.messages,
      // Render via the template embedded in the GGUF rather than any format of
      // our own — this is what makes the wrapper model-agnostic.
      jinja: true,
      n_predict: params.maxTokens,
      temperature: params.temperature,
      top_p: params.topP,
      top_k: params.topK,
      penalty_repeat: params.repeatPenalty,
      seed: params.seed,
    },
    (data: { token: string }) => {
      streamed += 1;
      onToken(data.token);
    },
  );

  if (__DEV__) {
    const r = result as unknown as Record<string, unknown>;
    console.log("[llm] result >>>", {
      streamedTokens: streamed,
      text: JSON.stringify(r.text),
      content: JSON.stringify(r.content),
      reasoning_content: JSON.stringify(r.reasoning_content),
      tokens_predicted: r.tokens_predicted,
      tokens_evaluated: r.tokens_evaluated,
      stopped_eos: r.stopped_eos,
      stopped_word: r.stopped_word,
      stopped_limit: r.stopped_limit,
      stopping_word: r.stopping_word,
      truncated: r.truncated,
      context_full: r.context_full,
    });
  }

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
