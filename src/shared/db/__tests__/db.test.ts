// Tests for step 0.2 — written before implementation (TDD)
// The "openDb with an encryption key" and "deleteDb" blocks below are for
// step 4.1 (encrypt-vault) — also TDD, written before that behavior existed.
import { openDb, runMigrations, deleteDb, _resetDbForTesting } from "../index";

type SpiedDb = { execSync: jest.Mock };

beforeEach(() => {
  _resetDbForTesting();
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
