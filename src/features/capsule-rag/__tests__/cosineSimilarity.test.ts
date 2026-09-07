// Tests for step 7.2 — written before implementation (TDD)
import { cosineSimilarity } from "../cosineSimilarity";

describe("cosineSimilarity", () => {
  it("returns 1 for identical vectors", () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1);
  });

  it("returns 0 for orthogonal vectors", () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it("returns -1 for exactly opposite vectors", () => {
    expect(cosineSimilarity([1, 2, 3], [-1, -2, -3])).toBeCloseTo(-1);
  });

  it("is unaffected by magnitude — only direction matters", () => {
    expect(cosineSimilarity([1, 1], [2, 2])).toBeCloseTo(1);
  });

  it("returns a higher score for a closer direction than a farther one", () => {
    const query = [1, 1];
    const close = cosineSimilarity(query, [1, 0.9]);
    const far = cosineSimilarity(query, [1, -1]);
    expect(close).toBeGreaterThan(far);
  });

  it("returns 0, not NaN, for a zero vector", () => {
    expect(cosineSimilarity([0, 0, 0], [1, 2, 3])).toBe(0);
  });

  it("returns 0, not a crash, for mismatched vector lengths", () => {
    expect(cosineSimilarity([1, 2], [1, 2, 3])).toBe(0);
  });

  it("returns 0 for empty vectors", () => {
    expect(cosineSimilarity([], [])).toBe(0);
  });
});
