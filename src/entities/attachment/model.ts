/**
 * A local file/image reference attached to one `CapsuleField` on one
 * capsule ("Attachment" per CLAUDE.md's Capsule domain model — "local
 * file/image, on-device only"). This entity stays metadata-only: it
 * records WHERE a file lives (`storagePath`) and never touches the
 * filesystem itself. Copying picked files into app storage and deleting
 * them is `features/manage-attachments`' job, through `shared/fs`.
 */
/** Name of the folder under the app's document directory that holds every attachment's bytes. */
export const ATTACHMENTS_DIRECTORY = "attachments";

export type Attachment = {
  id: string;
  capsuleId: string;
  fieldId: string;
  /** Original filename as picked, for display — not a path. */
  filename: string;
  /**
   * Where the file's bytes live, RELATIVE to the app's document directory
   * (e.g. `attachments/<capsuleId>/<id>-photo.jpg`) — never an absolute
   * `file://` URI, which iOS can invalidate by moving the app's container.
   * Resolve with `shared/fs`'s `resolveAppPath`. Stored in the
   * `local_uri` column (name kept to avoid a migration).
   */
  storagePath: string;
  mimeType: string | null;
  /** Bytes, when known — `null` if a picker/source doesn't report it. */
  size: number | null;
  createdAt: number;
};

export type AttachmentRow = {
  id: string;
  capsule_id: string;
  field_id: string;
  filename: string;
  local_uri: string;
  mime_type: string | null;
  size: number | null;
  created_at: number;
};

export function rowToAttachment(row: AttachmentRow): Attachment {
  return {
    id: row.id,
    capsuleId: row.capsule_id,
    fieldId: row.field_id,
    filename: row.filename,
    storagePath: row.local_uri,
    mimeType: row.mime_type,
    size: row.size,
    createdAt: row.created_at,
  };
}
