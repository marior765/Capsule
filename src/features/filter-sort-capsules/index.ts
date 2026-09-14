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

export type BoardColumn = {
  /** The option's own value, or the `"unset"` sentinel for the trailing bucket. */
  key: string;
  label: string;
  capsules: Capsule[];
};

/**
 * Groups capsules into board columns (8.7) by a `single_select` field's
 * value — one column per `options` entry, in the field's own defined
 * order, plus one trailing `"unset"` column. A capsule lands in
 * `"unset"` both when it has no value for the field at all AND when its
 * value no longer matches any of `options` (a stale value left behind by
 * editing the field's config after some capsules were already set) —
 * same graceful-degradation spirit as the rest of this codebase's
 * capsule-domain references: a capsule is never silently dropped from
 * the board just because its recorded value doesn't currently resolve.
 *
 * Pure — `valueByCapsuleId` is already resolved by the caller (mirrors
 * `filterCapsulesByType`/`sortCapsules`' own "operates on an
 * already-fetched list" shape).
 */
export function groupCapsulesBySelectField(
  capsules: Capsule[],
  options: string[],
  valueByCapsuleId: Record<string, string | null>,
): BoardColumn[] {
  const columns: BoardColumn[] = options.map((option) => ({
    key: option,
    label: option,
    capsules: [],
  }));
  const unset: Capsule[] = [];

  for (const capsule of capsules) {
    const value = valueByCapsuleId[capsule.id] ?? null;
    const column = value
      ? columns.find((candidate) => candidate.key === value)
      : undefined;
    if (column) {
      column.capsules.push(capsule);
    } else {
      unset.push(capsule);
    }
  }

  return [...columns, { key: "unset", label: "No status", capsules: unset }];
}
