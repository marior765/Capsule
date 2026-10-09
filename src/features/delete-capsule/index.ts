import type { SQLiteDatabase } from "expo-sqlite";
import {
  deleteCapsule as deleteCapsuleRecord,
  deleteEmbedding,
  deleteValuesByCapsule,
  deleteVersionsByCapsule,
  orphanChildCapsules,
} from "@/entities/capsule";
import { deleteCapsuleTagsByCapsule } from "@/entities/tag";
import { deleteLinksByCapsule } from "@/entities/link";
import {
  ATTACHMENTS_DIRECTORY,
  deleteAttachmentsByCapsule,
  getAttachmentsByCapsule,
} from "@/entities/attachment";
import { deleteAppDirectoryIfExists, deleteAppFileIfExists } from "@/shared/fs";
import { deleteRemindersByCapsule } from "@/entities/reminder";

/**
 * Deletes a capsule, all of its field values, its tag attachments (never
 * the tag records themselves — a tag is a shared label other capsules may
 * still use, per `features/tag-capsule`'s `deleteTag`), every link
 * touching it in either direction, its attachment records, and its RAG
 * embedding (7.2) — a stale vector for a capsule that no longer exists
 * would otherwise keep surfacing in retrieval results forever. Cross-
 * entity cascade lives here in the feature layer, mirroring
 * `manage-conversations`' `deleteConversation` — the entities themselves
 * stay independent.
 *
 * `orphanChildCapsules` (8.5, nesting) actively clears `parentCapsuleId` on
 * every direct child rather than leaving it dangling — unlike the
 * cross-entity references above, nesting is a same-entity structural field
 * (see `entities/capsule/model.ts`'s doc comment), so a stale pointer here
 * would silently drop a child from every "children of X" query rather than
 * just degrading one display. Children themselves are never cascade-deleted
 * — they remain independently valid capsules, per CLAUDE.md's
 * "self-contained entities" philosophy — only promoted back to root level.
 *
 * `deleteVersionsByCapsule` (8.5, version history) removes a deleted
 * capsule's own snapshot history — like the embedding above, this is the
 * capsule's own derived data (per `entities/capsule/model.ts`'s doc
 * comment on `CapsuleVersion`), not a cross-entity reference, so it's
 * actively cleaned up rather than left dangling.
 *
 * Attachments: each attachment's stored file is deleted, then the
 * capsule's whole `attachments/<capsuleId>` folder (catching any file
 * whose row was already gone), then the rows. Files go first so that if a
 * file delete throws, the capsule and its records are still intact and the
 * delete can be retried — never a capsule gone with its bytes left on disk.
 *
 * `deleteRemindersByCapsule` (8.8) removes a deleted capsule's own
 * reminders — a reminder pointing at a capsule that no longer exists
 * would otherwise keep firing (once notification scheduling actually
 * exists) for something the user can never open. Same-entity structural
 * data, same active-cleanup reasoning as version history/embedding above.
 */
export function deleteCapsule(db: SQLiteDatabase, id: string): void {
  for (const attachment of getAttachmentsByCapsule(db, id)) {
    deleteAppFileIfExists(attachment.storagePath);
  }
  deleteAppDirectoryIfExists(ATTACHMENTS_DIRECTORY, id);

  deleteValuesByCapsule(db, id);
  deleteCapsuleTagsByCapsule(db, id);
  deleteLinksByCapsule(db, id);
  deleteAttachmentsByCapsule(db, id);
  deleteEmbedding(db, id);
  deleteVersionsByCapsule(db, id);
  deleteRemindersByCapsule(db, id);
  orphanChildCapsules(db, id);
  deleteCapsuleRecord(db, id);
}
