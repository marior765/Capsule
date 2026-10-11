// Tests for 4.6 (app lock at launch: turning the lock on and off, biometric
// unlock) — written before implementation (TDD). "hard" depth: crypto +
// moving the whole database between files.
import { clearAllSettings } from "@/shared/storage";
import {
  __resetSecureStoreMock,
  setItemAsync,
  getItemAsync,
  deleteItemAsync,
} from "@/__mocks__/expo-secure-store";
import { deleteDatabaseSync } from "expo-sqlite";
import {
  __resetSqliteMock,
  __storedDatabaseFiles,
} from "@/__mocks__/expo-sqlite";
import {
  _resetDbForTesting,
  closeDb,
  DATABASE_FILES,
  openDb,
  openDatabaseFile,
  runMigrations,
} from "@/shared/db";
import { auditMigration, getAllAuditEntries } from "@/entities/audit";
import {
  hasBiometricUnlock,
  isVaultConfigured,
  turnOffAppLock,
  turnOnAppLock,
  unlockVault,
  unlockVaultWithBiometrics,
  VaultUnlockError,
  LeftoverCopyError,
  resetVault,
  isPlainCopyStale,
} from "../index";

const PASS = "correct horse battery staple";

function seedPlainDb() {
  const db = openDb();
  runMigrations(db, [auditMigration]);
  db.execSync("CREATE TABLE notes (body TEXT);");
  db.runSync("INSERT INTO notes (body) VALUES (?);", "my secret note");
}

const notes = () =>
  (openDb().getAllSync("SELECT body FROM notes;") as { body: string }[]).map(
    (r) => r.body,
  );

beforeEach(() => {
  clearAllSettings();
  __resetSecureStoreMock();
  __resetSqliteMock();
  _resetDbForTesting();
  seedPlainDb();
});

describe("turnOnAppLock", () => {
  it("moves every row into the encrypted file, readable only with the vault key", async () => {
    await turnOnAppLock(PASS, { biometrics: false });

    expect(await isVaultConfigured()).toBe(true);
    closeDb();
    const key = await unlockVault(PASS);
    openDb({ key });
    expect(notes()).toEqual(["my secret note"]);
    expect(__storedDatabaseFiles().get(DATABASE_FILES.vault)?.key).toBe(key);
  });

  it("deletes the plain file once the encrypted copy is verified", async () => {
    await turnOnAppLock(PASS, { biometrics: false });
    expect(__storedDatabaseFiles().has(DATABASE_FILES.plain)).toBe(false);
  });

  it("leaves the encrypted database open for the rest of this session", async () => {
    await turnOnAppLock(PASS, { biometrics: false });
    expect(notes()).toEqual(["my secret note"]);
  });

  it("writes a vault_setup audit entry into the encrypted database", async () => {
    await turnOnAppLock(PASS, { biometrics: false });
    expect(getAllAuditEntries(openDb())).toContainEqual(
      expect.objectContaining({ action: "vault_setup" }),
    );
  });

  it("rejects an empty passphrase without touching anything", async () => {
    await expect(turnOnAppLock("  ", { biometrics: false })).rejects.toThrow();
    expect(await isVaultConfigured()).toBe(false);
    expect(notes()).toEqual(["my secret note"]);
  });

  it("refuses when the lock is already on", async () => {
    await turnOnAppLock(PASS, { biometrics: false });
    await expect(turnOnAppLock(PASS, { biometrics: false })).rejects.toThrow();
  });

  it("rolls back fully if saving the key fails — plain data intact and open, no vault left", async () => {
    setItemAsync.mockRejectedValueOnce(new Error("keychain unavailable"));
    await expect(turnOnAppLock(PASS, { biometrics: false })).rejects.toThrow(
      "keychain unavailable",
    );
    expect(await isVaultConfigured()).toBe(false);
    expect(__storedDatabaseFiles().has(DATABASE_FILES.vault)).toBe(false);
    expect(notes()).toEqual(["my secret note"]);
  });

  it("stores a biometric-protected copy of the key when biometrics are wanted", async () => {
    await turnOnAppLock(PASS, { biometrics: true });
    const protectedWrite = setItemAsync.mock.calls.find(
      (call) =>
        (call[2] as { requireAuthentication?: boolean } | undefined)
          ?.requireAuthentication === true,
    );
    expect(protectedWrite).toBeDefined();
    expect(await hasBiometricUnlock()).toBe(true);
  });

  it("still turns the lock on with passphrase only if the biometric copy can't be saved", async () => {
    const original = setItemAsync.getMockImplementation()!;
    setItemAsync.mockImplementation(
      async (key: string, value: string, options?: unknown) => {
        if (
          (options as { requireAuthentication?: boolean } | undefined)
            ?.requireAuthentication
        ) {
          throw new Error("no biometrics enrolled");
        }
        return original(key, value);
      },
    );
    try {
      await turnOnAppLock(PASS, { biometrics: true });
    } finally {
      setItemAsync.mockImplementation(original);
    }
    expect(await isVaultConfigured()).toBe(true);
    expect(await hasBiometricUnlock()).toBe(false);
  });
});

