import type { SQLiteDatabase } from "expo-sqlite";
import {
  ATTACHMENTS_DIRECTORY,
  deleteAttachment,
  getAttachmentById,
  insertAttachment,
  type Attachment,
} from "@/entities/attachment";
import {
  copyFileInto,
  deleteAppFileIfExists,
  resolveAppPath,
} from "@/shared/fs";
import { generateId } from "@/shared/lib";

/**
 * 6.8 attachment files. Turns a picked file (from `expo-document-picker`
 * or `expo-image-picker`, which hand back a temporary cache URI the OS may
 * clean up at any time) into an attachment the app owns: the bytes are
 * copied to `<documents>/attachments/<capsuleId>/` and only then is the
 * record written, so a failed copy never leaves a row pointing at nothing.
 * The record stores the path relative to the document directory (see
 * `shared/fs` for why), resolved to a URI on use by `attachmentFileUri`.
 *
 * On-disk names are `<attachmentId>-<sanitized original name>`: unique per
 * attachment, a single safe path segment whatever the original name was.
 * The original name is kept unchanged in `filename` for display.
 *
 * Capsule deletion's file cleanup lives in `features/delete-capsule`
 * itself (FSD forbids it importing this slice), using the same
 * `shared/fs` calls.
 */

export type PickedFile = {
  capsuleId: string;
  fieldId: string;
  /** The picker's URI for the file — usually a temporary cache path. */
  sourceUri: string;
  filename: string;
  mimeType: string | null;
  size: number | null;
};

function storageName(id: string, filename: string): string {
  const safe = filename.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 80);
  return safe ? `${id}-${safe}` : id;
}

/** The current `file://` URI of an attachment's stored file (for display/sharing). */
export function attachmentFileUri(attachment: Attachment): string {
  return resolveAppPath(attachment.storagePath);
}

/**
 * Copies a picked file into app storage and records it as an attachment.
 * If recording fails after the copy succeeded, the copy is deleted again
 * before the error propagates — no orphaned bytes either way.
 */
export async function addAttachment(
  db: SQLiteDatabase,
  picked: PickedFile,
): Promise<Attachment> {
  const id = generateId();
  const storagePath = await copyFileInto(
    picked.sourceUri,
    [ATTACHMENTS_DIRECTORY, picked.capsuleId],
    storageName(id, picked.filename),
  );
  const attachment: Attachment = {
    id,
    capsuleId: picked.capsuleId,
    fieldId: picked.fieldId,
    filename: picked.filename,
    storagePath,
    mimeType: picked.mimeType,
    size: picked.size,
    createdAt: Date.now(),
  };
  try {
    insertAttachment(db, attachment);
  } catch (error) {
    deleteAppFileIfExists(storagePath);
    throw error;
  }
  return attachment;
}

/**
 * Deletes an attachment's stored file, then its record. If deleting the
 * file throws, the record is kept so the user still sees it and can retry
 * — never a silently orphaned file. A file that's already gone is fine.
 */
export function removeAttachment(
  db: SQLiteDatabase,
  attachmentId: string,
): void {
  const attachment = getAttachmentById(db, attachmentId);
  if (attachment === null) return;
  deleteAppFileIfExists(attachment.storagePath);
  deleteAttachment(db, attachmentId);
}
