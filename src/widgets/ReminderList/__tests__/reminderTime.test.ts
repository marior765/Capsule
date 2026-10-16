// Tests for 8.8 (reminder quick picks + time labels) — written before implementation (TDD)
import {
  formatReminderTime,
  reminderPresets,
  resolvePreset,
  defaultPickerDate,
  combinePickedDayAndTime,
  localDayAsUtcMidnight,
} from "../reminderTime";

// Local-time construction keeps these independent of the machine's timezone.
const at = (y: number, mo: number, d: number, h: number, mi = 0) =>
  new Date(y, mo - 1, d, h, mi).getTime();

describe("reminderPresets", () => {
  it("offers in-1-hour, this evening, tomorrow 9am and in-a-week 9am during the day", () => {
    const now = at(2026, 10, 10, 14, 25);
    expect(reminderPresets(now)).toEqual([
      { key: "inHour", label: "In 1 hour", at: now + 60 * 60 * 1000 },
      { key: "evening", label: "This evening, 6pm", at: at(2026, 10, 10, 18) },
      { key: "tomorrow", label: "Tomorrow, 9am", at: at(2026, 10, 11, 9) },
      { key: "nextWeek", label: "In a week, 9am", at: at(2026, 10, 17, 9) },
    ]);
  });

  it("drops 'this evening' once 6pm has passed", () => {
    const now = at(2026, 10, 10, 19, 0);
    expect(reminderPresets(now).map((p) => p.key)).toEqual([
      "inHour",
      "tomorrow",
      "nextWeek",
    ]);
  });

  it("rolls over month ends correctly", () => {
    const now = at(2026, 10, 31, 20, 0);
    const tomorrow = reminderPresets(now).find((p) => p.key === "tomorrow")!;
    expect(tomorrow.at).toBe(at(2026, 11, 1, 9));
  });

  it("every preset is in the future", () => {
    const now = at(2026, 10, 10, 17, 59);
    expect(reminderPresets(now).every((p) => p.at > now)).toBe(true);
  });
});

describe("formatReminderTime", () => {
  const now = at(2026, 10, 10, 14, 0);

  it("says 'Today' for later today", () => {
    expect(formatReminderTime(at(2026, 10, 10, 18, 5), now)).toBe(
      "Today, 18:05",
    );
  });

  it("says 'Tomorrow' for tomorrow", () => {
    expect(formatReminderTime(at(2026, 10, 11, 9), now)).toBe(
      "Tomorrow, 09:00",
    );
  });

  it("uses the date further out", () => {
    expect(formatReminderTime(at(2026, 10, 17, 9), now)).toBe("17 Oct, 09:00");
  });

  it("marks a time that has passed", () => {
    expect(formatReminderTime(at(2026, 10, 10, 9), now)).toBe(
      "Today, 09:00 (passed)",
    );
  });

  it("formats 'Tomorrow' across a year end", () => {
    expect(formatReminderTime(at(2027, 1, 1, 9), at(2026, 12, 31, 22))).toBe(
      "Tomorrow, 09:00",
    );
  });
});

describe("resolvePreset", () => {
  it("computes the preset's time from the moment it's resolved, not when it was shown", () => {
    const later = at(2026, 10, 10, 15, 40);
    expect(resolvePreset("inHour", later)).toBe(later + 60 * 60 * 1000);
  });

  it("returns null for a preset whose time has passed since it was shown", () => {
    expect(resolvePreset("evening", at(2026, 10, 10, 18, 30))).toBeNull();
  });
});

// 8.11: the full date & time picker.
describe("defaultPickerDate", () => {
  it("starts on the next full hour", () => {
    expect(defaultPickerDate(at(2026, 10, 10, 14, 25)).getTime()).toBe(
      at(2026, 10, 10, 15),
    );
  });

  it("rolls into the next day at night", () => {
    expect(defaultPickerDate(at(2026, 10, 31, 23, 40)).getTime()).toBe(
      at(2026, 11, 1, 0),
    );
  });
});

describe("combinePickedDayAndTime (Android: the date dialog returns the day as UTC midnight)", () => {
  it("takes the picked calendar day as-is, whatever the device's timezone", () => {
    // What Android's date dialog returns for 24 Dec: midnight UTC.
    const day = new Date(Date.UTC(2026, 11, 24));
    const time = new Date(2020, 0, 1, 18, 45, 30); // local 18:45 from the time dialog
    expect(combinePickedDayAndTime(day, time)).toBe(at(2026, 12, 24, 18, 45));
  });
});

describe("localDayAsUtcMidnight (what Android's date dialog expects to start on)", () => {
  it("is the local calendar day at midnight UTC", () => {
    const local = new Date(2026, 9, 10, 23, 30); // late evening, local
    expect(localDayAsUtcMidnight(local).getTime()).toBe(Date.UTC(2026, 9, 10));
  });
});

// 10.8: on iOS the inline datetime picker's time row overflowed its measured
// height and sat under the Cancel / Set buttons. The sheet now shows a date
// calendar and a separate time row, each updating its own half of the value
// in local time.
describe("withLocalDate / withLocalTime (10.8: separate date and time pickers)", () => {
  const { withLocalDate, withLocalTime } =
    jest.requireActual<typeof import("../reminderTime")>("../reminderTime");
  const base = new Date(2026, 9, 12, 21, 30, 0, 0); // 12 Oct 2026, 21:30 local

  it("takes the day from the date picker and keeps the time", () => {
    const picked = new Date(2026, 10, 3, 8, 5); // picker's own time is ignored
    expect(withLocalDate(base, picked)).toEqual(
      new Date(2026, 10, 3, 21, 30, 0, 0),
    );
  });

  it("takes the time from the time picker and keeps the day", () => {
    const picked = new Date(1999, 0, 1, 7, 45, 59); // picker's own day is ignored
    expect(withLocalTime(base, picked)).toEqual(
      new Date(2026, 9, 12, 7, 45, 0, 0),
    );
  });

  it("drops seconds and milliseconds so reminders land on the minute", () => {
    const picked = new Date(2026, 9, 12, 9, 15, 42, 123);
    const result = withLocalTime(base, picked);
    expect(result.getSeconds()).toBe(0);
    expect(result.getMilliseconds()).toBe(0);
  });

  it("handles a date pick onto a month with fewer days", () => {
    const jan31 = new Date(2027, 0, 31, 9, 0);
    expect(withLocalDate(jan31, new Date(2027, 1, 28))).toEqual(
      new Date(2027, 1, 28, 9, 0, 0, 0),
    );
  });
});
