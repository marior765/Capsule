/**
 * Quick reminder times for the capsule screen (8.8). No date-picker package
 * is installed, so reminders are set from a few fixed choices instead. Pure:
 * `now` is passed in, everything is computed in the device's local time.
 */

export type ReminderPresetKey = "inHour" | "evening" | "tomorrow" | "nextWeek";

/** `key` is stable (testIDs, lookups); `label` is display copy and may change. */
export type ReminderPreset = {
  key: ReminderPresetKey;
  label: string;
  at: number;
};

const HOUR = 60 * 60 * 1000;
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

/** The local day `daysAhead` after `now`'s, at `hour`:00. */
function dayAt(now: number, daysAhead: number, hour: number): number {
  const d = new Date(now);
  return new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate() + daysAhead,
    hour,
  ).getTime();
}

/** The quick choices offered at `now`; every one is strictly in the future. */
export function reminderPresets(now: number): ReminderPreset[] {
  const presets: ReminderPreset[] = [
    { key: "inHour", label: "In 1 hour", at: now + HOUR },
    { key: "evening", label: "This evening, 6pm", at: dayAt(now, 0, 18) },
    { key: "tomorrow", label: "Tomorrow, 9am", at: dayAt(now, 1, 9) },
    { key: "nextWeek", label: "In a week, 9am", at: dayAt(now, 7, 9) },
  ];
  return presets.filter((p) => p.at > now);
}

/**
 * The preset's time computed at `now` — call it when the preset is tapped,
 * not when the list was shown, so "In 1 hour" means from the tap. Null if
 * that preset is no longer offered (e.g. 6pm has passed meanwhile).
 */
export function resolvePreset(
  key: ReminderPresetKey,
  now: number,
): number | null {
  return reminderPresets(now).find((p) => p.key === key)?.at ?? null;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "Today, 18:05" / "Tomorrow, 09:00" / "17 Oct, 09:00", plus "(passed)" once due. */
export function formatReminderTime(at: number, now: number): string {
  const d = new Date(at);
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const dayStart = dayAt(at, 0, 0);
  const day =
    dayStart === dayAt(now, 0, 0)
      ? "Today"
      : dayStart === dayAt(now, 1, 0)
        ? "Tomorrow"
        : `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return `${day}, ${time}${at <= now ? " (passed)" : ""}`;
}

/** Where the date & time picker starts (8.11): the next full hour. */
export function defaultPickerDate(now: number): Date {
  const d = new Date(now);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours() + 1);
}

/**
 * One moment from Android's two dialogs (8.11). The date dialog returns the
 * chosen calendar day as midnight UTC — so the day is read with the UTC
 * getters (local getters would give the previous day anywhere behind UTC);
 * the time dialog returns a local time, read with the local getters.
 */
export function combinePickedDayAndTime(day: Date, time: Date): number {
  return new Date(
    day.getUTCFullYear(),
    day.getUTCMonth(),
    day.getUTCDate(),
    time.getHours(),
    time.getMinutes(),
  ).getTime();
}

/** A local calendar day in the form Android's date dialog uses: its midnight UTC. */
export function localDayAsUtcMidnight(date: Date): Date {
  return new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
}

/**
 * `base` with its local day replaced by `picked`'s (time of day kept) — for
 * the iOS date calendar, which lives apart from the time picker (10.8).
 */
export function withLocalDate(base: Date, picked: Date): Date {
  return new Date(
    picked.getFullYear(),
    picked.getMonth(),
    picked.getDate(),
    base.getHours(),
    base.getMinutes(),
  );
}

/** `base` with its local time of day replaced by `picked`'s, on the minute. */
export function withLocalTime(base: Date, picked: Date): Date {
  return new Date(
    base.getFullYear(),
    base.getMonth(),
    base.getDate(),
    picked.getHours(),
    picked.getMinutes(),
  );
}

/**
 * Whether any upcoming reminder has no scheduled notification — i.e. it is
 * saved but won't pop up, because notifications are off for the app.
 */
export function hasUnscheduledReminders(
  reminders: readonly { remindAt: number; notificationId: string | null }[],
  now: number,
): boolean {
  return reminders.some((r) => r.notificationId === null && r.remindAt > now);
}
