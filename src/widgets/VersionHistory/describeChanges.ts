/**
 * The shape `features/capsule-versioning`'s `VersionChange` has — declared
 * here because a widget doesn't import features; the caller passes it in.
 */
export type HistoryChange = {
  label: string;
  before: string | null;
  after: string | null;
};

const MAX = 30;
const short = (value: string) =>
  value.length > MAX ? `${value.slice(0, MAX - 1)}…` : value;

/** One line saying what an edit did (10.28), e.g. "Edited Author: A → B". */
export function describeChanges(changes: readonly HistoryChange[]): string {
  if (changes.length === 0) return "No changes";
  if (changes.length > 1) {
    return `Edited ${changes.map((c) => c.label).join(", ")}`;
  }
  const [{ label, before, after }] = changes;
  // Stored values differ but read the same (spacing, an emptied list) —
  // no "a → a", and no "Cleared" for something that already read as empty.
  if (before === after) return `Edited ${label}`;
  if (before === null && after !== null) return `Set ${label}: ${short(after)}`;
  if (after === null) return `Cleared ${label}`;
  return `Edited ${label}: ${short(before ?? "")} → ${short(after)}`;
}