describe("unlockVaultWithBiometrics", () => {
  it("returns the vault key from the biometric-protected copy", async () => {
    await turnOnAppLock(PASS, { biometrics: true });
    const key = await unlockVault(PASS);
    await expect(unlockVaultWithBiometrics()).resolves.toBe(key);
    const protectedRead = getItemAsync.mock.calls.find(
      (call) =>
        (call[1] as { requireAuthentication?: boolean } | undefined)
          ?.requireAuthentication === true,
    );
    expect(protectedRead).toBeDefined();
  });

  it("throws VaultUnlockError when biometric unlock isn't set up", async () => {
    await turnOnAppLock(PASS, { biometrics: false });
    expect(await hasBiometricUnlock()).toBe(false);
    await expect(unlockVaultWithBiometrics()).rejects.toThrow(VaultUnlockError);
  });

  it("throws VaultUnlockError when the OS prompt fails or is cancelled", async () => {
    await turnOnAppLock(PASS, { biometrics: true });
    const original = getItemAsync.getMockImplementation()!;
    getItemAsync.mockImplementation(async (key: string, options?: unknown) => {
      if (
        (options as { requireAuthentication?: boolean } | undefined)
          ?.requireAuthentication
      ) {
        throw new Error("User canceled");
      }
      return original(key);
    });
    try {
      await expect(unlockVaultWithBiometrics()).rejects.toThrow(
        VaultUnlockError,
      );
    } finally {
      getItemAsync.mockImplementation(original);
    }
  });
});

describe("turnOffAppLock", () => {
  it("moves every row back into the plain file and removes the vault", async () => {
    await turnOnAppLock(PASS, { biometrics: true });
    await turnOffAppLock(PASS);

    expect(await isVaultConfigured()).toBe(false);
    expect(await hasBiometricUnlock()).toBe(false);
    expect(__storedDatabaseFiles().has(DATABASE_FILES.vault)).toBe(false);
    expect(notes()).toEqual(["my secret note"]);
    closeDb();
    openDb();
    expect(notes()).toEqual(["my secret note"]);
  });

  it("logs vault_setup for turning it off, and keeps the earlier entries", async () => {
    await turnOnAppLock(PASS, { biometrics: false });
    await turnOffAppLock(PASS);
    const setups = getAllAuditEntries(openDb()).filter(
      (e) => e.action === "vault_setup",
    );
    expect(setups).toHaveLength(2);
  });

  it("refuses a wrong passphrase and changes nothing", async () => {
    await turnOnAppLock(PASS, { biometrics: false });
    await expect(turnOffAppLock("wrong")).rejects.toThrow(VaultUnlockError);
    expect(await isVaultConfigured()).toBe(true);
    expect(notes()).toEqual(["my secret note"]);
  });
});

// Checker round 1 (4.6 part 1): rollback must never delete live data, and a
// failed delete must never be reported as success.

