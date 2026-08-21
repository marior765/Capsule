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
      if (Number.isNaN(Date.parse(value))) {
        return {
          valid: false,
          error: `${field.name} must be a valid date`,
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
