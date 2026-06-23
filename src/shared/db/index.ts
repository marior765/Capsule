import { openDatabaseSync, type SQLiteDatabase } from "expo-sqlite";

export type Migration = {
  version: number;
  up: (db: SQLiteDatabase) => void;
};

let instance: SQLiteDatabase | null = null;

export function _resetDbForTesting(): void {
  instance = null;
}

export function openDb(): SQLiteDatabase {
  if (!instance) {
    instance = openDatabaseSync("capsule.db");
    instance.execSync(
      "CREATE TABLE IF NOT EXISTS _migrations (version INTEGER PRIMARY KEY);",
    );
  }
  return instance;
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
