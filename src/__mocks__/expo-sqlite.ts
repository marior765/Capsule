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

/**
 * Named "files" (4.6). Each open database is in-memory, but closing one
 * saves its contents under its file name (better-sqlite3 `serialize`), and
 * reopening that name restores them — so tests can follow data from the
 * plain file into the encrypted one and back. A file remembers the key it
 * was written with; opening it with a different (or no) `PRAGMA key` fails
 * on the first real statement, like SQLCipher's "file is not a database".
 *
 * SQLCipher-only statements are emulated, not run: `ATTACH DATABASE '…'
 * AS x KEY …` records the target file and key, `SELECT
 * sqlcipher_export('x')` saves a copy of the open database under that
 * file, and `DETACH DATABASE x` is a no-op. Nothing here encrypts —
 * only a real SQLCipher build does.
 *
 * Files persist across opens within a test file: tests that close and
 * reopen should call `__resetSqliteMock()` in `beforeEach`.
 */
type StoredFile = { bytes: Buffer; key: string | null };
const files = new Map<string, StoredFile>();

export function __resetSqliteMock(): void {
  files.clear();
}

export function __storedDatabaseFiles(): Map<string, { key: string | null }> {
  return new Map([...files].map(([name, f]) => [name, { key: f.key }]));
}

const PRAGMA_KEY = /^\s*PRAGMA key = "x'([0-9a-f]+)'";\s*$/i;
const ATTACH_WITH_KEY =
  /^\s*ATTACH DATABASE '(?:[^']|'')*\/([^/']+)' AS (\w+) KEY (?:''|"x'([0-9a-f]+)'");\s*$/i;
const EXPORT = /^\s*SELECT sqlcipher_export\('(\w+)'\);\s*$/;
const DETACH = /^\s*DETACH DATABASE \w+;\s*$/;

const createMockDb = (name: string) => {
  const stored = files.get(name);
  const db = stored ? new Database(stored.bytes) : new Database(":memory:");
  let key: string | null = null;
  let checked = false;
  const attached = new Map<string, { file: string; key: string | null }>();

  // The first real statement decides whether the key fits the file.
  const guard = () => {
    if (checked) return;
    checked = true;
    if (stored && stored.key !== key) {
      const error = new Error("file is not a database");
      error.name = "SqliteError";
      throw error;
    }
  };

  return {
    databasePath: `/mock/SQLite/${name}`,
    // A jest.fn (not a plain arrow function) so tests can assert *which*
    // statements were issued and in what order — needed for 4.1, where a
    // `PRAGMA key` must provably run before anything else touches a fresh
    // connection. better-sqlite3 is vanilla SQLite, not SQLCipher: the
    // key statements are emulated (see above), never encrypted.
    execSync: jest.fn((sql: string) => {
      const keyMatch = PRAGMA_KEY.exec(sql);
      if (keyMatch) {
        key = keyMatch[1].toLowerCase();
        return;
      }
      const attach = ATTACH_WITH_KEY.exec(sql);
      if (attach) {
        attached.set(attach[2], {
          file: attach[1],
          key: attach[3]?.toLowerCase() ?? null,
        });
        return;
      }
      const exported = EXPORT.exec(sql);
      if (exported) {
        guard();
        const target = attached.get(exported[1]);
        if (!target) throw new Error(`no attached database ${exported[1]}`);
        files.set(target.file, { bytes: db.serialize(), key: target.key });
        return;
      }
      if (DETACH.test(sql)) return;
      guard();
      rethrowInTestRealm(() => db.exec(sql));
    }),
    runSync: (sql: string, ...params: unknown[]) => {
      guard();
      rethrowInTestRealm(() => db.prepare(sql).run(...params));
    },
    getAllSync: (sql: string, ...params: unknown[]): unknown[] => {
      guard();
      return rethrowInTestRealm(() => db.prepare(sql).all(...params));
    },
    getFirstSync: (sql: string, ...params: unknown[]): unknown | null => {
      guard();
      return rethrowInTestRealm(() => db.prepare(sql).get(...params) ?? null);
    },
    closeSync: () => {
      // A file opened with the wrong key was never readable — closing it
      // must not overwrite the real contents.
      if (!stored || stored.key === key) {
        files.set(name, { bytes: db.serialize(), key });
      }
      db.close();
    },
  };
};

export const openDatabaseSync = jest.fn((name: string) => createMockDb(name));

// Like the real module, deleting a file that doesn't exist throws "not found".
export const deleteDatabaseSync = jest.fn((name: string) => {
  if (!files.delete(name)) throw new Error(`Database '${name}' not found`);
});
