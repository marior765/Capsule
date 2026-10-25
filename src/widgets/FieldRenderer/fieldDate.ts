/**
 * Date fields store a plain calendar day, "YYYY-MM-DD" (validated by
 * `entities/field`). These helpers translate between that string and the
 * native picker's `Date`. Pure; "today" is passed in.
 */

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

const pad = (n: number) => String(n).padStart(2, "0");

/** The stored day as [year, monthIndex, day], or null when it isn't a real date. */
function parseDay(value: string | null): [number, number, number] | null {
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
  const day = parseDay(value);
  return day
    ? new Date(day[0], day[1], day[2])
    : new Date(today.getFullYear(), today.getMonth(), today.getDate());
}

/** "5 Oct 2026"; anything that isn't a real date is shown as stored. */
export function formatDateValue(value: string): string {
  const day = parseDay(value);
  return day ? `${day[2]} ${MONTHS[day[1]]} ${day[0]}` : value;
}

/** A local day in the form Android's date dialog uses: its midnight UTC. */
export function localDayAsUtcMidnight(date: Date): Date {
  return new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
}
