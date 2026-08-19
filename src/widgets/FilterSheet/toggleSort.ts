import type {
  CapsuleSortKey,
  SortDirection,
} from "@/features/filter-sort-capsules";

/**
 * Decides the next sort state when a sort-key row is pressed — matches the
 * common "tap a table column header" convention: pressing the key that's
 * already active flips direction, pressing a different key selects it
 * fresh at ascending (never carries over the previous key's direction,
 * which would be a surprising, unrelated-looking jump).
 */
export function toggleSort(
  currentKey: CapsuleSortKey,
  currentDirection: SortDirection,
  pressedKey: CapsuleSortKey,
): { key: CapsuleSortKey; direction: SortDirection } {
  if (pressedKey === currentKey) {
    return {
      key: pressedKey,
      direction: currentDirection === "asc" ? "desc" : "asc",
    };
  }
  return { key: pressedKey, direction: "asc" };
}
