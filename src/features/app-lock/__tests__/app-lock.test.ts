// Tests for step 4.2 — written before implementation (TDD)
//
// Scope note: features/app-lock cannot import features/encrypt-vault
// directly (docs/ARCHITECTURE.md forbids same-layer cross-slice imports —
// verified via `grep -rn "from ['\"]@/features/" src/features`, empty
// everywhere in this repo). Passphrase verification is therefore injected
// as a function — the same dependency-injection pattern voice-input already
// uses for getSttContext — so the real gate/fallback/lock-state logic still
// lives here, testable without rendering, and a future provider only has to
// supply the concrete `unlockVault` wrapper plus mount an AppState listener
// and a lock-screen UI. See BLOCKED.md for that remaining wiring.
import { isEnrolledAsync, authenticateAsync } from "expo-local-authentication";
import {
  __resetLocalAuthMock,
  __setHasHardware,
  __setEnrolled,
  __setNextAuthResult,
} from "@/__mocks__/expo-local-authentication";
import {
  isBiometricAvailable,
  authenticateWithBiometrics,
  createAppLock,
  type PassphraseAuthenticator,
} from "../index";

beforeEach(() => {
  __resetLocalAuthMock();
});

describe("isBiometricAvailable", () => {
  it("is true when hardware exists and biometrics are enrolled", async () => {
    await expect(isBiometricAvailable()).resolves.toBe(true);
  });

  it("is false when there is no biometric hardware", async () => {
    __setHasHardware(false);
    await expect(isBiometricAvailable()).resolves.toBe(false);
  });

  it("is false when hardware exists but nothing is enrolled", async () => {
    __setEnrolled(false);
    await expect(isBiometricAvailable()).resolves.toBe(false);
  });

  it("does not check enrollment when there is no hardware at all", async () => {
    __setHasHardware(false);
    await isBiometricAvailable();
    expect(isEnrolledAsync).not.toHaveBeenCalled();
  });
});

describe("authenticateWithBiometrics", () => {
  it("resolves with success when the OS reports success", async () => {
    await expect(authenticateWithBiometrics()).resolves.toEqual({
      success: true,
    });
  });

  it("resolves with the failure reason when the OS reports failure — never throws", async () => {
    __setNextAuthResult({ success: false, error: "user_cancel" });
    await expect(authenticateWithBiometrics()).resolves.toEqual({
      success: false,
      error: "user_cancel",
    });
  });

  it("passes a prompt message through to the OS", async () => {
    await authenticateWithBiometrics("Unlock your vault");
    expect(authenticateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ promptMessage: "Unlock your vault" }),
    );
  });

  it("uses a non-empty default prompt message when none is given", async () => {
    await authenticateWithBiometrics();
    const options = (authenticateAsync as jest.Mock).mock.calls[0][0] as {
      promptMessage: string;
    };
    expect(typeof options.promptMessage).toBe("string");
    expect(options.promptMessage.length).toBeGreaterThan(0);
  });
});

function successAuthenticator(): PassphraseAuthenticator {
  return jest.fn(async () => ({ success: true as const }));
}

function failingAuthenticator(error: string): PassphraseAuthenticator {
  return jest.fn(async () => ({ success: false as const, error }));
}

describe("createAppLock — initial state", () => {
  it("starts locked — a fresh app launch is gated by default", () => {
    const lock = createAppLock({
      authenticateWithPassphrase: successAuthenticator(),
    });
    expect(lock.getState()).toBe("locked");
  });
});

describe("createAppLock — unlockWithBiometrics", () => {
  it("transitions to unlocked on biometric success", async () => {
    const lock = createAppLock({
      authenticateWithPassphrase: successAuthenticator(),
    });
    await lock.unlockWithBiometrics();
    expect(lock.getState()).toBe("unlocked");
  });

  it("stays locked on biometric failure", async () => {
    __setNextAuthResult({ success: false, error: "user_cancel" });
    const lock = createAppLock({
      authenticateWithPassphrase: successAuthenticator(),
    });
    await lock.unlockWithBiometrics();
    expect(lock.getState()).toBe("locked");
  });

  it("returns the same BiometricAuthResult authenticateWithBiometrics would", async () => {
    const lock = createAppLock({
      authenticateWithPassphrase: successAuthenticator(),
    });
    await expect(lock.unlockWithBiometrics()).resolves.toEqual({
      success: true,
    });
  });
});