describe("turning the lock on/off — preconditions and rollback safety", () => {
  it("turnOffAppLock refuses when the plain database is the open one — and deletes nothing", async () => {
    await turnOnAppLock(PASS, { biometrics: false });
    const key = await unlockVault(PASS);
    // Simulate a session where the plain file got opened instead.
    closeDb();
    seedPlainDb();
    expect(openDatabaseFile()).toBe("plain");
    await expect(turnOffAppLock(PASS)).rejects.toThrow();
    expect(notes()).toEqual(["my secret note"]);
    closeDb();
    openDb({ key });
    expect(notes()).toEqual(["my secret note"]);
  });

  it("turnOnAppLock refuses when the vault is already the open one", async () => {
    await turnOnAppLock(PASS, { biometrics: false });
    await expect(
      turnOnAppLock("another", { biometrics: false }),
    ).rejects.toThrow();
    expect(openDatabaseFile()).toBe("vault");
    expect(notes()).toEqual(["my secret note"]);
  });

  it("if a failure happens after the key is saved and the key can't be forgotten, the complete vault is kept", async () => {
    // No audit table → the audit write into the encrypted copy fails after the key is saved.
    closeDb();
    __resetSqliteMock();
    const db = openDb();
    db.execSync("CREATE TABLE notes (body TEXT);");
    db.runSync("INSERT INTO notes (body) VALUES (?);", "my secret note");
    deleteItemAsync.mockRejectedValueOnce(new Error("keychain locked"));

    await expect(turnOnAppLock(PASS, { biometrics: false })).rejects.toThrow();

    expect(await isVaultConfigured()).toBe(true);
    expect(__storedDatabaseFiles().has(DATABASE_FILES.vault)).toBe(true);
    closeDb();
    openDb({ key: await unlockVault(PASS) });
    expect(notes()).toEqual(["my secret note"]);
  });

  it("reports failure (not success) when the plain copy can't be deleted", async () => {
    const original = (deleteDatabaseSync as jest.Mock).getMockImplementation()!;
    (deleteDatabaseSync as jest.Mock).mockImplementation((name: string) => {
      if (name === DATABASE_FILES.plain)
        throw new Error("Unable to delete the database file");
      return original(name);
    });
    try {
      await expect(turnOnAppLock(PASS, { biometrics: false })).rejects.toThrow(
        "couldn't be removed",
      );
    } finally {
      (deleteDatabaseSync as jest.Mock).mockImplementation(original);
    }
  });

  it("deletes the plaintext copy before asking for biometrics", async () => {
    const order: string[] = [];
    const del = (deleteDatabaseSync as jest.Mock).getMockImplementation()!;
    (deleteDatabaseSync as jest.Mock).mockImplementation((name: string) => {
      if (name === DATABASE_FILES.plain) order.push("delete plain");
      return del(name);
    });
    const set = setItemAsync.getMockImplementation()!;
    setItemAsync.mockImplementation(
      async (k: string, v: string, o?: unknown) => {
        if (
          (o as { requireAuthentication?: boolean } | undefined)
            ?.requireAuthentication
        ) {
          order.push("biometric copy");
        }
        return set(k, v);
      },
    );
    try {
      await turnOnAppLock(PASS, { biometrics: true });
    } finally {
      (deleteDatabaseSync as jest.Mock).mockImplementation(del);
      setItemAsync.mockImplementation(set);
    }
    expect(order).toEqual(["delete plain", "biometric copy"]);
  });
});

