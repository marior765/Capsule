import Database from "better-sqlite3";

/**
 * better-sqlite3's native addon is loaded once per jest worker, and it
 * keeps the `SqliteError` class from whichever test file loaded it first.
 * Every later test file in that worker runs in its own module realm, so the
 * errors it receives fail `instanceof Error` there — and jest's
 * `rejects.toThrow` / `toThrow` then report "did not throw", depending only
 * on which files happened to share a worker (observed 2026-10-09: four
 * consecutive failures of `npx jest --runInBand src/features/wipe-data
 * src/features/manage-attachments`, zero after this fix; not reproduced by
 * a later independent re-run, so treat the trigger as environment-
 * sensitive rather than guaranteed). Re-throwing as an `Error` from
 * the calling test's own realm (same message, same `code`) removes that
 * order dependence.
 */
function rethrowInTestRealm<T>(run: () => T): T {
  try {
    return run();
  } catch (e) {
    const source = e as { message?: unknown; code?: unknown };
    const error = new Error(
      typeof source.message === "string" ? source.message : String(e),
    ) as Error & { code?: unknown };
    error.name = "SqliteError";
    if (source.code !== undefined) error.code = source.code;
    throw error;
  }
}

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
      rethrowInTestRealm(() => db.exec(sql));
    }),
    runSync: (sql: string, ...params: unknown[]) => {
      rethrowInTestRealm(() => db.prepare(sql).run(...params));
    },
    getAllSync: (sql: string, ...params: unknown[]): unknown[] => {
      return rethrowInTestRealm(() => db.prepare(sql).all(...params));
    },
    getFirstSync: (sql: string, ...params: unknown[]): unknown | null => {
      return rethrowInTestRealm(() => db.prepare(sql).get(...params) ?? null);
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