describe("createAppLock — unlockWithPassphrase", () => {
  it("calls the injected authenticator with the exact passphrase given", async () => {
    const authenticator = successAuthenticator();
    const lock = createAppLock({ authenticateWithPassphrase: authenticator });
    await lock.unlockWithPassphrase("hunter2");
    expect(authenticator).toHaveBeenCalledWith("hunter2");
  });

  it("transitions to unlocked when the injected authenticator succeeds", async () => {
    const lock = createAppLock({
      authenticateWithPassphrase: successAuthenticator(),
    });
    await lock.unlockWithPassphrase("hunter2");
    expect(lock.getState()).toBe("unlocked");
  });

  it("stays locked and surfaces the failure when the injected authenticator fails", async () => {
    const lock = createAppLock({
      authenticateWithPassphrase: failingAuthenticator("wrong passphrase"),
    });
    await expect(lock.unlockWithPassphrase("nope")).resolves.toEqual({
      success: false,
      error: "wrong passphrase",
    });
    expect(lock.getState()).toBe("locked");
  });

  it("never calls the biometric API — passphrase and biometric are independent paths", async () => {
    const lock = createAppLock({
      authenticateWithPassphrase: successAuthenticator(),
    });
    await lock.unlockWithPassphrase("hunter2");
    expect(authenticateAsync).not.toHaveBeenCalled();
  });
});

describe("createAppLock — lock", () => {
  it("re-locks an unlocked app — the resume-gate behavior", async () => {
    const lock = createAppLock({
      authenticateWithPassphrase: successAuthenticator(),
    });
    await lock.unlockWithBiometrics();
    expect(lock.getState()).toBe("unlocked");
    lock.lock();
    expect(lock.getState()).toBe("locked");
  });

  it("is a no-op when already locked — does not spuriously notify subscribers", () => {
    const lock = createAppLock({
      authenticateWithPassphrase: successAuthenticator(),
    });
    const listener = jest.fn();
    lock.subscribe(listener);
    lock.lock();
    expect(listener).not.toHaveBeenCalled();
  });
});

describe("createAppLock — subscribe", () => {
  it("notifies a subscriber with the new state on unlock", async () => {
    const lock = createAppLock({
      authenticateWithPassphrase: successAuthenticator(),
    });
    const listener = jest.fn();
    lock.subscribe(listener);
    await lock.unlockWithBiometrics();
    expect(listener).toHaveBeenCalledWith("unlocked");
  });

  it("notifies a subscriber with the new state on lock", async () => {
    const lock = createAppLock({
      authenticateWithPassphrase: successAuthenticator(),
    });
    await lock.unlockWithBiometrics();
    const listener = jest.fn();
    lock.subscribe(listener);
    lock.lock();
    expect(listener).toHaveBeenCalledWith("locked");
  });

  it("does not notify on a failed unlock attempt — state didn't actually change", async () => {
    __setNextAuthResult({ success: false, error: "user_cancel" });
    const lock = createAppLock({
      authenticateWithPassphrase: successAuthenticator(),
    });
    const listener = jest.fn();
    lock.subscribe(listener);
    await lock.unlockWithBiometrics();
    expect(listener).not.toHaveBeenCalled();
  });

  it("stops notifying after unsubscribe", async () => {
    const lock = createAppLock({
      authenticateWithPassphrase: successAuthenticator(),
    });
    const listener = jest.fn();
    const unsubscribe = lock.subscribe(listener);
    unsubscribe();
    await lock.unlockWithBiometrics();
    expect(listener).not.toHaveBeenCalled();
  });

  it("notifies every subscriber independently", async () => {
    const lock = createAppLock({
      authenticateWithPassphrase: successAuthenticator(),
    });
    const listenerA = jest.fn();
    const listenerB = jest.fn();
    lock.subscribe(listenerA);
    lock.subscribe(listenerB);
    await lock.unlockWithBiometrics();
    expect(listenerA).toHaveBeenCalledWith("unlocked");
    expect(listenerB).toHaveBeenCalledWith("unlocked");
  });
});
