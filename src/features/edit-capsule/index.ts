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

export type SaveCapsuleEditsInput = {
  title: string;
  initialTitle: string;
  /** fieldId -> the value currently staged in the editor. */
  values: Record<string, string | null>;
  /** fieldId -> the value as loaded, before any edits. */
  initialValues: Record<string, string | null>;
  /** The capsule's current type's field ids — bounds the diff to real fields. */
  fieldIds: string[];
};

/**
 * Diffs an edit session against what was originally loaded and writes only
 * what actually changed — mirrors `createCapsule`'s "one call, title +
 * values together" shape so a route never has to hand-orchestrate
 * `renameCapsule`/`setCapsuleFieldValue` itself (routes carry no business
 * logic, per `docs/ARCHITECTURE.md`). Skipping untouched fields isn't just
 * an optimization: both `renameCapsule` and `setCapsuleFieldValue` bump
 * `updatedAt` unconditionally, and `getAllCapsules`/`getCapsulesByType`
 * order by `updated_at DESC` — writing back an unchanged value would move
 * the capsule to the top of a recency list for no real edit.
 */
export function saveCapsuleEdits(
  db: SQLiteDatabase,
  capsuleId: string,
  input: SaveCapsuleEditsInput,
): void {
  const trimmedTitle = input.title.trim() || "Untitled";
  if (trimmedTitle !== input.initialTitle) {
    renameCapsule(db, capsuleId, trimmedTitle);
  }
  for (const fieldId of input.fieldIds) {
    const current = input.values[fieldId] ?? null;
    const initial = input.initialValues[fieldId] ?? null;
    if (current !== initial) {
      setCapsuleFieldValue(db, capsuleId, fieldId, current);
    }
  }
}
