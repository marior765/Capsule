// Tests for step 0.5 — written before implementation (TDD)
import { abortCompletion, initLlm, releaseLlm, runCompletion } from "../index";

const MOCK_MODEL_PATH = "/models/test-model.gguf";

describe("shared/llm — initLlm", () => {
  it("returns a context object for a valid model path", async () => {
    const ctx = await initLlm(MOCK_MODEL_PATH);
    expect(ctx).toBeDefined();
    await releaseLlm(ctx);
  });

  it("throws if model path is empty", async () => {
    await expect(initLlm("")).rejects.toThrow();
  });
});

describe("shared/llm — runCompletion happy path", () => {
  it("returns a completion result", async () => {
    const ctx = await initLlm(MOCK_MODEL_PATH);
    const result = await runCompletion(
      ctx,
      { prompt: "Hello", maxTokens: 10 },
      () => {},
    );
    expect(result).toBeDefined();
    expect(typeof result.text).toBe("string");
    await releaseLlm(ctx);
  });

  it("calls onToken for each generated token", async () => {
    const ctx = await initLlm(MOCK_MODEL_PATH);
    const tokens: string[] = [];
    await runCompletion(ctx, { prompt: "Hello", maxTokens: 5 }, (token) => {
      tokens.push(token);
    });
    expect(tokens.length).toBeGreaterThan(0);
    await releaseLlm(ctx);
  });
});

describe("shared/llm — runCompletion edge cases", () => {
  it("throws on empty prompt", async () => {
    const ctx = await initLlm(MOCK_MODEL_PATH);
    await expect(
      runCompletion(ctx, { prompt: "", maxTokens: 10 }, () => {}),
    ).rejects.toThrow();
    await releaseLlm(ctx);
  });

  it("handles maxTokens of 1", async () => {
    const ctx = await initLlm(MOCK_MODEL_PATH);
    const result = await runCompletion(
      ctx,
      { prompt: "Hi", maxTokens: 1 },
      () => {},
    );
    expect(result).toBeDefined();
    await releaseLlm(ctx);
  });
});

describe("shared/llm — runCompletion error handling", () => {
  it("throws if completion is called with null context", async () => {
    await expect(
      runCompletion(null as any, { prompt: "Hi", maxTokens: 10 }, () => {}),
    ).rejects.toThrow();
  });
});

describe("shared/llm — abortCompletion", () => {
  it("does not throw when called during an active completion", async () => {
    const ctx = await initLlm(MOCK_MODEL_PATH);
    const promise = runCompletion(
      ctx,
      { prompt: "Hello", maxTokens: 100 },
      () => {},
    );
    expect(() => abortCompletion(ctx)).not.toThrow();
    await promise.catch(() => {});
    await releaseLlm(ctx);
  });
});

describe("shared/llm — releaseLlm", () => {
  it("releases the context without throwing", async () => {
    const ctx = await initLlm(MOCK_MODEL_PATH);
    await expect(releaseLlm(ctx)).resolves.not.toThrow();
  });
});
