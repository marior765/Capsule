import type { Migration } from "@/shared/db";
import type { SQLiteDatabase } from "expo-sqlite";
import {
  rowToCapsuleLink,
  type CapsuleLink,
  type CapsuleLinkRow,
} from "./model";

export const linksMigration: Migration = {
  version: 15,
  up: (db: SQLiteDatabase) => {
    db.execSync(`
      CREATE TABLE IF NOT EXISTS capsule_links (
        id TEXT PRIMARY KEY,
        from_capsule_id TEXT NOT NULL,
        to_capsule_id TEXT NOT NULL,
        label TEXT,
        created_at INTEGER NOT NULL
      );
    `);
  },
};

export function getLinkById(
  db: SQLiteDatabase,
  id: string,
): CapsuleLink | null {
  const row = db.getFirstSync(
    "SELECT * FROM capsule_links WHERE id = ?;",
    id,
  ) as CapsuleLinkRow | null;
  return row ? rowToCapsuleLink(row) : null;
}

/** Every link where this capsule is the source. Empty array, never an error, for an unlinked capsule. */
export function getLinksFrom(
  db: SQLiteDatabase,
  capsuleId: string,
): CapsuleLink[] {
  const rows = db.getAllSync(
    "SELECT * FROM capsule_links WHERE from_capsule_id = ? ORDER BY created_at ASC;",
    capsuleId,
  ) as CapsuleLinkRow[];
  return rows.map(rowToCapsuleLink);
}

/** Every link where this capsule is the target. Empty array, never an error, for an unlinked capsule. */
export function getLinksTo(
  db: SQLiteDatabase,
  capsuleId: string,
): CapsuleLink[] {
  const rows = db.getAllSync(
    "SELECT * FROM capsule_links WHERE to_capsule_id = ? ORDER BY created_at ASC;",
    capsuleId,
  ) as CapsuleLinkRow[];
  return rows.map(rowToCapsuleLink);
}

export function insertLink(db: SQLiteDatabase, link: CapsuleLink): void {
  db.runSync(
    `INSERT INTO capsule_links (id, from_capsule_id, to_capsule_id, label, created_at)
     VALUES (?, ?, ?, ?, ?);`,
    link.id,
    link.fromCapsuleId,
    link.toCapsuleId,
    link.label,
    link.createdAt,
  );
}

export function deleteLink(db: SQLiteDatabase, id: string): void {
  db.runSync("DELETE FROM capsule_links WHERE id = ?;", id);
}

/**
 * Removes every link touching one capsule, in EITHER direction — e.g.
 * before deleting the capsule itself (composed by the feature layer, not
 * automatic here, mirroring `deleteCapsuleTagsByCapsule`).
 */
export function deleteLinksByCapsule(
  db: SQLiteDatabase,
  capsuleId: string,
): void {
  db.runSync(
    "DELETE FROM capsule_links WHERE from_capsule_id = ? OR to_capsule_id = ?;",
    capsuleId,
    capsuleId,
  );
}
