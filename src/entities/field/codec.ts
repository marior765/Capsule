/**
 * Pure (de)serialization for `CapsuleValue.value` (always a `string | null`
 * per entities/capsule) and `CapsuleField.config` (an opaque JSON string,
 * this entity's own type). Originally lived in `widgets/FieldRenderer`
 * (6.2, its only consumer at the time) — moved here for 6.10 (field
 * validation), whose `validateFieldValue` needs the exact same parsers
 * and, being entity-level domain logic, can't import upward from a
 * widget. Same "second real consumer triggers the move" shape as the
 * `shared/fs` extraction noted in `BLOCKED.md`. `FieldRenderer` now
 * imports these from here instead.
 *
 * Every parser degrades gracefully on malformed/unexpected input (missing
 * config, non-JSON, wrong shape, mixed-type arrays) rather than throwing —
 * a corrupted or hand-edited `config`/`value` string should never crash the
 * whole editor, just render as empty/unset.
 *
 * Select-field config shape (`{ options: string[] }`) is defined here,
 * scoped only to what `single_select`/`multi_select` need — distinct from
 * `relation`/`attachment`'s own config shapes (6.8's job).
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

export type NumberRange = { min: number | null; max: number | null };

/**
 * A `number` field's optional range config (`{ min?, max? }`). Absent or
 * malformed config means "no restriction," not zero — a range check that
 * saw `{min: 0, max: 0}` for genuinely unset config would reject every
 * value, which is why `min`/`max` are `null` rather than `0` for
 * "no bound," and why `0` itself is validated as a real bound (checked
 * with a type guard, not truthiness — `0` is falsy in JS but a
 * perfectly valid minimum).
 */
export function parseNumberRangeConfig(config: string | null): NumberRange {
  if (!config) {
    return { min: null, max: null };
  }
  try {
    const parsed: unknown = JSON.parse(config);
    if (typeof parsed !== "object" || parsed === null) {
      return { min: null, max: null };
    }
    const record = parsed as { min?: unknown; max?: unknown };
    return {
      min: typeof record.min === "number" ? record.min : null,
      max: typeof record.max === "number" ? record.max : null,
    };
  } catch {
    return { min: null, max: null };
  }
}
