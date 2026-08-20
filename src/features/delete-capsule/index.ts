import type { SQLiteDatabase } from "expo-sqlite";
import {
  deleteCapsule as deleteCapsuleRecord,
  deleteValuesByCapsule,
} from "@/entities/capsule";
import { deleteCapsuleTagsByCapsule } from "@/entities/tag";

/**
 * Deletes a capsule, all of its field values, and its tag attachments
 * (never the tag records themselves — a tag is a shared label other
 * capsules may still use, per `features/tag-capsule`'s `deleteTag`, which
 * is the only place that actually removes a `Tag` row). Cross-entity
 * cascade lives here in the feature layer, mirroring `manage-conversations`'
 * `deleteConversation` — the entities themselves
 * (`deleteCapsule`/`deleteValuesByCapsule`/`deleteCapsuleTagsByCapsule`)
 * stay independent.
 */
export function deleteCapsule(db: SQLiteDatabase, id: string): void {
  deleteValuesByCapsule(db, id);
  deleteCapsuleTagsByCapsule(db, id);
  deleteCapsuleRecord(db, id);
}
