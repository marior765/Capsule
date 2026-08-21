import type { SQLiteDatabase } from "expo-sqlite";
import { deleteLink, insertLink, type CapsuleLink } from "@/entities/link";
import { generateId } from "@/shared/lib";

export type LinkCapsulesInput = {
  /** The `CapsuleField.id` this link represents a value of — omit/null for a generic, not-field-backed link. */
  fieldId?: string | null;
  label?: string | null;
};

/**
 * Creates a directional link from one capsule to another. Unlike
 * `tagCapsule`, this is never a get-or-create — a capsule can be linked
 * to the same target more than once with different labels (e.g. "author
 * of" and "also mentions"), so dedup would silently drop a real, distinct
 * relationship. Cross-entity composition (id/timestamp generation) lives
 * here in the feature layer, mirroring `create-capsule`'s own
 * `createCapsule`.
 *
 * Takes an options object rather than positional `fieldId`/`label`
 * params — two same-typed optional strings in a fixed position is exactly
 * the shape that's easy to swap by accident at a call site.
 */
export function linkCapsules(
  db: SQLiteDatabase,
  fromCapsuleId: string,
  toCapsuleId: string,
  input: LinkCapsulesInput = {},
): CapsuleLink {
  const link: CapsuleLink = {
    id: generateId(),
    fromCapsuleId,
    toCapsuleId,
    fieldId: input.fieldId ?? null,
    label: input.label?.trim() || null,
    createdAt: Date.now(),
  };
  insertLink(db, link);
  return link;
}

/** Removes one link by id. */
export function unlinkCapsules(db: SQLiteDatabase, linkId: string): void {
  deleteLink(db, linkId);
}
