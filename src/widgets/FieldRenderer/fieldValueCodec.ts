/**
 * Pure (de)serialization for `CapsuleValue.value` (always a `string | null`
 * per entities/capsule) and `CapsuleField.config` (an opaque JSON string
 * per entities/field) — kept separate from `FieldRenderer.tsx` so this
 * logic is testable without rendering, mirroring every other pure-logic
 * extraction in this codebase (`holdGesture.ts`, `formatAuditEntry.ts`,
 * `validatePassphraseSetup.ts`).
 *
 * Every parser degrades gracefully on malformed/unexpected input (missing
 * config, non-JSON, wrong shape, mixed-type arrays) rather than throwing —
 * a corrupted or hand-edited `config`/`value` string should never crash the
 * whole editor, just render as empty/unset.
 *
 * Select-field config shape (`{ options: string[] }`) is defined here,
 * scoped only to what `single_select`/`multi_select` need to render right
 * now — distinct from `relation`/`attachment`'s own config shapes, which
 * are genuinely 6.8's job (structurally different: a relation's config
 * needs a target capsule type reference, an attachment's needs file
 * metadata), not decided here.
 */

export function parseSelectOptions(config: string | null): string[] {
  if (!config) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(config);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "options" in parsed &&
      Array.isArray((parsed as { options: unknown }).options)
    ) {
      return (parsed as { options: unknown[] }).options.filter(
        (o): o is string => typeof o === "string",
      );
    }
  } catch {
    // malformed JSON — fall through to the empty-array default
  }
  return [];
}

/** An unset boolean field (`null`) or any unrecognized string defaults to `false`. */
export function parseBooleanValue(value: string | null): boolean {
  return value === "true";
}

export function serializeBooleanValue(value: boolean): string {
  return value ? "true" : "false";
}

export function parseMultiSelectValue(value: string | null): string[] {
  if (!value) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.filter((v): v is string => typeof v === "string");
    }
  } catch {
    // malformed JSON — fall through to the empty-array default
  }
  return [];
}

export function serializeMultiSelectValue(values: string[]): string {
  return JSON.stringify(values);
}
