export type UnlockMethod = "passphrase" | "biometrics";

/**
 * What the lock screen says when an unlock fails. A `VaultUnlockError`
 * (matched by name — widgets don't import the error class from the
 * feature's internals) means the passphrase or biometric check failed;
 * anything else means the key was accepted but the data wouldn't open.
 */
export function unlockErrorMessage(
  error: unknown,
  method: UnlockMethod,
): string {
  if (error instanceof Error && error.name === "VaultUnlockError") {
    return method === "passphrase"
      ? "That passphrase didn't work."
      : "Biometric unlock didn't work — use your passphrase.";
  }
  return "Your data couldn't be opened. If this keeps happening, you can erase everything and start over.";
}
