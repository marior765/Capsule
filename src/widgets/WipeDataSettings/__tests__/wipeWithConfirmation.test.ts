// Tests for step 4.4 — written before implementation (TDD).
// 4.7: the erase itself is injected (the app's one erase-everything), so
// there is no database argument any more.
import { wipeWithConfirmation } from "../wipeWithConfirmation";

describe("wipeWithConfirmation", () => {
  it("calls erase when the user confirms", async () => {
    const confirm = jest.fn().mockResolvedValue(true);
    const erase = jest.fn().mockResolvedValue(undefined);

    await wipeWithConfirmation(confirm, erase);

    expect(erase).toHaveBeenCalledTimes(1);
  });

  it("does not call erase when the user declines", async () => {
    const confirm = jest.fn().mockResolvedValue(false);
    const erase = jest.fn().mockResolvedValue(undefined);

    await wipeWithConfirmation(confirm, erase);

    expect(erase).not.toHaveBeenCalled();
  });

  it("resolves true when the erase actually ran", async () => {
    const confirm = jest.fn().mockResolvedValue(true);
    const erase = jest.fn().mockResolvedValue(undefined);

    await expect(wipeWithConfirmation(confirm, erase)).resolves.toBe(true);
  });

  it("resolves false when the user declined — never called erase, not a failure", async () => {
    const confirm = jest.fn().mockResolvedValue(false);
    const erase = jest.fn().mockResolvedValue(undefined);

    await expect(wipeWithConfirmation(confirm, erase)).resolves.toBe(false);
  });

  it("propagates a rejection from erase rather than swallowing it", async () => {
    const confirm = jest.fn().mockResolvedValue(true);
    const erase = jest.fn().mockRejectedValue(new Error("disk error"));

    await expect(wipeWithConfirmation(confirm, erase)).rejects.toThrow(
      "disk error",
    );
  });
});
