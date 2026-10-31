import {
  normalizeFieldName,
  validateFieldValue,
  type CapsuleField,
  type FieldType,
} from "@/entities/field";

/** What quick capture creates: a title and, maybe, some field values. */
export type QuickCaptureResult = {
  title: string;
  /** fieldId -> value, the shape `createCapsule`'s `values` takes. */
  values: Record<string, string>;
};

/** Field names that mean "who made it", for "X by Y". */
const BY_FIELD_NAMES = new Set([
  "author",
  "artist",
  "creator",
  "writer",
  "director",
  "by",
]);

/** A trailing four-digit year in parentheses: "Dune (1965)". */
const TRAILING_YEAR = /^(.*\S)\s*\((\d{4})\)$/;

/** " by " between words, any case. */
const BY_SEPARATOR = /\s+by\s+/gi;

/** The one field of `fieldType` whose name is in `names`; null if none or several. */
function onlyField(
  fields: readonly CapsuleField[],
  fieldType: FieldType,
  names: ReadonlySet<string>,
): CapsuleField | null {
  const matches = fields.filter(
    (f) => f.fieldType === fieldType && names.has(normalizeFieldName(f.name)),
  );
  return matches.length === 1 ? matches[0] : null;
}

/**
 * Quick capture's field filling (10.43): simple, deterministic patterns, no
 * model. "X by Y" puts Y in the type's single author-like text field
 * (Author, Artist, Creator, Writer, Director, By), splitting on the LAST
 * " by ": "Stand by Me by Stephen King" keeps "Stand by Me" as the title
 * (though "Stand by Me" alone, with an Author field, becomes Stand / Me —
 * editable afterwards). A trailing "(1965)" goes to a number field named
 * Year. A value is only filled if the field itself accepts it (e.g. a Year
 * range). When a pattern doesn't match, the value isn't accepted, or the
 * type has no such field (or more than one), that text stays in the title,
 * so nothing typed is lost.
 */
export function parseQuickCapture(
  text: string,
  fields: readonly CapsuleField[],
): QuickCaptureResult {
  let title = text.trim();
  const values: Record<string, string> = {};

  const yearField = onlyField(fields, "number", new Set(["year"]));
  const year = TRAILING_YEAR.exec(title);
  if (yearField && year && validateFieldValue(yearField, year[2]).valid) {
    title = year[1].trim();
    values[yearField.id] = year[2];
  }

  const byField = onlyField(fields, "text", BY_FIELD_NAMES);
  const separators = [...title.matchAll(BY_SEPARATOR)];
  const last = separators[separators.length - 1];
  if (byField && last?.index !== undefined) {
    const before = title.slice(0, last.index).trim();
    const after = title.slice(last.index + last[0].length).trim();
    if (before && after && validateFieldValue(byField, after).valid) {
      title = before;
      values[byField.id] = after;
    }
  }

  return { title, values };
}
