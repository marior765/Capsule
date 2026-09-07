// Tests for step 0.5 — written before implementation (TDD)
// initEmbeddingContext/embedText: new for step 7.1 (embedding spike).
import * as llamaRn from "llama.rn";
import {
  abortCompletion,
  embedText,
  initEmbeddingContext,
  initLlm,
  releaseLlm,
  runCompletion,
} from "../index";
import type { LlamaContext } from "../index";

const MOCK_MODEL_PATH = "/models/test-model.gguf";
const CTX_LEN = 4096;

// llama.rn's jest mock ships the *real* initLlama driven by fake native
// bindings, so it has to be spied on rather than asserted against directly.
const mockInitLlama = jest.spyOn(llamaRn, "initLlama");

beforeEach(() => {
  mockInitLlama.mockClear();
});

/**
 * `runCompletion` is tested against a recording stand-in rather than llama.rn's
 * own jest mock. What is worth asserting here is *our* half of the contract —
 * that camelCase wrapper params map onto llama.rn's snake_case sampling fields
 * and that chat turns go down as structured `messages` with `jinja` on. Driving
 * the real mock would instead assert that llama.rn returns text, which is
 * llama.rn's job to test, and its mock cannot format a chat anyway (there is no
 * GGUF, so no template — every chat formats to an empty prompt).
 */
type CompletionCall = Record<string, unknown>;

function fakeContext(tokens: string[] = ["Hi", " there"]) {
  const calls: CompletionCall[] = [];
  const ctx = {
    completion: jest.fn(
      async (params: CompletionCall, cb?: (d: { token: string }) => void) => {
        calls.push(params);
        tokens.forEach((token) => cb?.({ token }));
        return { text: tokens.join("") };
      },
    ),
    stopCompletion: jest.fn(),
    release: jest.fn(async () => {}),
  };
  return { ctx: ctx as unknown as LlamaContext, calls, spies: ctx };
}

const HELLO = [{ role: "user" as const, content: "Hello" }];

describe("shared/llm — initLlm", () => {
  it("returns a context object for a valid model path", async () => {
    const ctx = await initLlm(MOCK_MODEL_PATH, CTX_LEN);
    expect(ctx).toBeDefined();
    await releaseLlm(ctx);
  });

  it("throws if model path is empty", async () => {
    await expect(initLlm("", CTX_LEN)).rejects.toThrow();
  });

  // Regression: n_ctx sizes the KV cache at load time. Omitted, llama.rn treats
  // even a ~50-token prompt as a full context and every completion comes back
  // empty — the setting existed in config but never reached the model.
  it("sizes the context window from the given length", async () => {
    const ctx = await initLlm(MOCK_MODEL_PATH, 2048);
    expect(mockInitLlama).toHaveBeenCalledWith(
      expect.objectContaining({ model: MOCK_MODEL_PATH, n_ctx: 2048 }),
    );
    await releaseLlm(ctx);
  });

  it("throws rather than loading a model with no usable context", async () => {
    await expect(initLlm(MOCK_MODEL_PATH, 0)).rejects.toThrow(
      "Context length must be greater than zero",
    );
  });
});

describe("shared/llm — runCompletion happy path", () => {
  it("returns the completed text", async () => {
    const { ctx } = fakeContext();
    const result = await runCompletion(
      ctx,
      { messages: HELLO, maxTokens: 10 },
      () => {},
    );
    expect(result.text).toBe("Hi there");
  });

  it("calls onToken for each generated token", async () => {
    const { ctx } = fakeContext(["a", "b", "c"]);
    const tokens: string[] = [];
    await runCompletion(ctx, { messages: HELLO, maxTokens: 5 }, (t) =>
      tokens.push(t),
    );
    expect(tokens).toEqual(["a", "b", "c"]);
  });

  it("sends the chat turns through untouched, with no prompt markup of our own", async () => {
    const { ctx, calls } = fakeContext();
    const messages = [
      { role: "system" as const, content: "Be terse." },
      { role: "user" as const, content: "Hello" },
    ];
    await runCompletion(ctx, { messages, maxTokens: 10 }, () => {});
    expect(calls[0].messages).toEqual(messages);
    expect(calls[0].prompt).toBeUndefined();
  });

  it("asks llama.rn to render with the template embedded in the GGUF", async () => {
    const { ctx, calls } = fakeContext();
    await runCompletion(ctx, { messages: HELLO, maxTokens: 10 }, () => {});
    expect(calls[0].jinja).toBe(true);
  });

  it("maps wrapper params onto llama.rn's sampling fields", async () => {
    const { ctx, calls } = fakeContext();
    await runCompletion(
      ctx,
      {
        messages: HELLO,
        maxTokens: 64,
        temperature: 0.11,
        topP: 0.5,
        topK: 7,
        repeatPenalty: 1.2,
        seed: 42,
      },
      () => {},
    );
    expect(calls[0]).toMatchObject({
      n_predict: 64,
      temperature: 0.11,
      top_p: 0.5,
      top_k: 7,
      penalty_repeat: 1.2,
      seed: 42,
    });
  });
});

