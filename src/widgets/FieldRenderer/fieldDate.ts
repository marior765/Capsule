/**
 * Date fields store a plain calendar day, "YYYY-MM-DD" (validated by
 * `entities/field`). These helpers translate between that string and the
 * native picker's `Date`. Pure; "today" is passed in.
 */

import { parseDateValue } from "@/entities/field";

export { formatDateValue } from "@/entities/field";

const pad = (n: number) => String(n).padStart(2, "0");

/** The iOS calendar's answer: the picked local day. */
export function dateValueFromLocal(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Android's date dialog returns the chosen day as midnight UTC, so it's read
 * with the UTC getters — local ones give the previous day west of UTC.
 */
export function dateValueFromUtc(date: Date): string {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/** Where the picker opens: the stored day, or today when there is none. */
export function pickerStartDate(value: string | null, today: Date): Date {
  const day = parseDateValue(value);
  return day
    ? new Date(day[0], day[1], day[2])
    : new Date(today.getFullYear(), today.getMonth(), today.getDate());
}

/** A local day in the form Android's date dialog uses: its midnight UTC. */
export function localDayAsUtcMidnight(date: Date): Date {
  return new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
}
