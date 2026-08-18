// Tests for step 4.4 — written before implementation (TDD)
import { wipeWithConfirmation } from "../wipeWithConfirmation";

describe("wipeWithConfirmation", () => {
  it("calls wipe when the user confirms", async () => {
    const confirm = jest.fn().mockResolvedValue(true);
    const wipe = jest.fn().mockResolvedValue(undefined);
    const db = {} as never;

    await wipeWithConfirmation(db, confirm, wipe);

    expect(wipe).toHaveBeenCalledWith(db);
  });

  it("does not call wipe when the user declines", async () => {
    const confirm = jest.fn().mockResolvedValue(false);
    const wipe = jest.fn().mockResolvedValue(undefined);

    await wipeWithConfirmation({} as never, confirm, wipe);

    expect(wipe).not.toHaveBeenCalled();
  });

  it("resolves true when the wipe actually ran", async () => {
    const confirm = jest.fn().mockResolvedValue(true);
    const wipe = jest.fn().mockResolvedValue(undefined);

    await expect(
      wipeWithConfirmation({} as never, confirm, wipe),
    ).resolves.toBe(true);
  });

  it("resolves false when the user declined — never called wipe, not a failure", async () => {
    const confirm = jest.fn().mockResolvedValue(false);
    const wipe = jest.fn().mockResolvedValue(undefined);

    await expect(
      wipeWithConfirmation({} as never, confirm, wipe),
    ).resolves.toBe(false);
  });

  it("propagates a rejection from wipe rather than swallowing it", async () => {
    const confirm = jest.fn().mockResolvedValue(true);
    const wipe = jest.fn().mockRejectedValue(new Error("disk error"));

    await expect(
      wipeWithConfirmation({} as never, confirm, wipe),
    ).rejects.toThrow("disk error");
  });
});
