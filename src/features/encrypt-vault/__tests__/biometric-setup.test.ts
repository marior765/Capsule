// Tests for step 10.50 — written before implementation (TDD). "hard" depth:
// it handles the vault's master key.
//
// When the OS invalidates the biometric copy of the key (a new face or
// fingerprint enrolled), biometric unlock kept failing until the lock was
// turned off and on again. setUpBiometricUnlock(passphrase) stores a fresh
// biometric copy (or a first one, for a lock turned on without biometrics).
import { clearAllSettings } from "@/shared/storage";
import {
  __resetSecureStoreMock,
  deleteItemAsync,
  setItemAsync,
} from "@/__mocks__/expo-secure-store";
import { __resetSqliteMock } from "@/__mocks__/expo-sqlite";
import { _resetDbForTesting, openDb, runMigrations } from "@/shared/db";
import { auditMigration, getAllAuditEntries } from "@/entities/audit";
import {
  BiometricSetupError,
  hasBiometricUnlock,
  setUpBiometricUnlock,
  turnOnAppLock,
  unlockVault,
  unlockVaultWithBiometrics,
  VaultUnlockError,
} from "../index";

const PASS = "correct horse battery staple";
const BIOMETRIC_KEY = "encryptVault.biometricMasterKey";

beforeEach(() => {
  clearAllSettings();
  __resetSecureStoreMock();
  __resetSqliteMock();
  _resetDbForTesting();
  runMigrations(openDb(), [auditMigration]);
});

/** Makes the OS refuse to store a biometric-protected item. */
async function withBiometricWritesRefused<T>(work: () => Promise<T>) {
  const original = setItemAsync.getMockImplementation()!;
  setItemAsync.mockImplementation(
    async (key: string, value: string, options?: unknown) => {
      if (
        (options as { requireAuthentication?: boolean } | undefined)
          ?.requireAuthentication
      ) {
        throw new Error("User canceled");
      }
      return original(key, value);
    },
  );
  try {
    return await work();
  } finally {
    setItemAsync.mockImplementation(original);
  }
}

describe("setUpBiometricUnlock (10.50)", () => {
  it("restores biometric unlock after the OS invalidated the key copy", async () => {
    await turnOnAppLock(PASS, { biometrics: true });
    const masterKey = await unlockVault(PASS);
    // The OS drops the protected item when a new face/finger is enrolled.
    await deleteItemAsync(BIOMETRIC_KEY);
    await expect(unlockVaultWithBiometrics()).rejects.toThrow(VaultUnlockError);

    await setUpBiometricUnlock(PASS);

    await expect(unlockVaultWithBiometrics()).resolves.toBe(masterKey);
    expect(await hasBiometricUnlock()).toBe(true);
  });

  it("stores the new key copy only behind biometrics (requireAuthentication)", async () => {
    await turnOnAppLock(PASS, { biometrics: false });
    setItemAsync.mockClear();

    await setUpBiometricUnlock(PASS);

    const keyWrites = setItemAsync.mock.calls.filter(
      (call) => call[0] === BIOMETRIC_KEY,
    );
    expect(keyWrites).toHaveLength(1);
    expect(keyWrites[0][2]).toEqual(
      expect.objectContaining({ requireAuthentication: true }),
    );
  });

  it("sets up biometric unlock for a lock that was turned on without it", async () => {
    await turnOnAppLock(PASS, { biometrics: false });
    expect(await hasBiometricUnlock()).toBe(false);

    await setUpBiometricUnlock(PASS);

    expect(await hasBiometricUnlock()).toBe(true);
    await expect(unlockVaultWithBiometrics()).resolves.toBe(
      await unlockVault(PASS),
    );
  });

  it("refuses a wrong passphrase and changes nothing", async () => {
    await turnOnAppLock(PASS, { biometrics: false });
    setItemAsync.mockClear();

    await expect(setUpBiometricUnlock("wrong")).rejects.toThrow(
      VaultUnlockError,
    );
    expect(setItemAsync).not.toHaveBeenCalled();
    expect(await hasBiometricUnlock()).toBe(false);
  });

  it("refuses while app lock is off", async () => {
    await expect(setUpBiometricUnlock(PASS)).rejects.toThrow(VaultUnlockError);
  });

  it("when the OS refuses (prompt cancelled), says so and leaves biometrics off", async () => {
    await turnOnAppLock(PASS, { biometrics: true });
    await deleteItemAsync(BIOMETRIC_KEY);

    await withBiometricWritesRefused(async () => {
      await expect(setUpBiometricUnlock(PASS)).rejects.toThrow(
        BiometricSetupError,
      );
    });
    // No flag claiming biometrics work while the key copy is missing.
    expect(await hasBiometricUnlock()).toBe(false);
    // The passphrase still unlocks.
    await expect(unlockVault(PASS)).resolves.toBeTruthy();
  });

  it("logs that biometric unlock was set up", async () => {
    await turnOnAppLock(PASS, { biometrics: false });
    await setUpBiometricUnlock(PASS);
    const details = getAllAuditEntries(openDb()).map((e) => e.detail);
    expect(details).toContain("Face ID / fingerprint unlock set up");
  });
});

describe("setUpBiometricUnlock — a failed audit write (10.50)", () => {
  it("still reports success, and warns locally", async () => {
    await turnOnAppLock(PASS, { biometrics: false });
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    openDb().execSync("DROP TABLE audit_entries;");
    try {
      await expect(setUpBiometricUnlock(PASS)).resolves.toBeUndefined();
      expect(await hasBiometricUnlock()).toBe(true);
      expect(warn).toHaveBeenCalledTimes(1);
    } finally {
      warn.mockRestore();
    }
  });
});
