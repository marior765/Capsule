// Tests for step 10.51 — written before implementation (TDD). "hard" depth.
//
// On Android, turning app lock on with biometrics shows a fingerprint prompt
// when the key copy is saved. Cancelling it silently turned the lock on
// without biometrics. turnOnAppLock now reports whether biometric unlock was
// actually set up, so the screen can say so.
import { clearAllSettings } from "@/shared/storage";
import {
  __resetSecureStoreMock,
  setItemAsync,
} from "@/__mocks__/expo-secure-store";
import { __resetSqliteMock } from "@/__mocks__/expo-sqlite";
import { _resetDbForTesting, openDb, runMigrations } from "@/shared/db";
import * as db from "@/shared/db";
import { auditMigration } from "@/entities/audit";
import {
  hasBiometricUnlock,
  isVaultConfigured,
  LeftoverCopyError,
  turnOnAppLock,
} from "../index";

const PASS = "correct horse battery staple";

beforeEach(() => {
  clearAllSettings();
  __resetSecureStoreMock();
  __resetSqliteMock();
  _resetDbForTesting();
  runMigrations(openDb(), [auditMigration]);
});

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

describe("turnOnAppLock reports whether biometrics were set up (10.51)", () => {
  it("says yes when the biometric copy was saved", async () => {
    await expect(turnOnAppLock(PASS, { biometrics: true })).resolves.toEqual({
      biometricsSetUp: true,
    });
    expect(await hasBiometricUnlock()).toBe(true);
  });

  it("says no when the prompt was cancelled; the lock is still on", async () => {
    const result = await withBiometricWritesRefused(() =>
      turnOnAppLock(PASS, { biometrics: true }),
    );
    expect(result).toEqual({ biometricsSetUp: false });
    expect(await isVaultConfigured()).toBe(true);
    expect(await hasBiometricUnlock()).toBe(false);
  });

  it("says no when biometrics weren't asked for", async () => {
    await expect(turnOnAppLock(PASS, { biometrics: false })).resolves.toEqual({
      biometricsSetUp: false,
    });
  });

  // The leftover-copy error is thrown after the biometric step; it must not
  // hide that biometrics weren't set up.
  it("says so in the leftover-copy message too", async () => {
    const spy = jest
      .spyOn(db, "deleteDatabaseFile")
      .mockImplementation((file) => {
        if (file === "plain") throw new Error("busy");
        return jest
          .requireActual<typeof db>("@/shared/db")
          .deleteDatabaseFile(file);
      });
    try {
      const error = await withBiometricWritesRefused(() =>
        turnOnAppLock(PASS, { biometrics: true }).catch((e: unknown) => e),
      );
      expect(error).toBeInstanceOf(LeftoverCopyError);
      expect((error as Error).message).toMatch(
        /Face ID \/ fingerprint wasn't set up/,
      );
      expect((error as Error).message).toMatch(
        /"Set up Face ID \/ fingerprint" in Privacy/,
      );
    } finally {
      spy.mockRestore();
    }
  });

  it("adds no note to the leftover-copy message when biometrics were set up", async () => {
    const spy = jest
      .spyOn(db, "deleteDatabaseFile")
      .mockImplementation((file) => {
        if (file === "plain") throw new Error("busy");
        return jest
          .requireActual<typeof db>("@/shared/db")
          .deleteDatabaseFile(file);
      });
    try {
      const error = await turnOnAppLock(PASS, { biometrics: true }).catch(
        (e: unknown) => e,
      );
      expect(error).toBeInstanceOf(LeftoverCopyError);
      expect((error as Error).message).not.toMatch(/Face ID/);
    } finally {
      spy.mockRestore();
    }
  });
});
