import type { SQLiteDatabase } from "expo-sqlite";
import {
  ATTACHMENTS_DIRECTORY,
  deleteAttachment,
  getAttachmentById,
  insertAttachment,
  type Attachment,
} from "@/entities/attachment";
import {
  appFileExists,
  copyFileInto,
  deleteAppFileIfExists,
  deleteCacheFileIfExists,
  resolveAppPath,
} from "@/shared/fs";
import { generateId } from "@/shared/lib";
import { insertAuditEntry } from "@/entities/audit";
import { canShare, ShareUnavailableError, shareFile } from "@/shared/share";

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
  /**
   * True when `sourceUri` is a picker's temporary copy in the app cache
   * (see `shared/picker`). It's deleted after the add, success or not.
   */
  sourceIsTemporaryCopy?: boolean;
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
 *
 * When `sourceIsTemporaryCopy` is set, the picker's temporary cache copy
 * is deleted afterwards whether the add succeeded or failed: nothing ever
 * reuses it (a retry means a fresh pick), so keeping it would only orphan
 * it. Best effort — a failure there never fails the add.
 */
export async function addAttachment(
  db: SQLiteDatabase,
  picked: PickedFile,
): Promise<Attachment> {
  try {
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
  } finally {
    if (picked.sourceIsTemporaryCopy) {
      try {
        deleteCacheFileIfExists(picked.sourceUri);
      } catch {
        // Best effort only; see the doc comment above.
      }
    }
  }
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

/**
 * Opens an attachment in another app through the system share sheet
 * ("Open in…", Save to Files) — how a PDF or any non-image file is viewed
 * (6.9). The file leaves Capsule, so it's recorded in the activity log —
 * after checking the file exists and the share sheet is available, so the
 * log never records an open that couldn't happen.
 */
export async function shareAttachment(
  db: SQLiteDatabase,
  attachmentId: string,
): Promise<void> {
  const attachment = getAttachmentById(db, attachmentId);
  if (attachment === null) throw new Error("That attachment no longer exists.");
  if (!appFileExists(attachment.storagePath)) {
    throw new Error("This file isn't on this device any more.");
  }
  // Logged only once the share sheet can really open — the log must never
  // say a file left Capsule when it didn't.
  if (!(await canShare())) throw new ShareUnavailableError();
  insertAuditEntry(db, {
    id: generateId(),
    action: "export",
    detail: `Opened attachment "${attachment.filename}" in another app`,
    createdAt: Date.now(),
  });
  await shareFile(resolveAppPath(attachment.storagePath), {
    mimeType: attachment.mimeType ?? undefined,
    title: attachment.filename,
  });
}
