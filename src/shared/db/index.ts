import {
  openDatabaseSync,
  deleteDatabaseSync,
  type SQLiteDatabase,
} from "expo-sqlite";

/**
 * Two files (4.6): the plain database, and the SQLCipher-encrypted one used
 * once app lock is on. Which one opens depends on whether a key is given.
 * Turning the lock on or off copies into the other file (`copyDatabaseTo`)
 * rather than encrypting in place, so a failure at any point still leaves
 * one complete copy.
 */
export const DATABASE_FILES = {
  plain: "capsule.db",
  vault: "capsule-vault.db",
} as const;

export type DatabaseFile = keyof typeof DATABASE_FILES;

export type Migration = {
  version: number;
  up: (db: SQLiteDatabase) => void;
};

export type OpenDbOptions = {
  /**
   * Hex-encoded encryption key for at-rest encryption (step 4.1). Only
   * takes effect on a real native build with expo-sqlite's `useSQLCipher`
   * plugin option enabled (app.json) — on a plain SQLite build (including
   * this repo's jest mock), `PRAGMA key` is simply an unrecognized, silently
   * ignored pragma; nothing here can make an unmodified SQLite build
   * encrypt anything. features/encrypt-vault owns deriving/unwrapping this
   * key; shared/db only ever forwards it.
   *
   * **Landmine for whoever wires vault-gating in:** `openDb()` is already
   * called unconditionally and unkeyed by `Providers`, `LlmProvider`, and
   * `SttProvider` today. Because the connection is a singleton, the first
   * `openDb()` call — keyed or not — wins for the lifetime of the process.
   * A future unlock screen calling `openDb({ key })` *after* `Providers`
   * has already opened it unkeyed will silently no-op: no error, no
   * encryption, `options.key` just gets ignored. Making 4.1 actually take
   * effect requires gating `Providers`' own `openDb()` call behind the
   * vault unlock, not just calling `openDb({ key })` from a screen mounted
   * inside it. Tracked in .claude/loop/BLOCKED.md.
   */
  key?: string;
};

const HEX_PATTERN = /^[0-9a-f]+$/i;

let instance: SQLiteDatabase | null = null;
let openFile: DatabaseFile | null = null;

export function _resetDbForTesting(): void {
  instance = null;
  openFile = null;
}

function assertHexKey(key: string): void {
  if (!HEX_PATTERN.test(key)) {
    throw new Error("openDb: key must be a hex-encoded string");
  }
}

export function openDb(options?: OpenDbOptions): SQLiteDatabase {
  if (instance && options?.key && openFile !== "vault") {
    // Never hand back the plain database to a caller that asked for the
    // encrypted one — e.g. something reopened plain while the lock was
    // being turned on (4.6).
    throw new Error("openDb: the unencrypted database is already open");
  }
  if (!instance) {
    if (options?.key) assertHexKey(options.key);
    openFile = options?.key ? "vault" : "plain";
    instance = openDatabaseSync(DATABASE_FILES[openFile]);
    if (options?.key) {
      // The key is spliced directly into a PRAGMA statement string below —
      // safe only because it's guaranteed to be a plain hex string (an
      // internally-generated key, never raw user input). Enforced here,
      // not trusted from the type alone: a `string`-typed field doesn't
      // stop a future caller from passing a passphrase or anything else
      // that could break out of the `x'...'` literal.
      // Must be the very first statement run against a fresh connection —
      // SQLCipher only accepts the key on an otherwise-untouched database
      // handle; every later statement on this connection then transparently
      // encrypts/decrypts through it. This branch only runs on first open:
      // once `instance` exists, the connection is already keyed (or was
      // never meant to be), and a later caller passing a *different* key
      // here cannot re-key an open connection — that would require its own
      // explicit rekey flow, not implicit behavior in openDb. See the
      // `key` option's own doc comment for the sharper, live landmine this
      // singleton behavior creates.
      instance.execSync(`PRAGMA key = "x'${options.key}'";`);
    }
    instance.execSync(
      "CREATE TABLE IF NOT EXISTS _migrations (version INTEGER PRIMARY KEY);",
    );
  }
  return instance;
}

/** Closes the open connection without deleting anything; the next `openDb` opens afresh. */
export function closeDb(): void {
  if (instance) {
    instance.closeSync();
    instance = null;
    openFile = null;
  }
}

/**
 * Copies the whole open database into the other file — encrypted with
 * `key` for the vault file, unencrypted (`key` null) for the plain one —
 * using SQLCipher's `sqlcipher_export`. Any stale copy of the target is
 * removed first. Only works on a SQLCipher build (app.json `useSQLCipher`).
 */
export function copyDatabaseTo(target: DatabaseFile, key: string | null): void {
  if (!instance || openFile === null) {
    throw new Error("copyDatabaseTo: no database is open");
  }
  if (target === openFile) {
    throw new Error("copyDatabaseTo: can't copy onto the open database");
  }
  if (key !== null) assertHexKey(key);
  deleteDatabaseFile(target);
  const directory = instance.databasePath.slice(
    0,
    instance.databasePath.lastIndexOf("/") + 1,
  );
  const path = `${directory}${DATABASE_FILES[target]}`.replace(/'/g, "''");
  const keyClause = key === null ? "KEY ''" : `KEY "x'${key}'"`;
  instance.execSync(`ATTACH DATABASE '${path}' AS target ${keyClause};`);
  try {
    instance.execSync("SELECT sqlcipher_export('target');");
  } finally {
    instance.execSync("DETACH DATABASE target;");
  }
}

/** Which file the open connection uses, or null when nothing is open. */
export function openDatabaseFile(): DatabaseFile | null {
  return instance ? openFile : null;
}

/**
 * Deletes one database file if it exists, with SQLite's journal/WAL
 * sidecar files (a leftover hot journal could otherwise be replayed into
 * a later file of the same name). Never the open one. Only "not found" is
 * ignored — any other failure is thrown, so an erase or a lock change can
 * never report success while data is still on disk.
 */
export function deleteDatabaseFile(file: DatabaseFile): void {
  if (instance && openFile === file) {
    throw new Error("deleteDatabaseFile: that database is open");
  }
  const name = DATABASE_FILES[file];
  for (const path of [name, `${name}-journal`, `${name}-wal`, `${name}-shm`]) {
    try {
      deleteDatabaseSync(path);
    } catch (error) {
      if (!(error instanceof Error && /not found/i.test(error.message))) {
        throw error;
      }
    }
  }
}

/**
 * Closes the connection and deletes BOTH database files, clearing the
 * singleton so the next `openDb` starts fresh. The erase-everything path:
 * an encrypted-with-a-lost-key database is permanently unreadable, so
 * recovery means starting over, not attempting a repair.
 */
export function deleteDb(): void {
  closeDb();
  deleteDatabaseFile("plain");
  deleteDatabaseFile("vault");
}

export function runMigrations(
  db: SQLiteDatabase,
  migrations: Migration[] = [],
): void {
  const applied = new Set<number>(
    (
      db.getAllSync(
        "SELECT version FROM _migrations ORDER BY version ASC;",
      ) as {
        version: number;
      }[]
    ).map((r) => r.version),
  );

  const pending = migrations
    .filter((m) => !applied.has(m.version))
    .sort((a, b) => a.version - b.version);

  for (const migration of pending) {
    migration.up(db);
    db.runSync(
      "INSERT INTO _migrations (version) VALUES (?);",
      migration.version,
    );
  }
}
