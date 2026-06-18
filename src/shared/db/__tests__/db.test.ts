// Tests for step 0.2 — written before implementation (TDD)
import { openDb, runMigrations } from "../index";

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
