// Tests for step 8.5 "bulk operations" — written before implementation (TDD)
import { runBulkOperation } from "../index";

describe("runBulkOperation", () => {
  it("applies the operation to every id and reports them all as succeeded", () => {
    const result = runBulkOperation(["a", "b", "c"], (id) => id.toUpperCase());
    expect(result.succeeded).toEqual([
      { id: "a", result: "A" },
      { id: "b", result: "B" },
      { id: "c", result: "C" },
    ]);
    expect(result.failed).toEqual([]);
  });

  it("returns empty succeeded/failed arrays for an empty id list, without calling the operation", () => {
    const operation = jest.fn();
    const result = runBulkOperation([], operation);
    expect(result).toEqual({ succeeded: [], failed: [] });
    expect(operation).not.toHaveBeenCalled();
  });

  it("continues past a failing id rather than aborting the whole batch", () => {
    const result = runBulkOperation(["a", "b", "c"], (id) => {
      if (id === "b") throw new Error("boom");
      return id;
    });
    expect(result.succeeded.map((s) => s.id)).toEqual(["a", "c"]);
    expect(result.failed.map((f) => f.id)).toEqual(["b"]);
  });

  it("captures the actual thrown error value, not a coerced string", () => {
    const boom = new Error("boom");
    const result = runBulkOperation(["a"], () => {
      throw boom;
    });
    expect(result.failed[0].error).toBe(boom);
  });

  it("captures a non-Error thrown value as-is", () => {
    const result = runBulkOperation(["a"], () => {
      throw "not an Error instance";
    });
    expect(result.failed[0].error).toBe("not an Error instance");
  });

  it("when every id fails, succeeded is empty and every id is reported failed, in order", () => {
    const result = runBulkOperation(["a", "b"], (id) => {
      throw new Error(`fail-${id}`);
    });
    expect(result.succeeded).toEqual([]);
    expect(result.failed.map((f) => f.id)).toEqual(["a", "b"]);
  });

  it("preserves input order in both succeeded and failed lists", () => {
    const result = runBulkOperation(["c", "a", "b"], (id) => {
      if (id === "a") throw new Error("fail");
      return id;
    });
    expect(result.succeeded.map((s) => s.id)).toEqual(["c", "b"]);
    expect(result.failed.map((f) => f.id)).toEqual(["a"]);
  });

  it("does not mutate the input ids array", () => {
    const ids = ["a", "b", "c"];
    const original = [...ids];
    runBulkOperation(ids, (id) => id);
    expect(ids).toEqual(original);
  });

  it("calls the operation exactly once per id, even when some fail", () => {
    const operation = jest.fn((id: string) => {
      if (id === "b") throw new Error("fail");
      return id;
    });
    runBulkOperation(["a", "b", "c"], operation);
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it("supports an operation with no meaningful return value (void)", () => {
    const sideEffects: string[] = [];
    const result = runBulkOperation(["a", "b"], (id) => {
      sideEffects.push(id);
    });
    expect(sideEffects).toEqual(["a", "b"]);
    expect(result.succeeded).toHaveLength(2);
  });
});
