// Tests for step 8.5 "bulk operations" — written before implementation (TDD)
import { toggleSelection } from "../toggleSelection";

describe("toggleSelection", () => {
  it("adds an id that isn't currently selected", () => {
    const result = toggleSelection(new Set(), "a");
    expect(result.has("a")).toBe(true);
  });

  it("removes an id that is currently selected", () => {
    const result = toggleSelection(new Set(["a"]), "a");
    expect(result.has("a")).toBe(false);
  });

  it("leaves other ids untouched", () => {
    const result = toggleSelection(new Set(["a", "b"]), "a");
    expect(result.has("b")).toBe(true);
    expect(result.has("a")).toBe(false);
  });

  it("does not mutate the input set", () => {
    const original = new Set(["a"]);
    toggleSelection(original, "a");
    expect(original.has("a")).toBe(true);
  });

  it("toggling twice returns to the original membership", () => {
    const start = new Set(["a", "b"]);
    const once = toggleSelection(start, "c");
    const twice = toggleSelection(once, "c");
    expect(twice).toEqual(start);
  });

  it("works starting from an empty set", () => {
    const result = toggleSelection(new Set(), "a");
    expect(result).toEqual(new Set(["a"]));
  });
});
