// Tests for step 10.16 — written before implementation (TDD)
//
// The counter read "251 ctx" — unlabelled jargon, and wrong. It now says what
// it is: how much of the model's context window the conversation takes.
import { estimateTokens, formatContextUsage } from "../formatContext";

describe("formatContextUsage", () => {
  it("shows used of total, labelled", () => {
    expect(formatContextUsage(750, 4096, false)).toBe(
      "Context 750 / 4,096 tokens",
    );
  });

  it("marks an estimate with ≈", () => {
    expect(formatContextUsage(120, 4096, true)).toBe(
      "Context ≈120 / 4,096 tokens",
    );
  });

  it("groups thousands", () => {
    expect(formatContextUsage(12345, 32768, false)).toBe(
      "Context 12,345 / 32,768 tokens",
    );
  });
});

describe("estimateTokens", () => {
  it("is zero for nothing", () => {
    expect(estimateTokens([])).toBe(0);
  });

  it("estimates about four characters per token, rounding up per message", () => {
    expect(estimateTokens(["abcd", "abcde"])).toBe(1 + 2);
  });
});
