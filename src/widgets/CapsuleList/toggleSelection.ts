/**
 * Toggles one id's membership in a selection set — mirrors `FilterSheet`'s
 * `toggleSort`/`SchemaBuilder`'s `moveField` precedent: pure, extracted
 * out of the widget/route for testability since there's no
 * `@testing-library/react-native` in this repo. Returns a NEW `Set`
 * rather than mutating the caller's — a bulk-select UI's "select" state
 * should behave like any other piece of controlled component state.
 */
export function toggleSelection(
  selected: Set<string>,
  id: string,
): Set<string> {
  const next = new Set(selected);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  return next;
}