describe("shared/llm — runCompletion edge cases", () => {
  it("throws when there are no messages to send", async () => {
    const { ctx, spies } = fakeContext();
    await expect(
      runCompletion(ctx, { messages: [], maxTokens: 10 }, () => {}),
    ).rejects.toThrow("At least one message is required");
    expect(spies.completion).not.toHaveBeenCalled();
  });

  it("handles maxTokens of 1", async () => {
    const { ctx, calls } = fakeContext(["Hi"]);
    const result = await runCompletion(
      ctx,
      { messages: HELLO, maxTokens: 1 },
      () => {},
    );
    expect(result.text).toBe("Hi");
    expect(calls[0].n_predict).toBe(1);
  });

  it("omits sampling fields the caller left unset", async () => {
    const { ctx, calls } = fakeContext();
    await runCompletion(ctx, { messages: HELLO, maxTokens: 10 }, () => {});
    expect(calls[0].temperature).toBeUndefined();
    expect(calls[0].seed).toBeUndefined();
  });
});

describe("shared/llm — runCompletion error handling", () => {
  it("throws if completion is called with null context", async () => {
    await expect(
      runCompletion(
        null as unknown as LlamaContext,
        { messages: HELLO, maxTokens: 10 },
        () => {},
      ),
    ).rejects.toThrow("LLM context is not initialized");
  });

  it("propagates a failure from the native layer", async () => {
    const { ctx, spies } = fakeContext();
    spies.completion.mockRejectedValueOnce(new Error("native failure"));
    await expect(
      runCompletion(ctx, { messages: HELLO, maxTokens: 10 }, () => {}),
    ).rejects.toThrow("native failure");
  });
});

describe("shared/llm — abortCompletion", () => {
  it("stops the completion on the context", () => {
    const { ctx, spies } = fakeContext();
    abortCompletion(ctx);
    expect(spies.stopCompletion).toHaveBeenCalled();
  });

  it("is a no-op without a context", () => {
    expect(() =>
      abortCompletion(null as unknown as LlamaContext),
    ).not.toThrow();
  });
});

describe("shared/llm — releaseLlm", () => {
  it("releases the context without throwing", async () => {
    const ctx = await initLlm(MOCK_MODEL_PATH, CTX_LEN);
    await expect(releaseLlm(ctx)).resolves.not.toThrow();
  });
});

// 7.1 — spike: local embeddings via llama.rn's own built-in embedding()
// support, rather than a separate model. Same two-tier testing split as
// completions above: initEmbeddingContext (drives llama.rn's real jest
// mock, asserting OUR call shape) vs. embedText (a fake context stand-in,
// since what's worth proving is the wrapper's own contract, not llama.rn's).
describe("shared/llm — initEmbeddingContext", () => {
  it("returns a context object for a valid model path", async () => {
    const ctx = await initEmbeddingContext(MOCK_MODEL_PATH, CTX_LEN);
    expect(ctx).toBeDefined();
    await releaseLlm(ctx);
  });

  it("throws if model path is empty", async () => {
    await expect(initEmbeddingContext("", CTX_LEN)).rejects.toThrow();
  });

  it("throws rather than loading a model with no usable context", async () => {
    await expect(initEmbeddingContext(MOCK_MODEL_PATH, 0)).rejects.toThrow(
      "Context length must be greater than zero",
    );
  });

  // Regression risk this test guards against: llama.rn does not error on a
  // context loaded without `embedding: true` — calling `.embedding()` on
  // one just returns meaningless output, no exception. This flag is the
  // one thing standing between a real embedding and silent garbage, so
  // it's asserted explicitly rather than trusted to "obviously" be there.
  it("loads the context with embedding mode enabled", async () => {
    const ctx = await initEmbeddingContext(MOCK_MODEL_PATH, CTX_LEN);
    expect(mockInitLlama).toHaveBeenCalledWith(
      expect.objectContaining({
        model: MOCK_MODEL_PATH,
        n_ctx: CTX_LEN,
        embedding: true,
      }),
    );
    await releaseLlm(ctx);
  });
});

function fakeEmbeddingContext(vector: number[] = [0.1, 0.2, 0.3]) {
  const ctx = {
    embedding: jest.fn(async () => ({ embedding: vector })),
    release: jest.fn(async () => {}),
  };
  return { ctx: ctx as unknown as LlamaContext, spies: ctx };
}

describe("shared/llm — embedText", () => {
  it("returns the embedding vector for the given text", async () => {
    const { ctx } = fakeEmbeddingContext([1, 2, 3]);
    const result = await embedText(ctx, "hello world");
    expect(result.embedding).toEqual([1, 2, 3]);
  });

  it("passes the text through to the context's embedding call untouched", async () => {
    const { ctx, spies } = fakeEmbeddingContext();
    await embedText(ctx, "some capsule content");
    expect(spies.embedding).toHaveBeenCalledWith("some capsule content");
  });

  it("throws without a context, rather than calling into a null native binding", async () => {
    await expect(
      embedText(null as unknown as LlamaContext, "text"),
    ).rejects.toThrow();
  });

  it("throws on empty text rather than embedding nothing", async () => {
    const { ctx } = fakeEmbeddingContext();
    await expect(embedText(ctx, "")).rejects.toThrow("Text is required");
  });

  it("throws on whitespace-only text", async () => {
    const { ctx } = fakeEmbeddingContext();
    await expect(embedText(ctx, "   ")).rejects.toThrow("Text is required");
  });

  it("propagates a failure from the native layer", async () => {
    const { ctx, spies } = fakeEmbeddingContext();
    spies.embedding.mockRejectedValueOnce(new Error("native failure"));
    await expect(embedText(ctx, "text")).rejects.toThrow("native failure");
  });
});
