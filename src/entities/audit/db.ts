import type { Migration } from "@/shared/db";
import type { SQLiteDatabase } from "expo-sqlite";
import { rowToAuditEntry, type AuditEntry, type AuditEntryRow } from "./model";

export const auditMigration: Migration = {
  version: 8,
  up: (db: SQLiteDatabase) => {
    db.execSync(`
      CREATE TABLE IF NOT EXISTS audit_entries (
        id TEXT PRIMARY KEY,
        action TEXT NOT NULL,
        detail TEXT,
        created_at INTEGER NOT NULL
      );

      -- Append-only, enforced at the database level rather than only by
      -- which JS functions this module happens to export. Omitting
      -- updateAuditEntry/deleteAuditEntry is trivially reversible by anyone
      -- adding them later; a trigger that aborts the statement is not — it
      -- holds even against a stray hand-written UPDATE/DELETE anywhere else
      -- in the app.
      CREATE TRIGGER IF NOT EXISTS audit_entries_no_update
      BEFORE UPDATE ON audit_entries
      BEGIN
        SELECT RAISE(ABORT, 'audit_entries is append-only: UPDATE is not permitted');
      END;

      CREATE TRIGGER IF NOT EXISTS audit_entries_no_delete
      BEFORE DELETE ON audit_entries
      BEGIN
        SELECT RAISE(ABORT, 'audit_entries is append-only: DELETE is not permitted');
      END;
    `);
  },
};

export function getAllAuditEntries(db: SQLiteDatabase): AuditEntry[] {
  // Secondary sort on id keeps ordering deterministic when two entries share
  // a millisecond timestamp — without it, a tie's order is unspecified and
  // the log could visually reshuffle between renders.
  const rows = db.getAllSync(
    "SELECT * FROM audit_entries ORDER BY created_at DESC, id DESC;",
  ) as AuditEntryRow[];
  return rows.map(rowToAuditEntry);
}

export function getAuditEntryById(
  db: SQLiteDatabase,
  id: string,
): AuditEntry | null {
  const row = db.getFirstSync(
    "SELECT * FROM audit_entries WHERE id = ?;",
    id,
  ) as AuditEntryRow | null;
  return row ? rowToAuditEntry(row) : null;
}

/**
 * Append-only by design. There is no updateAuditEntry or deleteAuditEntry —
 * a privacy ledger that callers can quietly edit or remove entries from
 * defeats the reason it exists. If a future feature (e.g. 4.5's full wipe)
 * genuinely needs to clear the log, that must be its own explicit, reviewed
 * decision — not a capability this entity hands out by default.
 */
export function insertAuditEntry(db: SQLiteDatabase, entry: AuditEntry): void {
  db.runSync(
    `INSERT INTO audit_entries (id, action, detail, created_at)
     VALUES (?, ?, ?, ?);`,
    entry.id,
    entry.action,
    entry.detail,
    entry.createdAt,
  );
}
