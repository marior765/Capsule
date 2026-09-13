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
 *
 * `parentCapsuleId` (8.5, "capsule nesting") is deliberately a plain field
 * on `Capsule` itself, not a `CapsuleLink` — nesting is a single-parent
 * tree relationship with real structural meaning (cycle prevention,
 * "children of X" queries), unlike `CapsuleLink`'s many-to-many, freely
 * labeled relations. Reusing the link table for it would mean every link
 * query has to filter out nesting edges by convention (a reserved label
 * or magic `fieldId`) rather than by the schema itself.
 */
export type Capsule = {
  id: string;
  capsuleTypeId: string;
  title: string;
  parentCapsuleId: string | null;
  createdAt: number;
  updatedAt: number;
};

export type CapsuleRow = {
  id: string;
  capsule_type_id: string;
  title: string;
  parent_capsule_id: string | null;
  created_at: number;
  updated_at: number;
};

export function rowToCapsule(row: CapsuleRow): Capsule {
  return {
    id: row.id,
    capsuleTypeId: row.capsule_type_id,
    title: row.title,
    parentCapsuleId: row.parent_capsule_id,
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

/**
 * One capsule's embedding vector (7.2: "index capsules into local vector
 * store"), keyed by `capsuleId` — at most one per capsule, replaced
 * wholesale on re-index rather than versioned. `content` is the exact
 * text that was embedded (title + type + every field's name/value,
 * assembled by `features/capsule-rag`'s `buildCapsuleText`) — kept
 * alongside the vector so a re-index can cheaply detect "nothing actually
 * changed" via a plain string comparison, no hashing, no extra
 * dependency. Lives inside `entities/capsule` rather than its own slice
 * for the same reason `CapsuleValue` does — this is fundamentally the
 * capsule's own derived data, not a relation between two entities (unlike
 * `capsule_tags`/`capsule_links`, which live inside `entities/tag`/
 * `entities/link` instead).
 */
export type CapsuleEmbedding = {
  capsuleId: string;
  embedding: number[];
  content: string;
  updatedAt: number;
};

export type CapsuleEmbeddingRow = {
  capsule_id: string;
  /** JSON-serialized `number[]` — SQLite has no native array/vector column type. */
  embedding: string;
  content: string;
  updated_at: number;
};

export function rowToCapsuleEmbedding(
  row: CapsuleEmbeddingRow,
): CapsuleEmbedding {
  return {
    capsuleId: row.capsule_id,
    embedding: JSON.parse(row.embedding) as number[],
    content: row.content,
    updatedAt: row.updated_at,
  };
}
