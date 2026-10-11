// Tests for 4.6 (app lock at launch) — written before implementation (TDD).
// The non-React core of the launch gate: which database opens, when, and
// which stale copy may be cleaned up.
import { clearAllSettings } from "@/shared/storage";
import { __resetSecureStoreMock } from "@/__mocks__/expo-secure-store";
import {
  __resetSqliteMock,
  __storedDatabaseFiles,
} from "@/__mocks__/expo-sqlite";
import {
  _resetDbForTesting,
  closeDb,
  DATABASE_FILES,
  openDatabaseFile,
  openDb,
  runMigrations,
} from "@/shared/db";
import { auditMigration } from "@/entities/audit";
import {
  LeftoverCopyError,
  turnOnAppLock,
  unlockVault,
} from "@/features/encrypt-vault";
import { deleteDatabaseSync } from "expo-sqlite";
import { openAtLaunch, openUnlocked } from "../launchDatabase";

const PASS = "correct horse battery staple";

beforeEach(() => {
  clearAllSettings();
  __resetSecureStoreMock();
  __resetSqliteMock();
  _resetDbForTesting();
});

async function lockedVaultWithNote(): Promise<string> {
  const db = openDb();
  runMigrations(db, [auditMigration]);
  db.execSync("CREATE TABLE notes (body TEXT);");
  db.runSync("INSERT INTO notes (body) VALUES (?);", "secret");
  await turnOnAppLock(PASS, { biometrics: false });
  closeDb(); // the app restarts
  return unlockVault(PASS);
}

describe("openAtLaunch", () => {
  it("with no lock: opens the plain database, migrated, and the app can start", async () => {
    await expect(openAtLaunch()).resolves.toEqual({ kind: "ready" });
    expect(openDatabaseFile()).toBe("plain");
    expect(
      openDb().getFirstSync(
        "SELECT name FROM sqlite_master WHERE name = 'conversations';",
      ),
    ).not.toBeNull();
  });

  it("with the lock on: opens nothing and asks for an unlock", async () => {
    await lockedVaultWithNote();
    await expect(openAtLaunch()).resolves.toEqual({ kind: "locked" });
    expect(openDatabaseFile()).toBeNull();
  });

  it("with no lock: removes a stale encrypted file left by an interrupted turn-off", async () => {
    const key = await lockedVaultWithNote();
    // Simulate: turn-off finished (keys forgotten, plain written) but crashed
    // before deleting the vault file.
    openDb({ key });
    closeDb();
    __resetSecureStoreMock();
    expect(__storedDatabaseFiles().has(DATABASE_FILES.vault)).toBe(true);

    await openAtLaunch();
    expect(__storedDatabaseFiles().has(DATABASE_FILES.vault)).toBe(false);
  });
});

describe("openUnlocked", () => {
  it("opens the encrypted database with the key, migrated, with the user's data", async () => {
    const key = await lockedVaultWithNote();
    openUnlocked(key);
    expect(openDatabaseFile()).toBe("vault");
    expect(openDb().getAllSync("SELECT body FROM notes;")).toEqual([
      { body: "secret" },
    ]);
    expect(
      openDb().getFirstSync(
        "SELECT name FROM sqlite_master WHERE name = 'capsules';",
      ),
    ).not.toBeNull();
  });

  it("removes a plain copy marked stale (turn-on couldn't delete it) once the encrypted one opened", async () => {
    const db = openDb();
    runMigrations(db, [auditMigration]);
    db.execSync("CREATE TABLE notes (body TEXT);");
    db.runSync("INSERT INTO notes (body) VALUES (?);", "secret");
    const original = (deleteDatabaseSync as jest.Mock).getMockImplementation()!;
    (deleteDatabaseSync as jest.Mock).mockImplementation((name: string) => {
      if (name === DATABASE_FILES.plain) throw new Error("Unable to delete");
      return original(name);
    });
    try {
      await expect(turnOnAppLock(PASS, { biometrics: false })).rejects.toThrow(
        LeftoverCopyError,
      );
    } finally {
      (deleteDatabaseSync as jest.Mock).mockImplementation(original);
    }
    closeDb();
    expect(__storedDatabaseFiles().has(DATABASE_FILES.plain)).toBe(true);

    openUnlocked(await unlockVault(PASS));
    expect(__storedDatabaseFiles().has(DATABASE_FILES.plain)).toBe(false);
  });

  it("keeps a plain file nothing marks as stale — it may hold newer data", async () => {
    const key = await lockedVaultWithNote();
    // e.g. a wipe with the lock on recreated plain and the user kept writing
    openDb().execSync("CREATE TABLE newer (x INTEGER);");
    closeDb();

    openUnlocked(key);
    expect(__storedDatabaseFiles().has(DATABASE_FILES.plain)).toBe(true);
  });

  it("keeps even a marked plain file when the encrypted file turns out empty (missing)", async () => {
    const db = openDb();
    runMigrations(db, [auditMigration]);
    const original = (deleteDatabaseSync as jest.Mock).getMockImplementation()!;
    (deleteDatabaseSync as jest.Mock).mockImplementation((name: string) => {
      if (name === DATABASE_FILES.plain) throw new Error("Unable to delete");
      return original(name);
    });
    try {
      await turnOnAppLock(PASS, { biometrics: false }).catch(() => undefined);
    } finally {
      (deleteDatabaseSync as jest.Mock).mockImplementation(original);
    }
    closeDb();
    (deleteDatabaseSync as jest.Mock)(DATABASE_FILES.vault); // the encrypted file is gone

    const key = await unlockVault(PASS);
    openUnlocked(key);
    expect(__storedDatabaseFiles().has(DATABASE_FILES.plain)).toBe(true);
    // ...and on every later unlock too: the plain file is no longer
    // provably stale once the encrypted one turned out empty.
    closeDb();
    openUnlocked(key);
    expect(__storedDatabaseFiles().has(DATABASE_FILES.plain)).toBe(true);
  });

  it("with a key that doesn't open the file: throws, closes, and keeps the plain copy", async () => {
    await lockedVaultWithNote();
    openDb().execSync("CREATE TABLE leftover (x INTEGER);");
    closeDb();

    expect(() => openUnlocked("00".repeat(32))).toThrow();
    expect(openDatabaseFile()).toBeNull();
    expect(__storedDatabaseFiles().has(DATABASE_FILES.plain)).toBe(true);
  });
});
