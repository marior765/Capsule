// Tests for 8.8 (reminder quick picks + time labels) — written before implementation (TDD)
import {
  formatReminderTime,
  reminderPresets,
  resolvePreset,
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
