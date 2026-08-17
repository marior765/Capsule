import {
  openDatabaseSync,
  deleteDatabaseSync,
  type SQLiteDatabase,
} from "expo-sqlite";

const DB_NAME = "capsule.db";

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

export function _resetDbForTesting(): void {
  instance = null;
}

export function openDb(options?: OpenDbOptions): SQLiteDatabase {
  if (!instance) {
    instance = openDatabaseSync(DB_NAME);
    if (options?.key) {
      // The key is spliced directly into a PRAGMA statement string below —
      // safe only because it's guaranteed to be a plain hex string (an
      // internally-generated key, never raw user input). Enforced here,
      // not trusted from the type alone: a `string`-typed field doesn't
      // stop a future caller from passing a passphrase or anything else
      // that could break out of the `x'...'` literal.
      if (!HEX_PATTERN.test(options.key)) {
        throw new Error("openDb: key must be a hex-encoded string");
      }
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

/**
 * Closes and deletes the database file, clearing the singleton so the next
 * `openDb` call starts fresh. Used by features/encrypt-vault's
 * wipe-and-restart recovery path when a vault can't be unlocked — an
 * encrypted-with-the-wrong-key (or corrupted) database file is permanently
 * unreadable, so recovery means starting over, not attempting a repair.
 */
export function deleteDb(): void {
  if (instance) {
    instance.closeSync();
    instance = null;
  }
  deleteDatabaseSync(DB_NAME);
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
