/**
 * "Capsule — the unit; holds values + embedded schema reference" per
 * CLAUDE.md's Capsule domain model. This entity itself only holds the
 * instance's own identity (a `capsuleTypeId` reference + a display
 * `title`) — the actual field VALUES live in the separate `CapsuleValue`
 * table below, an EAV (entity-attribute-value) design: one row per
 * (capsule, field) pair, `value` stored as an opaque, type-appropriately-
 * serialized string this entity never interprets (multi-select's "value"
 * is itself a JSON-encoded array string, for example — still one row).
 *
 * No SQL FOREIGN KEY on `capsule_type_id`, matching this app's established
 * graceful-degradation convention (no FK constraints exist anywhere in
 * this codebase; CLAUDE.md's CapsuleLink rule states the same philosophy
 * explicitly for capsule-to-capsule relations).
 */
export type Capsule = {
  id: string;
  capsuleTypeId: string;
  title: string;
  createdAt: number;
  updatedAt: number;
};

export type CapsuleRow = {
  id: string;
  capsule_type_id: string;
  title: string;
  created_at: number;
  updated_at: number;
};

export function rowToCapsule(row: CapsuleRow): Capsule {
  return {
    id: row.id,
    capsuleTypeId: row.capsule_type_id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * One field's value on one capsule. `value` may be `null` — a field can be
 * explicitly unset while still having a row (kept flexible on purpose;
 * what "required but empty" means is 6.10's job, not this entity's).
 */
export type CapsuleValue = {
  id: string;
  capsuleId: string;
  fieldId: string;
  value: string | null;
  createdAt: number;
  updatedAt: number;
};

export type CapsuleValueRow = {
  id: string;
  capsule_id: string;
  field_id: string;
  value: string | null;
  created_at: number;
  updated_at: number;
};

export function rowToCapsuleValue(row: CapsuleValueRow): CapsuleValue {
  return {
    id: row.id,
    capsuleId: row.capsule_id,
    fieldId: row.field_id,
    value: row.value,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
