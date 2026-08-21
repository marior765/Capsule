import type { SQLiteDatabase } from "expo-sqlite";
import {
  deleteCapsule as deleteCapsuleRecord,
  deleteValuesByCapsule,
} from "@/entities/capsule";
import { deleteCapsuleTagsByCapsule } from "@/entities/tag";
import { deleteLinksByCapsule } from "@/entities/link";

/**
 * Deletes a capsule, all of its field values, its tag attachments (never
 * the tag records themselves — a tag is a shared label other capsules may
 * still use, per `features/tag-capsule`'s `deleteTag`), and every link
 * touching it in either direction (`deleteLinksByCapsule` — a link is not
 * shared the way a tag is, so there's no equivalent "record survives"
 * case to preserve). Cross-entity cascade lives here in the feature
 * layer, mirroring `manage-conversations`' `deleteConversation` — the
 * entities themselves stay independent.
 */
export function deleteCapsule(db: SQLiteDatabase, id: string): void {
  deleteValuesByCapsule(db, id);
  deleteCapsuleTagsByCapsule(db, id);
  deleteLinksByCapsule(db, id);
  deleteCapsuleRecord(db, id);
}
