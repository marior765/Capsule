/**
 * A directional relation between two capsules ("CapsuleLink" per
 * CLAUDE.md's Capsule domain model). Must degrade gracefully if its
 * target is missing — matches this repo's "no SQL FK, graceful
 * degradation on a dangling reference" convention (the same idea as
 * `CapsuleCard`'s "Unknown type" fallback for a deleted `CapsuleType`).
 * Deliberately doesn't reference `entities/capsule` — like `capsule_tags`
 * (entities/tag), a link only ever stores raw capsule ids; resolving
 * those ids to an actual `Capsule` (and rendering a placeholder when one
 * is missing) is the caller's job, not this entity's — that's 6.8's
 * relation-field UI, not this step.
 */
export type CapsuleLink = {
  id: string;
  fromCapsuleId: string;
  toCapsuleId: string;
  /**
   * The `CapsuleField.id` (a "relation" field) this link represents a
   * value of, or `null` for a generic, not-field-backed link between two
   * capsules. A `CapsuleType` can define more than one relation field
   * (e.g. "Author" and "Related books" on the same type) — without this,
   * `getLinksFrom(capsuleId)` would mix every relation field's links
   * together with no way to tell which field a given link belongs to.
   */
  fieldId: string | null;
  /** Freeform, optional description of the relationship (e.g. "related to", "part of") — not a fixed enum. */
  label: string | null;
  createdAt: number;
};

export type CapsuleLinkRow = {
  id: string;
  from_capsule_id: string;
  to_capsule_id: string;
  field_id: string | null;
  label: string | null;
  created_at: number;
};

export function rowToCapsuleLink(row: CapsuleLinkRow): CapsuleLink {
  return {
    id: row.id,
    fromCapsuleId: row.from_capsule_id,
    toCapsuleId: row.to_capsule_id,
    fieldId: row.field_id,
    label: row.label,
    createdAt: row.created_at,
  };
}
