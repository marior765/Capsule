// Tests for 4.7 (one "erase everything") — written before implementation (TDD).
// Wipe-all-data and the lock screen's "forgot passphrase" path share this.
import { clearAllSettings, getString, setString } from "@/shared/storage";
import {
  __resetSecureStoreMock,
  deleteItemAsync,
} from "@/__mocks__/expo-secure-store";
import {
  __resetSqliteMock,
  __storedDatabaseFiles,
} from "@/__mocks__/expo-sqlite";
import {
  __scheduled,
  __resetNotificationsMock,
} from "@/__mocks__/expo-notifications";
import * as dbModule from "@/shared/db";
import {
  _resetDbForTesting,
  closeDb,
  openDatabaseFile,
  openDb,
  runMigrations,
} from "@/shared/db";
import { auditMigration } from "@/entities/audit";
import { scheduleLocalNotification } from "@/shared/notifications";
import {
  hasBiometricUnlock,
  isVaultConfigured,
  turnOnAppLock,
} from "@/features/encrypt-vault";
import { eraseEverything } from "../eraseEverything";
import { openAtLaunch } from "../launchDatabase";

const PASS = "correct horse battery staple";

beforeEach(() => {
  clearAllSettings();
  __resetSecureStoreMock();
  __resetSqliteMock();
  __resetNotificationsMock();
  _resetDbForTesting();
  const db = openDb();
  runMigrations(db, [auditMigration]);
  db.execSync("CREATE TABLE notes (body TEXT);");
  db.runSync("INSERT INTO notes (body) VALUES (?);", "secret");
});

describe("eraseEverything", () => {
  it("with the lock on and unlocked: erases data, files, settings, reminders and the lock itself", async () => {
    await turnOnAppLock(PASS, { biometrics: true });
    setString("someSetting", "x");
    await scheduleLocalNotification({
      title: "Reminder",
      body: "b",
      at: Date.now() + 60_000,
    });

    await eraseEverything();

    expect(await isVaultConfigured()).toBe(false);
    expect(await hasBiometricUnlock()).toBe(false);
    expect(getString("someSetting")).toBeUndefined();
    expect(__scheduled.size).toBe(0);
    expect(__storedDatabaseFiles().size).toBe(0);
  });

  it("from the lock screen (nothing open): erases everything without creating a database", async () => {
    await turnOnAppLock(PASS, { biometrics: false });
    closeDb();
    _resetDbForTesting();

    await eraseEverything();

    expect(await isVaultConfigured()).toBe(false);
    expect(openDatabaseFile()).toBeNull();
    expect(__storedDatabaseFiles().size).toBe(0);
  });

  it("afterwards the app starts fresh and unlocked, with an empty database", async () => {
    await turnOnAppLock(PASS, { biometrics: false });
    await eraseEverything();

    await expect(openAtLaunch()).resolves.toEqual({ kind: "ready" });
    expect(
      openDb().getFirstSync(
        "SELECT name FROM sqlite_master WHERE name = 'notes';",
      ),
    ).toBeNull();
  });

  it("forgets the lock's keys only after the data is gone — a failed wipe leaves the lock guarding what's left", async () => {
    await turnOnAppLock(PASS, { biometrics: false });
    const deleteDbSpy = jest
      .spyOn(dbModule, "deleteDb")
      .mockImplementationOnce(() => {
        throw new Error("Unable to delete the database file");
      });
    try {
      await expect(eraseEverything()).rejects.toThrow("Unable to delete");
    } finally {
      deleteDbSpy.mockRestore();
    }
    expect(await isVaultConfigured()).toBe(true);
    expect(deleteItemAsync).not.toHaveBeenCalled();
  });
});
