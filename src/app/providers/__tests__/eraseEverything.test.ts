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
import { eraseEverything, WIPE_RECORD_DETAIL } from "../eraseEverything";
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
    // The old files are gone. (Since 10.52 a fresh plain database is open,
    // holding only the wipe record; the mock lists a file once it's closed.)
    expect(__storedDatabaseFiles().size).toBe(0);
  });

  // Until 10.52 this created no database at all; now the only one left is a
  // fresh, unencrypted database holding just the record of the wipe.
  it("from the lock screen (nothing open): erases everything; only a fresh database with the wipe record remains", async () => {
    await turnOnAppLock(PASS, { biometrics: false });
    closeDb();
    _resetDbForTesting();

    await eraseEverything();

    expect(await isVaultConfigured()).toBe(false);
    expect(openDatabaseFile()).toBe("plain");
    expect(
      jest
        .requireActual<typeof import("@/entities/audit")>("@/entities/audit")
        .getAllAuditEntries(openDb())
        .map((e) => e.detail),
    ).toEqual([WIPE_RECORD_DETAIL]);
    expect(
      openDb().getFirstSync(
        "SELECT name FROM sqlite_master WHERE name = 'notes';",
      ),
    ).toBeNull();
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

// Tests for step 10.52 — written before implementation (TDD)
//
// The wipe's own audit entry was deleted along with the database it lived
// in, so nothing recorded that a wipe happened. Now the fresh database the
// app starts with holds exactly one entry: "Data wiped".
describe("eraseEverything leaves one record of the wipe (10.52)", () => {
  const { getAllAuditEntries } =
    jest.requireActual<typeof import("@/entities/audit")>("@/entities/audit");
  const wipedEntries = () =>
    getAllAuditEntries(openDb()).filter((e) => e.action === "wipe");

  it("the fresh database holds a single 'Data wiped' entry, and nothing else", async () => {
    await eraseEverything();
    await expect(openAtLaunch()).resolves.toEqual({ kind: "ready" });

    const entries = getAllAuditEntries(openDb());
    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual(
      expect.objectContaining({ action: "wipe", detail: WIPE_RECORD_DETAIL }),
    );
    expect(
      openDb().getFirstSync(
        "SELECT name FROM sqlite_master WHERE name = 'notes';",
      ),
    ).toBeNull();
  });

  it("also from the lock screen (app lock on, nothing open)", async () => {
    await turnOnAppLock(PASS, { biometrics: false });
    closeDb();
    expect(openDatabaseFile()).toBeNull();

    await eraseEverything();

    await expect(openAtLaunch()).resolves.toEqual({ kind: "ready" });
    expect(wipedEntries()).toHaveLength(1);
    expect(await isVaultConfigured()).toBe(false);
  });

  it("a failed wipe writes no 'Data wiped' entry", async () => {
    const deleteDbSpy = jest
      .spyOn(dbModule, "deleteDb")
      .mockImplementationOnce(() => {
        throw new Error("Unable to delete");
      });
    try {
      await expect(eraseEverything()).rejects.toThrow("Unable to delete");
    } finally {
      deleteDbSpy.mockRestore();
    }
    expect(
      getAllAuditEntries(openDb()).filter(
        (e) => e.detail === WIPE_RECORD_DETAIL,
      ),
    ).toEqual([]);
  });

  // The record says the erase finished: not while the lock's keys could
  // still be there.
  it("writes no record when forgetting the lock's keys fails", async () => {
    await turnOnAppLock(PASS, { biometrics: false });
    deleteItemAsync.mockImplementationOnce(async () => {
      throw new Error("keychain busy");
    });

    await expect(eraseEverything()).rejects.toThrow("keychain busy");

    const db = openDb();
    const hasAudit = db.getFirstSync(
      "SELECT name FROM sqlite_master WHERE name = 'audit_entries';",
    );
    const records =
      hasAudit === null
        ? []
        : getAllAuditEntries(db).filter((e) => e.detail === WIPE_RECORD_DETAIL);
    expect(records).toEqual([]);
  });

  // The erase itself succeeded; a failed log line mustn't make it look failed.
  it("still succeeds if the record can't be written", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const runSpy = jest
      .spyOn(dbModule, "runMigrations")
      .mockImplementationOnce(() => {
        throw new Error("disk full");
      });
    try {
      await expect(eraseEverything()).resolves.toBeUndefined();
      expect(warn).toHaveBeenCalledTimes(1);
    } finally {
      runSpy.mockRestore();
      warn.mockRestore();
    }
  });
});
