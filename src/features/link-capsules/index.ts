import type { SQLiteDatabase } from "expo-sqlite";
import { deleteLink, insertLink, type CapsuleLink } from "@/entities/link";
import { generateId } from "@/shared/lib";

/**
 * Creates a directional link from one capsule to another, with an
 * optional freeform label. Unlike `tagCapsule`, this is never a
 * get-or-create — a capsule can be linked to the same target more than
 * once with different labels (e.g. "author of" and "also mentions"), so
 * dedup would silently drop a real, distinct relationship. Cross-entity
 * composition (id/timestamp generation) lives here in the feature layer,
 * mirroring `create-capsule`'s own `createCapsule`.
 */
export function linkCapsules(
  db: SQLiteDatabase,
  fromCapsuleId: string,
  toCapsuleId: string,
  label?: string | null,
): CapsuleLink {
  const link: CapsuleLink = {
    id: generateId(),
    fromCapsuleId,
    toCapsuleId,
    label: label?.trim() || null,
    createdAt: Date.now(),
  };
  insertLink(db, link);
  return link;
}

/** Removes one link by id. */
export function unlinkCapsules(db: SQLiteDatabase, linkId: string): void {
  deleteLink(db, linkId);
}
