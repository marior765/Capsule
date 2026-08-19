import type { SQLiteDatabase } from "expo-sqlite";
import {
  deleteCapsuleType as deleteCapsuleTypeRecord,
  insertCapsuleType,
  updateCapsuleType,
  type CapsuleType,
} from "@/entities/capsule-type";
import {
  deleteCapsuleField,
  deleteFieldsByCapsuleType,
  getFieldsByCapsuleType,
  insertCapsuleField,
  updateCapsuleField,
  type CapsuleField,
  type FieldType,
} from "@/entities/field";
import { generateId } from "@/shared/lib";

export type FieldInput = {
  name: string;
  fieldType: FieldType;
  config?: string | null;
  required?: boolean;
};

export type CreateCapsuleTypeInput = {
  name: string;
  description?: string | null;
  fields?: FieldInput[];
};

/**
 * Creates a CapsuleType and, if given, its initial fields in one call —
 * cross-entity composition lives here in the feature layer, mirroring
 * `create-capsule`'s own `createCapsule` (the entities themselves,
 * `entities/capsule-type`'s `insertCapsuleType` and `entities/field`'s
 * `insertCapsuleField`, stay independent of each other). Field `sortOrder`
 * is assigned from the input array's own order, starting at 0.
 */
export function createCapsuleType(
  db: SQLiteDatabase,
  input: CreateCapsuleTypeInput,
): CapsuleType {
  const now = Date.now();
  const capsuleType: CapsuleType = {
    id: generateId(),
    name: input.name,
    description: input.description ?? null,
    createdAt: now,
    updatedAt: now,
  };
  insertCapsuleType(db, capsuleType);

  (input.fields ?? []).forEach((fieldInput, index) => {
    insertCapsuleField(db, {
      id: generateId(),
      capsuleTypeId: capsuleType.id,
      name: fieldInput.name,
      fieldType: fieldInput.fieldType,
      config: fieldInput.config ?? null,
      sortOrder: index,
      required: fieldInput.required ?? false,
      createdAt: now,
      updatedAt: now,
    });
  });

  return capsuleType;
}

export function renameCapsuleType(
  db: SQLiteDatabase,
  id: string,
  name: string,
): void {
  updateCapsuleType(db, id, { name, updatedAt: Date.now() });
}

export function setCapsuleTypeDescription(
  db: SQLiteDatabase,
  id: string,
  description: string | null,
): void {
  updateCapsuleType(db, id, { description, updatedAt: Date.now() });
}

/**
 * Appends one field to the end of a type's field list. `sortOrder` is
 * derived as `max(existing sortOrders) + 1` (0 for an empty type) —
 * deliberately NOT the field *count*, which collides whenever a
 * previously removed field wasn't the last one in the sequence (e.g.
 * fields [A:0, B:1], remove A, add C — a count-based `length` (1) would
 * reassign B's own sortOrder to C too; max+1 correctly continues past
 * B's existing 1, landing C at 2).
 */
export function addField(
  db: SQLiteDatabase,
  capsuleTypeId: string,
  input: FieldInput,
): CapsuleField {
  const now = Date.now();
  const existing = getFieldsByCapsuleType(db, capsuleTypeId);
  const sortOrder =
    existing.length === 0
      ? 0
      : Math.max(...existing.map((f) => f.sortOrder)) + 1;
  const field: CapsuleField = {
    id: generateId(),
    capsuleTypeId,
    name: input.name,
    fieldType: input.fieldType,
    config: input.config ?? null,
    sortOrder,
    required: input.required ?? false,
    createdAt: now,
    updatedAt: now,
  };
  insertCapsuleField(db, field);
  return field;
}

/**
 * Updates a field's own definition (name / type / config / required).
 * Deliberately excludes `sortOrder` — reordering is `reorderFields`' job,
 * kept separate so a rename can never accidentally shuffle field position.
 */
export function updateField(
  db: SQLiteDatabase,
  fieldId: string,
  patch: Partial<FieldInput>,
): void {
  updateCapsuleField(db, fieldId, {
    ...patch,
    updatedAt: Date.now(),
  });
}

/**
 * Removes one field. Values already stored against it on existing capsules
 * (`entities/capsule`'s `CapsuleValue` rows) become orphaned data with no
 * SQL FK to enforce otherwise — `FieldRenderer` only ever renders fields
 * still present on the type, so an orphaned value simply stops being
 * displayed. This mirrors the app's established graceful-degradation
 * convention for dangling references (e.g. `CapsuleCard`'s "Unknown type"
 * fallback for a capsule whose `capsuleTypeId` no longer resolves) rather
 * than introducing a new cross-entity cascade this step doesn't need.
 */
export function removeField(db: SQLiteDatabase, fieldId: string): void {
  deleteCapsuleField(db, fieldId);
}

/**
 * Re-sequences every field of a type to `sortOrder` = its index in
 * `orderedFieldIds`. The caller supplies the full field id list in its
 * new order (e.g. from a drag-to-reorder UI). Ids that don't actually
 * belong to `capsuleTypeId` are silently skipped rather than trusted
 * blindly — a stale or cross-type id in the array must not let one
 * type's reorder call rewrite another type's field ordering.
 */
export function reorderFields(
  db: SQLiteDatabase,
  capsuleTypeId: string,
  orderedFieldIds: string[],
): void {
  const now = Date.now();
  const ownFieldIds = new Set(
    getFieldsByCapsuleType(db, capsuleTypeId).map((f) => f.id),
  );
  let sortOrder = 0;
  for (const fieldId of orderedFieldIds) {
    if (!ownFieldIds.has(fieldId)) continue;
    updateCapsuleField(db, fieldId, { sortOrder, updatedAt: now });
    sortOrder += 1;
  }
}

/**
 * Deletes a CapsuleType and cascades to remove every one of its fields
 * (mirrors `delete-capsule`'s cascade to `CapsuleValue` rows). Deliberately
 * does NOT touch any `Capsule` of this type — no SQL FK exists, and this
 * app's own convention (verified against `CapsuleCard`'s "Unknown type"
 * fallback, built in 6.3) is that a dangling `capsuleTypeId` degrades
 * gracefully rather than being cleaned up transitively. This function
 * never imports `entities/capsule` at all.
 */
export function deleteCapsuleType(db: SQLiteDatabase, id: string): void {
  deleteFieldsByCapsuleType(db, id);
  deleteCapsuleTypeRecord(db, id);
}

export type { CapsuleType } from "@/entities/capsule-type";
export type { CapsuleField, FieldType } from "@/entities/field";

// Re-export for callers that only need the read path (no manage-schema
// mutation), mirroring `manage-conversations`' own `listConversations`.
export { getCapsuleTypeById } from "@/entities/capsule-type";
export { getFieldsByCapsuleType } from "@/entities/field";
