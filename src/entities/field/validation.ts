import {
  parseMultiSelectValue,
  parseNumberRangeConfig,
  parseSelectOptions,
} from "./codec";
import type { CapsuleField } from "./model";

export type FieldValidationResult =
  | { valid: true }
  | { valid: false; error: string };

const VALID: FieldValidationResult = { valid: true };

/**
 * Validates one `CapsuleValue.value` against its `CapsuleField`'s own
 * rules (required, type, range) — pure, no db access, callable from any
 * layer that has both in hand (a route, before it writes). Per-type
 * checks only run once the required check has passed and the value is
 * present — an empty optional field is always valid regardless of type,
 * matching every existing `FieldRenderer` case's own "empty renders as
 * unset" convention.
 *
 * `relation`/`attachment` always pass here, on purpose — neither has a
 * `CapsuleValue` to validate in the first place (6.8: a relation field's
 * data lives in `entities/link`, an attachment's in `entities/attachment`,
 * never `capsule_values`). Validating "does this relation/attachment
 * field have at least one linked capsule/file" is a real, different
 * question that needs `entities/link`/`entities/attachment` data this
 * function was never given — out of scope here, not silently ignored.
 */
export function validateFieldValue(
  field: CapsuleField,
  value: string | null,
): FieldValidationResult {
  // Checked before the required/empty logic below, not just alongside it —
  // neither type has a CapsuleValue to be "required" about in the first
  // place, so a required relation/attachment field must never be flagged
  // "is required" here no matter how empty `value` looks.
  if (field.fieldType === "relation" || field.fieldType === "attachment") {
    return VALID;
  }

  const isEmpty = value === null || value.trim() === "";

  if (field.required && isEmpty) {
    return { valid: false, error: `${field.name} is required` };
  }
  if (isEmpty) {
    return VALID;
  }

  switch (field.fieldType) {
    case "number": {
      const numeric = Number(value);
      if (Number.isNaN(numeric)) {
        return { valid: false, error: `${field.name} must be a number` };
      }
      const range = parseNumberRangeConfig(field.config);
      if (range.min !== null && numeric < range.min) {
        return {
          valid: false,
          error: `${field.name} must be at least ${range.min}`,
        };
      }
      if (range.max !== null && numeric > range.max) {
        return {
          valid: false,
          error: `${field.name} must be at most ${range.max}`,
        };
      }
      return VALID;
    }

    case "date": {
      if (!isCalendarDate(value)) {
        return {
          valid: false,
          error: `${field.name} must be a real date — pick one, or clear it`,
        };
      }
      return VALID;
    }

    case "single_select": {
      const options = parseSelectOptions(field.config);
      if (options.length > 0 && !options.includes(value)) {
        return {
          valid: false,
          error: `${value} is not a valid option for ${field.name}`,
        };
      }
      return VALID;
    }

    case "multi_select": {
      const options = parseSelectOptions(field.config);
      if (options.length === 0) {
        return VALID;
      }
      const selected = parseMultiSelectValue(value);
      const invalid = selected.find((v) => !options.includes(v));
      if (invalid) {
        return {
          valid: false,
          error: `${invalid} is not a valid option for ${field.name}`,
        };
      }
      return VALID;
    }

    case "text":
    case "long_text":
    case "boolean":
      return VALID;
  }
}

/**
 * Validates every field against its current value, collecting only the
 * failures — a field missing entirely from `values` is treated as `null`
 * (the same "unset" a fresh `CapsuleEditor` starts with), not a crash.
 * The caller (a route, before `createCapsule`/`saveCapsuleEdits`) checks
 * `Object.keys(result).length === 0` to decide whether to proceed, and
 * can show each message next to its own field via the fieldId key.
 */
export function validateFields(
  fields: CapsuleField[],
  values: Record<string, string | null>,
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of fields) {
    const result = validateFieldValue(field, values[field.id] ?? null);
    if (!result.valid) {
      errors[field.id] = result.error;
    }
  }
  return errors;
}

/**
 * A real calendar date: `YYYY-MM-DD`, optionally followed by an ISO time
 * (`T10:15:00Z`, `T10:15:00.000+05:00`). Checked arithmetically rather than
 * with `Date.parse`, which is engine-dependent — Hermes, the app's engine,
 * accepts "2026-13-45", and every engine rolls "2026-02-30" into March.
 */
const ISO_DATE =
  /^(\d{4})-(\d{2})-(\d{2})(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})?)?$/;

function isCalendarDate(value: string): boolean {
  const match = ISO_DATE.exec(value.trim());
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return false;
  return day <= daysInMonth(year, month);
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    return leap ? 29 : 28;
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}
