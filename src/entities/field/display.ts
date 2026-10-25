import { parseBooleanValue, parseMultiSelectValue } from "./codec";
import type { CapsuleField } from "./model";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

const DAY = /^(\d{4})-(\d{2})-(\d{2})/;

/** A stored date's day as [year, monthIndex, day], or null when it isn't a real date. */
export function parseDateValue(
  value: string | null,
): [number, number, number] | null {
  const match = value ? DAY.exec(value.trim()) : null;
  if (!match) return null;
  const [year, month, day] = [
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
  ];
  const check = new Date(year, month, day);
  return check.getFullYear() === year &&
    check.getMonth() === month &&
    check.getDate() === day
    ? [year, month, day]
    : null;
}

/** "5 Oct 2026"; anything that isn't a real date is shown as stored. */
export function formatDateValue(value: string): string {
  const day = parseDateValue(value);
  return day ? `${day[2]} ${MONTHS[day[1]]} ${day[0]}` : value;
}

/**
 * A stored value as a person reads it, for summaries such as capsule cards:
 * "Yes"/"No", "Sci-fi, Classic", "5 Oct 2026", a long text's first line.
 * `null` when there's nothing to show — an empty value, or a relation or
 * attachment, whose content isn't held in the value itself.
 */
export function formatFieldValue(
  field: CapsuleField,
  value: string | null,
): string | null {
  if (value === null || value.trim() === "") return null;
  switch (field.fieldType) {
    case "boolean":
      return parseBooleanValue(value) ? "Yes" : "No";
    case "multi_select": {
      const options = parseMultiSelectValue(value);
      return options.length > 0 ? options.join(", ") : null;
    }
    case "date":
      return formatDateValue(value);
    case "relation":
    case "attachment":
      return null;
    case "long_text":
      return value.trim().split("\n")[0].trim();
    default:
      return value.trim();
  }
}
