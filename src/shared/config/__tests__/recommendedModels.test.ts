// Tests for 8.10 (stable testID suffixes) — written before implementation (TDD)
import { RECOMMENDED_MODELS } from "../index";

describe("RECOMMENDED_MODELS ids", () => {
  it("every recommended model has a unique, slug-safe id (used in testIDs, never shown)", () => {
    const ids = RECOMMENDED_MODELS.map((m) => m.id);
    expect(new Set(ids).size).toBe(RECOMMENDED_MODELS.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });
});
