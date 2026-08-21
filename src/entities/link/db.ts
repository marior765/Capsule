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

/**
 * `linksMigration` (v15) already shipped and ran for real, so its own
 * `CREATE TABLE` is never edited retroactively — a device that already
 * applied v15 needs a genuinely separate migration to layer on top, same
 * as any real-world schema change. Nullable: a link with no `field_id` is
 * a generic, not-field-backed relation (existing rows from before this
 * migration default to `NULL` automatically, which is exactly the
 * "generic link" meaning already established for new rows too).
 */
export const capsuleLinksFieldIdMigration: Migration = {
  version: 16,
  up: (db: SQLiteDatabase) => {
    db.execSync(`ALTER TABLE capsule_links ADD COLUMN field_id TEXT;`);
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

/**
 * Every link where this capsule is the source AND the link belongs to one
 * specific relation field — the query a relation field's own UI actually
 * needs (as opposed to `getLinksFrom`'s "every link regardless of which
 * field, if any, it belongs to"). A generic (`fieldId: null`) link never
 * matches, by design — `field_id = ?` with a non-null `fieldId` argument
 * excludes `NULL` rows under normal SQL semantics.
 */
export function getLinksFromByField(
  db: SQLiteDatabase,
  capsuleId: string,
  fieldId: string,
): CapsuleLink[] {
  const rows = db.getAllSync(
    `SELECT * FROM capsule_links
     WHERE from_capsule_id = ? AND field_id = ?
     ORDER BY created_at ASC;`,
    capsuleId,
    fieldId,
  ) as CapsuleLinkRow[];
  return rows.map(rowToCapsuleLink);
}

export function insertLink(db: SQLiteDatabase, link: CapsuleLink): void {
  db.runSync(
    `INSERT INTO capsule_links (id, from_capsule_id, to_capsule_id, field_id, label, created_at)
     VALUES (?, ?, ?, ?, ?, ?);`,
    link.id,
    link.fromCapsuleId,
    link.toCapsuleId,
    link.fieldId,
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
