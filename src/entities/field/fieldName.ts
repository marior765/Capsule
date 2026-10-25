/**
 * Field names are how values are shown, searched and exported, so two
 * fields on one type that differ only in case or spacing ("Author" vs
 * " author") would be indistinguishable — they count as the same name.
 */
export function normalizeFieldName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * The field in `fields` whose name matches `candidate`, or `null`.
 * `exceptId` skips the field being renamed, so keeping a name isn't a clash.
 */
export function findFieldNameClash<F extends { id: string; name: string }>(
  fields: readonly F[],
  candidate: string,
  exceptId?: string,
): F | null {
  const wanted = normalizeFieldName(candidate);
  return (
    fields.find(
      (field) =>
        field.id !== exceptId && normalizeFieldName(field.name) === wanted,
    ) ?? null
  );
}
