// Tests for step 0.2 — written before implementation (TDD)
// The "openDb with an encryption key" and "deleteDb" blocks below are for
// step 4.1 (encrypt-vault) — also TDD, written before that behavior existed.
import {
  openDb,
  runMigrations,
  deleteDb,
  _resetDbForTesting,
  closeDb,
  copyDatabaseTo,
  deleteDatabaseFile,
  DATABASE_FILES,
  openDatabaseFile,
} from "../index";
import { openDatabaseSync, deleteDatabaseSync } from "expo-sqlite";
import { __resetSqliteMock } from "@/__mocks__/expo-sqlite";

type SpiedDb = { execSync: jest.Mock };

beforeEach(() => {
  _resetDbForTesting();
  __resetSqliteMock();
});

describe("shared/db — openDb", () => {
  it("returns a database instance", () => {
    const db = openDb();
    expect(db).toBeDefined();
  });

  it("returns the same instance on repeated calls (singleton)", () => {
    const db1 = openDb();
    const db2 = openDb();
    expect(db1).toBe(db2);
  });
});

describe("shared/db — runMigrations happy path", () => {
  it("runs without throwing when migrations exist", () => {
    const db = openDb();
    expect(() => runMigrations(db)).not.toThrow();
  });

  it("is idempotent — running twice does not throw", () => {
    const db = openDb();
    runMigrations(db);
    expect(() => runMigrations(db)).not.toThrow();
  });
});

describe("shared/db — runMigrations edge cases", () => {
  it("handles empty migrations list without error", () => {
    const db = openDb();
    expect(() => runMigrations(db, [])).not.toThrow();
  });

  it("applies migrations in ascending order", () => {
    const order: number[] = [];
    const db = openDb();
    const migrations = [
      {
        version: 2,
        up: () => {
          order.push(2);
        },
      },
      {
        version: 1,
        up: () => {
          order.push(1);
        },
      },
    ];
    runMigrations(db, migrations);
    expect(order).toEqual([1, 2]);
  });
});

describe("shared/db — runMigrations error handling", () => {
  it("throws if a migration fails", () => {
    const db = openDb();
    const broken = [
      {
        version: 1,
        up: () => {
          throw new Error("migration failed");
        },
      },
    ];
    expect(() => runMigrations(db, broken)).toThrow("migration failed");
  });

  it("does not apply subsequent migrations after a failure", () => {
    const db = openDb();
    const applied: number[] = [];
    const migrations = [
      {
        version: 1,
        up: () => {
          throw new Error("fail");
        },
      },
      {
        version: 2,
        up: () => {
          applied.push(2);
        },
      },
    ];
    try {
      runMigrations(db, migrations);
    } catch {}
    expect(applied).toEqual([]);
  });
});

describe("shared/db — openDb with an encryption key", () => {
  it("issues PRAGMA key before creating the migrations table when a key is given", () => {
    const db = openDb({ key: "aabbccdd" }) as unknown as SpiedDb;
    const calls = db.execSync.mock.calls.map((call) => call[0] as string);
    const keyCallIndex = calls.findIndex((sql) => sql.includes("PRAGMA key"));
    const migrationsCallIndex = calls.findIndex((sql) =>
      sql.includes("CREATE TABLE IF NOT EXISTS _migrations"),
    );
    expect(keyCallIndex).toBeGreaterThanOrEqual(0);
    expect(keyCallIndex).toBeLessThan(migrationsCallIndex);
  });

  it("embeds the exact key bytes in the PRAGMA statement", () => {
    const db = openDb({ key: "aabbccdd" }) as unknown as SpiedDb;
    const calls = db.execSync.mock.calls.map((call) => call[0] as string);
    expect(calls.some((sql) => sql.includes("x'aabbccdd'"))).toBe(true);
  });

  it("does not issue any PRAGMA key statement when no key is given — unencrypted callers unaffected", () => {
    const db = openDb() as unknown as SpiedDb;
    const calls = db.execSync.mock.calls.map((call) => call[0] as string);
    expect(calls.some((sql) => sql.includes("PRAGMA key"))).toBe(false);
  });

  it("only applies the key on the very first open — a later call with a different key is a no-op (already open)", () => {
    const db1 = openDb({ key: "11111111" }) as unknown as SpiedDb;
    db1.execSync.mockClear();
    const db2 = openDb({ key: "22222222" });
    expect(db2).toBe(db1);
    expect(db1.execSync).not.toHaveBeenCalled();
  });

  it("rejects a non-hex key rather than splicing it into the PRAGMA statement unchecked", () => {
    expect(() => openDb({ key: "'; DROP TABLE _migrations; --" })).toThrow();
  });

  it("accepts uppercase hex too", () => {
    expect(() => openDb({ key: "AABBCCDD" })).not.toThrow();
  });
});

describe("shared/db — deleteDb", () => {
  it("clears the singleton so the next openDb call creates a fresh instance", () => {
    const db1 = openDb();
    deleteDb();
    const db2 = openDb();
    expect(db2).not.toBe(db1);
  });
});

// Tests for 4.6 (app lock at launch) — written before implementation (TDD).
// The encrypted and plain databases are two separate files; turning the lock
// on or off copies into the other file (SQLCipher's sqlcipher_export), so a
// crash at any point leaves at least one complete copy.

const execCalls = (db: unknown): string[] =>
  (db as SpiedDb).execSync.mock.calls.map((call) => call[0] as string);

