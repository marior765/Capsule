/**
 * "CapsuleField — typed field def (text, number, date, boolean, select,
 * relation, attachment…)" per CLAUDE.md's Capsule domain model. Belongs to
 * a `CapsuleType` (entities/capsule-type, a sibling slice) — no SQL FOREIGN
 * KEY constraint, matching this app's own convention of graceful
 * degradation on a dangling reference rather than DB-level enforcement
 * (see CapsuleLink's own documented rule in CLAUDE.md).
 */
export type FieldType =
  | "text"
  | "long_text"
  | "number"
  | "boolean"
  | "date"
  | "single_select"
  | "multi_select"
  | "relation"
  | "attachment";

export type CapsuleField = {
  id: string;
  capsuleTypeId: string;
  name: string;
  fieldType: FieldType;
  /**
   * Type-specific settings (select options, a relation's target capsule
   * type, etc.), JSON-serialized as an opaque string this entity never
   * parses or interprets. Left generic on purpose — the concrete per-type
   * shapes belong to 6.8 (relation/attachment field types) and 6.10 (field
   * validation), not this step's models-and-CRUD scope.
   */
  config: string | null;
  /** Display order within its CapsuleType — not a timestamp-derived order. */
  sortOrder: number;
  required: boolean;
  createdAt: number;
  updatedAt: number;
};

export type CapsuleFieldRow = {
  id: string;
  capsule_type_id: string;
  name: string;
  field_type: string;
  config: string | null;
  sort_order: number;
  required: number;
  created_at: number;
  updated_at: number;
};

export function rowToCapsuleField(row: CapsuleFieldRow): CapsuleField {
  return {
    id: row.id,
    capsuleTypeId: row.capsule_type_id,
    name: row.name,
    fieldType: row.field_type as FieldType,
    config: row.config,
    sortOrder: row.sort_order,
    required: row.required === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
