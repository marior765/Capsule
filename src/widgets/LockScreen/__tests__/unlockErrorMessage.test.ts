// Tests for 4.6 (lock screen messages) — written before implementation (TDD)
import { unlockErrorMessage } from "../unlockErrorMessage";

class VaultUnlockError extends Error {
  name = "VaultUnlockError";
}

describe("unlockErrorMessage", () => {
  it("a wrong passphrase says so plainly", () => {
    expect(unlockErrorMessage(new VaultUnlockError("x"), "passphrase")).toBe(
      "That passphrase didn't work.",
    );
  });

  it("a failed or cancelled biometric attempt points to the passphrase", () => {
    expect(unlockErrorMessage(new VaultUnlockError("x"), "biometrics")).toBe(
      "Biometric unlock didn't work — use your passphrase.",
    );
  });

  it("anything else (e.g. the data won't open) says the data couldn't be opened", () => {
    expect(
      unlockErrorMessage(new Error("file is not a database"), "passphrase"),
    ).toBe(
      "Your data couldn't be opened. If this keeps happening, you can erase everything and start over.",
    );
    expect(unlockErrorMessage("weird", "biometrics")).toBe(
      "Your data couldn't be opened. If this keeps happening, you can erase everything and start over.",
    );
  });
});
