export type PassphraseSetupError = "empty" | "mismatch";

/**
 * Pure validation for the "set up a passphrase" form — kept separate from
 * the widget so it's testable without rendering, mirroring
 * VoiceRecordButton's holdGesture.ts / ChatBubble's prepareCodeForCopy.ts.
 * Checks emptiness before mismatch: an empty/empty pair is "empty", not a
 * (trivially true) match — an empty passphrase is never acceptable
 * regardless of what it's compared against.
 */
export function validatePassphraseSetup(
  passphrase: string,
  confirmation: string,
): PassphraseSetupError | null {
  if (!passphrase.trim()) {
    return "empty";
  }
  if (passphrase !== confirmation) {
    return "mismatch";
  }
  return null;
}
