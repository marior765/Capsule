// Tests for step 6.7 — written before implementation (TDD)
import { moveField } from "../moveField";

describe("moveField — happy path", () => {
  it("swaps a middle item up with its predecessor", () => {
    expect(moveField(["A", "B", "C"], 1, "up")).toEqual(["B", "A", "C"]);
  });

  it("swaps a middle item down with its successor", () => {
    expect(moveField(["A", "B", "C"], 1, "down")).toEqual(["A", "C", "B"]);
  });

  it("moves the last item up to the front position it targets", () => {
    expect(moveField(["A", "B", "C"], 2, "up")).toEqual(["A", "C", "B"]);
  });

  it("moves the first item down to the position it targets", () => {
    expect(moveField(["A", "B", "C"], 0, "down")).toEqual(["B", "A", "C"]);
  });

  it("does not mutate the original array", () => {
    const original = ["A", "B", "C"];
    moveField(original, 1, "up");
    expect(original).toEqual(["A", "B", "C"]);
  });
});

describe("moveField — boundary no-ops", () => {
  it("moving the first item up is a no-op and returns the SAME array reference", () => {
    const items = ["A", "B", "C"];
    expect(moveField(items, 0, "up")).toBe(items);
  });

  it("moving the last item down is a no-op and returns the SAME array reference", () => {
    const items = ["A", "B", "C"];
    expect(moveField(items, 2, "down")).toBe(items);
  });

  it("a single-item array is a no-op in either direction", () => {
    const items = ["A"];
    expect(moveField(items, 0, "up")).toBe(items);
    expect(moveField(items, 0, "down")).toBe(items);
  });

  it("an empty array is a no-op in either direction", () => {
    const items: string[] = [];
    expect(moveField(items, 0, "up")).toBe(items);
    expect(moveField(items, 0, "down")).toBe(items);
  });

  it("an out-of-range index is a no-op, not a crash", () => {
    const items = ["A", "B", "C"];
    expect(moveField(items, 5, "up")).toBe(items);
    expect(moveField(items, -1, "down")).toBe(items);
  });
});
