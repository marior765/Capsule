// Tests for step 8.5 "bulk operations" — written before implementation (TDD)
import { bulkDeleteWithConfirmation } from "../bulkDeleteWithConfirmation";

describe("bulkDeleteWithConfirmation", () => {
  it("calls deleteOne for every id when the user confirms", async () => {
    const confirm = jest.fn().mockResolvedValue(true);
    const deleteOne = jest.fn();

    await bulkDeleteWithConfirmation(["a", "b", "c"], confirm, deleteOne);

    expect(deleteOne).toHaveBeenCalledTimes(3);
    expect(deleteOne).toHaveBeenCalledWith("a");
    expect(deleteOne).toHaveBeenCalledWith("b");
    expect(deleteOne).toHaveBeenCalledWith("c");
  });

  it("does not call deleteOne at all when the user declines", async () => {
    const confirm = jest.fn().mockResolvedValue(false);
    const deleteOne = jest.fn();

    await bulkDeleteWithConfirmation(["a", "b"], confirm, deleteOne);

    expect(deleteOne).not.toHaveBeenCalled();
  });

  it("does not even ask for confirmation when there are no ids to delete", async () => {
    const confirm = jest.fn().mockResolvedValue(true);
    const deleteOne = jest.fn();

    await bulkDeleteWithConfirmation([], confirm, deleteOne);

    expect(confirm).not.toHaveBeenCalled();
    expect(deleteOne).not.toHaveBeenCalled();
  });

  it("continues past a failing id rather than aborting the whole batch", async () => {
    const confirm = jest.fn().mockResolvedValue(true);
    const deleteOne = jest.fn((id: string) => {
      if (id === "b") throw new Error("boom");
    });

    const result = await bulkDeleteWithConfirmation(
      ["a", "b", "c"],
      confirm,
      deleteOne,
    );

    expect(deleteOne).toHaveBeenCalledTimes(3);
    expect(result?.succeeded.map((s) => s.id)).toEqual(["a", "c"]);
    expect(result?.failed.map((f) => f.id)).toEqual(["b"]);
  });

  it("resolves null when the user declined — distinguishable from an empty-but-attempted batch", async () => {
    const confirm = jest.fn().mockResolvedValue(false);
    const deleteOne = jest.fn();

    await expect(
      bulkDeleteWithConfirmation(["a"], confirm, deleteOne),
    ).resolves.toBeNull();
  });

  it("resolves null when there was nothing to delete", async () => {
    const confirm = jest.fn().mockResolvedValue(true);
    const deleteOne = jest.fn();

    await expect(
      bulkDeleteWithConfirmation([], confirm, deleteOne),
    ).resolves.toBeNull();
  });

  it("resolves the bulk result when the user confirms and something was actually attempted", async () => {
    const confirm = jest.fn().mockResolvedValue(true);
    const deleteOne = jest.fn();

    const result = await bulkDeleteWithConfirmation(["a"], confirm, deleteOne);

    expect(result).not.toBeNull();
    expect(result?.succeeded.map((s) => s.id)).toEqual(["a"]);
  });
});