// Checker round 2 (4.6 part 1): something reopening the database while the
// key is being saved must not let the lock "turn on" into the plain file.
describe("turnOnAppLock — a concurrent openDb() during the key save", () => {
  it("fails and rolls back instead of writing into the plain file", async () => {
    const original = setItemAsync.getMockImplementation()!;
    setItemAsync.mockImplementation(async (k: string, v: string) => {
      openDb(); // e.g. a screen re-rendering with useDb()
      return original(k, v);
    });
    try {
      await expect(
        turnOnAppLock(PASS, { biometrics: false }),
      ).rejects.toThrow();
    } finally {
      setItemAsync.mockImplementation(original);
    }
    expect(await isVaultConfigured()).toBe(false);
    expect(openDatabaseFile()).toBe("plain");
    expect(notes()).toEqual(["my secret note"]);
    expect(__storedDatabaseFiles().has(DATABASE_FILES.vault)).toBe(false);
  });

  it("when the keys can't be forgotten, the session continues in the vault they open", async () => {
    // Seeded WITHOUT the audit table, so the audit write into the encrypted
    // copy fails after the key is saved; deleteItemAsync then fails too.
    closeDb();
    __resetSqliteMock();
    const db = openDb();
    db.execSync("CREATE TABLE notes (body TEXT);");
    db.runSync("INSERT INTO notes (body) VALUES (?);", "my secret note");
    deleteItemAsync.mockRejectedValueOnce(new Error("keychain locked"));
    await expect(turnOnAppLock(PASS, { biometrics: false })).rejects.toThrow();
    expect(openDatabaseFile()).toBe("vault");
  });
});

describe("leftover copies are reported distinctly", () => {
  it("turnOnAppLock throws LeftoverCopyError when the lock is on but the plain file couldn't be removed", async () => {
    const original = (deleteDatabaseSync as jest.Mock).getMockImplementation()!;
    (deleteDatabaseSync as jest.Mock).mockImplementation((name: string) => {
      if (name === DATABASE_FILES.plain)
        throw new Error("Unable to delete the database file");
      return original(name);
    });
    try {
      await expect(turnOnAppLock(PASS, { biometrics: false })).rejects.toThrow(
        LeftoverCopyError,
      );
    } finally {
      (deleteDatabaseSync as jest.Mock).mockImplementation(original);
    }
    expect(await isVaultConfigured()).toBe(true);
    expect(openDatabaseFile()).toBe("vault");
  });
});

describe("resetVault from the lock screen (4.6)", () => {
  it("erases everything even when no database is open (locked, passphrase forgotten)", async () => {
    await turnOnAppLock(PASS, { biometrics: true });
    closeDb(); // app restarted, sitting on the lock screen
    _resetDbForTesting();

    await expect(resetVault()).resolves.toBeUndefined();

    expect(await isVaultConfigured()).toBe(false);
    expect(await hasBiometricUnlock()).toBe(false);
    expect(__storedDatabaseFiles().has(DATABASE_FILES.vault)).toBe(false);
    expect(__storedDatabaseFiles().has(DATABASE_FILES.plain)).toBe(false);
  });
});

describe("the stale-plain-copy marker (4.6, checker part 2)", () => {
  it("is cleared after a clean turn-on (nothing left to remove)", async () => {
    await turnOnAppLock(PASS, { biometrics: false });
    expect(isPlainCopyStale()).toBe(false);
  });

  it("is set when turn-on succeeded but couldn't delete the plain copy", async () => {
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
    expect(isPlainCopyStale()).toBe(true);
  });

  it("is cleared when a failed turn-on falls back to the plain file", async () => {
    setItemAsync.mockRejectedValueOnce(new Error("keychain unavailable"));
    await turnOnAppLock(PASS, { biometrics: false }).catch(() => undefined);
    expect(openDatabaseFile()).toBe("plain");
    expect(isPlainCopyStale()).toBe(false);
  });

  it("is cleared by resetVault", async () => {
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
    await resetVault();
    expect(isPlainCopyStale()).toBe(false);
  });
});

it("still sets up biometric unlock when only the leftover-copy cleanup failed", async () => {
  const original = (deleteDatabaseSync as jest.Mock).getMockImplementation()!;
  (deleteDatabaseSync as jest.Mock).mockImplementation((name: string) => {
    if (name === DATABASE_FILES.plain) throw new Error("Unable to delete");
    return original(name);
  });
  try {
    await expect(turnOnAppLock(PASS, { biometrics: true })).rejects.toThrow(
      LeftoverCopyError,
    );
  } finally {
    (deleteDatabaseSync as jest.Mock).mockImplementation(original);
  }
  expect(await hasBiometricUnlock()).toBe(true);
});
