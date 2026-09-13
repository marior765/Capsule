import type { SQLiteDatabase } from "expo-sqlite";
import { getCapsuleById, updateCapsule } from "@/entities/capsule";

/**
 * Walks the ancestor chain starting at `parentId`, looking for `capsuleId`.
 * True means nesting `capsuleId` under `parentId` would create a cycle —
 * either direct self-parenting (`capsuleId === parentId`) or nesting a
 * capsule under one of its own descendants. The `seen` guard is defensive:
 * it stops an already-corrupt chain from looping forever rather than
 * assuming the existing data is clean.
 */
export function wouldCreateCycle(
  db: SQLiteDatabase,
  capsuleId: string,
  parentId: string,
): boolean {
  if (capsuleId === parentId) return true;

  const seen = new Set<string>();
  let current: string | null = parentId;
  while (current !== null) {
    if (current === capsuleId) return true;
    if (seen.has(current)) return true;
    seen.add(current);
    current = getCapsuleById(db, current)?.parentCapsuleId ?? null;
  }
  return false;
}

/**
 * Re-parents a capsule, rejecting any move that would create a cycle
 * (nesting a capsule under itself or one of its own descendants) — per
 * `entities/capsule/model.ts`'s doc comment, nesting is a single-parent
 * tree, and a cycle would make "children of X" queries loop forever.
 * Pass `null` to promote the capsule back to root level.
 *
 * Cross-entity-style validation (even though this only touches one entity)
 * lives here in the feature layer rather than in `entities/capsule`, which
 * stays a dumb CRUD layer — mirroring how `features/link-capsules` and
 * `features/tag-capsule` keep their own composition/validation out of the
 * entity itself.
 */
export function setCapsuleParent(
  db: SQLiteDatabase,
  capsuleId: string,
  parentId: string | null,
): void {
  if (parentId !== null && wouldCreateCycle(db, capsuleId, parentId)) {
    throw new Error(
      `Cannot nest capsule ${capsuleId} under ${parentId} — it would create a cycle`,
    );
  }
  updateCapsule(db, capsuleId, {
    parentCapsuleId: parentId,
    updatedAt: Date.now(),
  });
}
