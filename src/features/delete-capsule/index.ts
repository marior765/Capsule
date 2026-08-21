import type { SQLiteDatabase } from "expo-sqlite";
import {
  deleteCapsule as deleteCapsuleRecord,
  deleteValuesByCapsule,
} from "@/entities/capsule";
import { deleteCapsuleTagsByCapsule } from "@/entities/tag";
import { deleteLinksByCapsule } from "@/entities/link";
import { deleteAttachmentsByCapsule } from "@/entities/attachment";

/**
 * Deletes a capsule, all of its field values, its tag attachments (never
 * the tag records themselves — a tag is a shared label other capsules may
 * still use, per `features/tag-capsule`'s `deleteTag`), every link
 * touching it in either direction, and its attachment records. Cross-
 * entity cascade lives here in the feature layer, mirroring
 * `manage-conversations`' `deleteConversation` — the entities themselves
 * stay independent.
 *
 * `deleteAttachmentsByCapsule` only removes the DB rows, not the
 * underlying file bytes at each attachment's `localUri` — `entities/
 * attachment` never touches `expo-file-system` (no picker/writer exists
 * yet to have put bytes there in the first place). Once one does, real
 * file cleanup on capsule delete is a genuine follow-up, tracked in
 * `BLOCKED.md` rather than guessed at here.
 */
export function deleteCapsule(db: SQLiteDatabase, id: string): void {
  deleteValuesByCapsule(db, id);
  deleteCapsuleTagsByCapsule(db, id);
  deleteLinksByCapsule(db, id);
  deleteAttachmentsByCapsule(db, id);
  deleteCapsuleRecord(db, id);
}
