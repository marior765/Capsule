import {
  hasHardwareAsync,
  isEnrolledAsync,
  authenticateAsync,
} from "expo-local-authentication";

/**
 * "features/app-lock — biometric / passphrase gate on launch & resume"
 * (docs/DEVELOPMENT_PLAN.md 4.2).
 *
 * `features/encrypt-vault` owns actually verifying a passphrase
 * (`unlockVault`) — but this module can't import it: docs/ARCHITECTURE.md
 * forbids same-layer cross-slice imports, and `features/` has no other
 * feature importing another feature anywhere in this repo (verified via
 * `grep -rn "from ['\"]@/features/" src/features` — empty). Instead,
 * `createAppLock` takes passphrase verification as an injected function —
 * the same dependency-injection shape `features/voice-input`'s
 * `createVoiceInputController` already uses for `getSttContext`, so a
 * cross-feature composition never has to become a cross-feature import. The
 * real lock/unlock state machine, the biometric-vs-passphrase orchestration,
 * and the re-lock-on-`lock()` behavior all live here, testable without
 * rendering (CLAUDE.md: "LLM and capsule operations must be testable
 * without rendering" — the same principle applies to the auth gate).
 *
 * What's still follow-on, not part of this module: a provider that (a)
 * supplies the concrete `authenticateWithPassphrase` (wrapping
 * `encrypt-vault`'s `unlockVault`), (b) subscribes an `AppState` listener
 * to call `lock()` on background/resume, and (c) renders a lock screen
 * while `getState() === "locked"`. See .claude/loop/BLOCKED.md.
 */

export type BiometricAuthResult =
  | { success: true }
  | { success: false; error: string };

export type PassphraseAuthResult =
  | { success: true }
  | { success: false; error: string };

export type PassphraseAuthenticator = (
  passphrase: string,
) => Promise<PassphraseAuthResult>;

const DEFAULT_PROMPT_MESSAGE = "Unlock Capsule";

/**
 * Whether biometric authentication can actually be attempted right now —
 * both hardware present *and* something enrolled to check against. Skips
 * the enrollment check entirely when there's no hardware at all, since
 * asking the OS "is anything enrolled" on a device with no sensor is a
 * wasted round trip with only one possible answer.
 */
export async function isBiometricAvailable(): Promise<boolean> {
  const hasHardware = await hasHardwareAsync();
  if (!hasHardware) {
    return false;
  }
  return isEnrolledAsync();
}

/**
 * Attempts biometric authentication. Never throws for an expected outcome —
 * a user cancel, a failed scan, lockout, and "not available" are all just
 * `{ success: false, error }`; callers decide what to do next (retry, fall
 * back to a passphrase, show a specific message per error code).
 */
export async function authenticateWithBiometrics(
  promptMessage: string = DEFAULT_PROMPT_MESSAGE,
): Promise<BiometricAuthResult> {
  const result = await authenticateAsync({ promptMessage });
  if (result.success) {
    return { success: true };
  }
  return { success: false, error: result.error };
}

export type AppLockState = "locked" | "unlocked";

export type AppLockController = {
  getState: () => AppLockState;
  subscribe: (listener: (state: AppLockState) => void) => () => void;
  /** Re-locks the app — call from an AppState listener on background/resume. */
  lock: () => void;
  unlockWithBiometrics: (
    promptMessage?: string,
  ) => Promise<BiometricAuthResult>;
  unlockWithPassphrase: (passphrase: string) => Promise<PassphraseAuthResult>;
};

export type CreateAppLockOptions = {
  authenticateWithPassphrase: PassphraseAuthenticator;
};

/**
 * The gate itself: a small state machine starting `"locked"` (a fresh
 * launch is gated by default — nobody has to remember to lock it), with two
 * independent ways to unlock and one way to re-lock. Subscribers are only
 * notified on an actual state transition, never on a no-op `lock()` or a
 * failed unlock attempt — a UI reacting to this shouldn't have to
 * de-duplicate spurious notifications itself.
 */
export function createAppLock(
  options: CreateAppLockOptions,
): AppLockController {
  let state: AppLockState = "locked";
  const listeners = new Set<(state: AppLockState) => void>();

  function setState(next: AppLockState): void {
    if (state === next) {
      return;
    }
    state = next;
    for (const listener of listeners) {
      listener(state);
    }
  }

  return {
    getState: () => state,

    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    lock: () => {
      setState("locked");
    },

    unlockWithBiometrics: async (promptMessage) => {
      const result = await authenticateWithBiometrics(promptMessage);
      if (result.success) {
        setState("unlocked");
      }
      return result;
    },

    unlockWithPassphrase: async (passphrase) => {
      const result = await options.authenticateWithPassphrase(passphrase);
      if (result.success) {
        setState("unlocked");
      }
      return result;
    },
  };
}
