import type { SQLiteDatabase } from "expo-sqlite";
import {
  deleteCapsule as deleteCapsuleRecord,
  deleteValuesByCapsule,
} from "@/entities/capsule";

/**
 * Deletes a capsule and all of its field values. Cross-entity cascade
 * lives here in the feature layer, mirroring `manage-conversations`'
 * `deleteConversation` — the entities themselves
 * (`deleteCapsule`/`deleteValuesByCapsule`) stay independent.
 */
export function deleteCapsule(db: SQLiteDatabase, id: string): void {
  deleteValuesByCapsule(db, id);
  deleteCapsuleRecord(db, id);
}
