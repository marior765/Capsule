import { findFieldNameClash } from "@/entities/field";

/** The message to show under "Field name", or `null` when the draft is fine. */
export function newFieldNameError(
  fields: readonly { id: string; name: string }[],
  draftName: string,
): string | null {
  if (!draftName.trim()) return null;
  const clash = findFieldNameClash(fields, draftName);
  return clash ? `There's already a field called "${clash.name}".` : null;
}
