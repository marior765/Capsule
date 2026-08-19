export type MoveDirection = "up" | "down";

/**
 * Returns a new array with the item at `index` swapped with its neighbor
 * in the given direction. Returns the exact SAME array reference,
 * unchanged, when the move would go out of bounds — moving the first item
 * up, the last item down, or an out-of-range index — so callers can use
 * reference equality to detect a no-op move rather than re-deriving the
 * bounds check themselves.
 */
export function moveField<T>(
  items: T[],
  index: number,
  direction: MoveDirection,
): T[] {
  if (index < 0 || index >= items.length) return items;
  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= items.length) return items;

  const next = [...items];
  const temp = next[index];
  next[index] = next[targetIndex];
  next[targetIndex] = temp;
  return next;
}