describe("shared/db — which file opens (4.6)", () => {
  beforeEach(() => {
    (openDatabaseSync as jest.Mock).mockClear();
  });

  it("opens the plain file without a key", () => {
    openDb();
    expect(openDatabaseSync).toHaveBeenCalledWith(DATABASE_FILES.plain);
  });

  it("opens the separate vault file with a key", () => {
    openDb({ key: "aabbccdd" });
    expect(openDatabaseSync).toHaveBeenCalledWith(DATABASE_FILES.vault);
    expect(DATABASE_FILES.vault).not.toBe(DATABASE_FILES.plain);
  });
});

describe("shared/db — copyDatabaseTo (4.6)", () => {
  it("exports the open database into the vault file, encrypted with the key", () => {
    const db = openDb();
    copyDatabaseTo("vault", "aabbccdd");
    const calls = execCalls(db);
    const attach = calls.find((sql) => sql.startsWith("ATTACH DATABASE"));
    expect(attach).toContain(`${DATABASE_FILES.vault}'`);
    expect(attach).toContain(`KEY "x'aabbccdd'"`);
    const exportAt = calls.findIndex((sql) => sql.includes("sqlcipher_export"));
    const detachAt = calls.findIndex((sql) =>
      sql.startsWith("DETACH DATABASE"),
    );
    expect(calls.indexOf(attach!)).toBeLessThan(exportAt);
    expect(exportAt).toBeLessThan(detachAt);
  });

  it("exports into the plain file with an empty key (decrypts)", () => {
    const db = openDb({ key: "aabbccdd" });
    copyDatabaseTo("plain", null);
    const attach = execCalls(db).find((sql) =>
      sql.startsWith("ATTACH DATABASE"),
    );
    expect(attach).toContain(`${DATABASE_FILES.plain}'`);
    expect(attach).toContain("KEY ''");
  });

  it("deletes any stale copy of the target file before exporting into it", () => {
    (deleteDatabaseSync as jest.Mock).mockClear();
    openDb();
    copyDatabaseTo("vault", "aabbccdd");
    expect(deleteDatabaseSync).toHaveBeenCalledWith(DATABASE_FILES.vault);
  });

  it("refuses to copy onto the file that is currently open", () => {
    openDb();
    expect(() => copyDatabaseTo("plain", null)).toThrow();
  });

  it("refuses a non-hex key", () => {
    openDb();
    expect(() => copyDatabaseTo("vault", "x'; --")).toThrow();
  });

  it("throws when no database is open", () => {
    expect(() => copyDatabaseTo("vault", "aabbccdd")).toThrow();
  });
});

describe("shared/db — closeDb / deleteDatabaseFile / deleteDb (4.6)", () => {
  it("closeDb closes without deleting, and the next openDb opens a new connection", () => {
    (deleteDatabaseSync as jest.Mock).mockClear();
    const db1 = openDb();
    closeDb();
    expect(deleteDatabaseSync).not.toHaveBeenCalled();
    expect(openDb()).not.toBe(db1);
  });

  it("deleteDatabaseFile refuses to delete the file that is open", () => {
    openDb();
    expect(() => deleteDatabaseFile("plain")).toThrow();
    expect(() => deleteDatabaseFile("vault")).not.toThrow();
  });

  it("deleteDatabaseFile ignores a file that doesn't exist", () => {
    (deleteDatabaseSync as jest.Mock).mockImplementationOnce(() => {
      throw new Error("Database not found");
    });
    expect(() => deleteDatabaseFile("vault")).not.toThrow();
  });

  it("deleteDb removes both files (erase everything)", () => {
    (deleteDatabaseSync as jest.Mock).mockClear();
    openDb();
    deleteDb();
    expect(deleteDatabaseSync).toHaveBeenCalledWith(DATABASE_FILES.plain);
    expect(deleteDatabaseSync).toHaveBeenCalledWith(DATABASE_FILES.vault);
  });
});

describe("shared/db — deleting files honestly (4.6, checker round 1)", () => {
  it("deleteDatabaseFile rethrows anything other than 'not found'", () => {
    (deleteDatabaseSync as jest.Mock).mockImplementationOnce(() => {
      throw new Error("Unable to delete the database file for 'capsule.db'");
    });
    expect(() => deleteDatabaseFile("plain")).toThrow("Unable to delete");
  });

  it("deleteDb fails loudly when a file can't be removed (a wipe must not report success)", () => {
    openDb();
    (deleteDatabaseSync as jest.Mock).mockImplementationOnce(() => {
      throw new Error("Unable to delete the database file for 'capsule.db'");
    });
    expect(() => deleteDb()).toThrow();
  });

  it("also removes SQLite's journal/WAL sidecar files", () => {
    (deleteDatabaseSync as jest.Mock).mockClear();
    deleteDatabaseFile("vault");
    const names = (deleteDatabaseSync as jest.Mock).mock.calls.map((c) => c[0]);
    expect(names).toEqual(
      expect.arrayContaining([
        DATABASE_FILES.vault,
        `${DATABASE_FILES.vault}-journal`,
        `${DATABASE_FILES.vault}-wal`,
        `${DATABASE_FILES.vault}-shm`,
      ]),
    );
  });

  it("openDatabaseFile says which file is open", () => {
    expect(openDatabaseFile()).toBeNull();
    openDb({ key: "aabbccdd" });
    expect(openDatabaseFile()).toBe("vault");
  });
});

describe("shared/db — a keyed open never returns the plain file (4.6, checker round 2)", () => {
  it("throws when asked for the vault while the plain file is open", () => {
    openDb();
    expect(() => openDb({ key: "aabbccdd" })).toThrow();
  });
});
