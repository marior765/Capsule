import type { Capsule } from "@/entities/capsule";

/** Pure — operates on an already-fetched list, does no db work of its own. */
export function filterCapsulesByType(
  capsules: Capsule[],
  capsuleTypeId: string | null,
): Capsule[] {
  if (!capsuleTypeId) return capsules;
  return capsules.filter((capsule) => capsule.capsuleTypeId === capsuleTypeId);
}

export type CapsuleSortKey = "title" | "createdAt" | "updatedAt";
export type SortDirection = "asc" | "desc";

/**
 * Pure, non-mutating — `getAllCapsules` already orders by `updated_at DESC`
 * at the db layer, but that's a default, not a guarantee callers should
 * depend on once a user picks a different sort; this always re-sorts
 * explicitly rather than relying on the input's existing order.
 */
export function sortCapsules(
  capsules: Capsule[],
  key: CapsuleSortKey,
  direction: SortDirection = "asc",
): Capsule[] {
  const sorted = [...capsules].sort((a, b) =>
    key === "title"
      ? a.title.localeCompare(b.title, undefined, { sensitivity: "base" })
      : a[key] - b[key],
  );
  return direction === "desc" ? sorted.reverse() : sorted;
}
