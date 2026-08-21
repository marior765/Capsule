/**
 * A local file/image reference attached to one `CapsuleField` on one
 * capsule ("Attachment" per CLAUDE.md's Capsule domain model — "local
 * file/image, on-device only"). Deliberately metadata-only: this entity
 * records WHERE a file lives (`localUri`) and never touches
 * `expo-file-system` itself — the actual byte-level copy/write is a
 * `shared/fs` wrapper's job (docs/ARCHITECTURE.md names `attachment` as
 * exactly the trigger for that extraction, not yet done — see
 * `.claude/loop/BLOCKED.md`) once a picker library is added. Until then,
 * `localUri` is just a `TEXT` column like any other — no native module,
 * no jest-untestable code path, fully provable in isolation.
 */
export type Attachment = {
  id: string;
  capsuleId: string;
  fieldId: string;
  /** Original filename as picked, for display — not a path. */
  filename: string;
  /** Local on-device path/URI where the file's bytes live (or will, once a real picker writes them). */
  localUri: string;
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
    localUri: row.local_uri,
    mimeType: row.mime_type,
    size: row.size,
    createdAt: row.created_at,
  };
}
