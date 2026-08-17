import Database from "better-sqlite3";

const createMockDb = () => {
  const db = new Database(":memory:");

  return {
    // A jest.fn (not a plain arrow function) so tests can assert *which*
    // statements were issued and in what order — needed for 4.1, where a
    // `PRAGMA key` must provably run before anything else touches a fresh
    // connection. Behavior is unchanged: every call still runs for real
    // against the in-memory engine. better-sqlite3 is vanilla SQLite, not
    // SQLCipher, so `PRAGMA key` itself is a silent no-op here (SQLite
    // ignores unrecognized pragmas) — that's expected; only a real
    // SQLCipher-enabled native build actually encrypts anything.
    execSync: jest.fn((sql: string) => {
      db.exec(sql);
    }),
    runSync: (sql: string, ...params: unknown[]) => {
      db.prepare(sql).run(...params);
    },
    getAllSync: (sql: string, ...params: unknown[]): unknown[] => {
      return db.prepare(sql).all(...params);
    },
    getFirstSync: (sql: string, ...params: unknown[]): unknown | null => {
      return db.prepare(sql).get(...params) ?? null;
    },
    closeSync: () => {
      db.close();
    },
  };
};

export const openDatabaseSync = jest.fn((_name: string) => createMockDb());

// No-op: the mock's databases are anonymous in-memory instances (never
// written to a real named file), so there is nothing on disk to delete.
// Real deletion is exercised only on a device.
export const deleteDatabaseSync = jest.fn((_name: string) => {});
