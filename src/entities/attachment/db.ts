import type { Migration } from "@/shared/db";
import type { SQLiteDatabase } from "expo-sqlite";
import { rowToAttachment, type Attachment, type AttachmentRow } from "./model";

export const attachmentsMigration: Migration = {
  version: 17,
  up: (db: SQLiteDatabase) => {
    db.execSync(`
      CREATE TABLE IF NOT EXISTS attachments (
        id TEXT PRIMARY KEY,
        capsule_id TEXT NOT NULL,
        field_id TEXT NOT NULL,
        filename TEXT NOT NULL,
        local_uri TEXT NOT NULL,
        mime_type TEXT,
        size INTEGER,
        created_at INTEGER NOT NULL
      );
    `);
  },
};

export function getAttachmentById(
  db: SQLiteDatabase,
  id: string,
): Attachment | null {
  const row = db.getFirstSync(
    "SELECT * FROM attachments WHERE id = ?;",
    id,
  ) as AttachmentRow | null;
  return row ? rowToAttachment(row) : null;
}

/** Every attachment on one specific field of one capsule, oldest first. Empty array, never an error. */
export function getAttachmentsByCapsuleField(
  db: SQLiteDatabase,
  capsuleId: string,
  fieldId: string,
): Attachment[] {
  const rows = db.getAllSync(
    `SELECT * FROM attachments
     WHERE capsule_id = ? AND field_id = ?
     ORDER BY created_at ASC;`,
    capsuleId,
    fieldId,
  ) as AttachmentRow[];
  return rows.map(rowToAttachment);
}

export function insertAttachment(
  db: SQLiteDatabase,
  attachment: Attachment,
): void {
  db.runSync(
    `INSERT INTO attachments
       (id, capsule_id, field_id, filename, local_uri, mime_type, size, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
    attachment.id,
    attachment.capsuleId,
    attachment.fieldId,
    attachment.filename,
    attachment.localUri,
    attachment.mimeType,
    attachment.size,
    attachment.createdAt,
  );
}

export function deleteAttachment(db: SQLiteDatabase, id: string): void {
  db.runSync("DELETE FROM attachments WHERE id = ?;", id);
}

/**
 * Removes every attachment record belonging to one capsule, across all of
 * its fields — e.g. before deleting the capsule itself (composed by the
 * feature layer, not automatic here, mirroring
 * `deleteCapsuleTagsByCapsule`/`deleteLinksByCapsule`).
 *
 * Deliberately does NOT delete the underlying file bytes at `localUri` —
 * this entity never touches `expo-file-system` (see the model's own
 * docstring). Until a real picker + `shared/fs` wrapper exist to write
 * those bytes in the first place, there's nothing on disk for this to
 * clean up; once there is, that cleanup belongs in the feature layer that
 * owns the filesystem side, not here. Tracked in `BLOCKED.md`.
 */
export function deleteAttachmentsByCapsule(
  db: SQLiteDatabase,
  capsuleId: string,
): void {
  db.runSync("DELETE FROM attachments WHERE capsule_id = ?;", capsuleId);
}
