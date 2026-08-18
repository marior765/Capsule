import type { SQLiteDatabase } from "expo-sqlite";
import { updateCapsule, upsertCapsuleValue } from "@/entities/capsule";
import { generateId } from "@/shared/lib";

export function renameCapsule(
  db: SQLiteDatabase,
  id: string,
  title: string,
): void {
  updateCapsule(db, id, { title, updatedAt: Date.now() });
}

/**
 * Sets one field's value on a capsule. Also bumps the capsule's own
 * `updatedAt` — cross-entity composition lives here in the feature layer,
 * since `entities/capsule`'s own `upsertCapsuleValue` only ever touches
 * `capsule_values`, never the `capsules` row. Without this, editing a
 * value wouldn't move the capsule to the top of a recency-ordered list
 * (`getAllCapsules`/`getCapsulesByType` both order by `updated_at DESC`)
 * even though the capsule genuinely just changed.
 */
export function setCapsuleFieldValue(
  db: SQLiteDatabase,
  capsuleId: string,
  fieldId: string,
  value: string | null,
): void {
  const now = Date.now();
  upsertCapsuleValue(db, {
    id: generateId(),
    capsuleId,
    fieldId,
    value,
    createdAt: now,
    updatedAt: now,
  });
  updateCapsule(db, capsuleId, { updatedAt: now });
}
