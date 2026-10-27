// Tests for step 10.27 — written before implementation (TDD)
//
// Found in the simulator: with notifications denied, "notifications are off"
// appeared under every reminder and again in a notice after saving, with no
// way to turn them on from there.
import { readFileSync } from "fs";
import { join } from "path";
import type { Reminder } from "@/entities/reminder";
import { hasUnscheduledReminders } from "../reminderTime";

const NOW = 1_000_000;
const reminder = (
  id: string,
  remindAt: number,
  notificationId: string | null,
): Reminder =>
  ({ id, capsuleId: "c", remindAt, notificationId, createdAt: 0 }) as Reminder;

describe("hasUnscheduledReminders", () => {
  it("is true when an upcoming reminder has no notification", () => {
    expect(hasUnscheduledReminders([reminder("a", NOW + 1, null)], NOW)).toBe(
      true,
    );
  });

  it("ignores passed reminders and scheduled ones", () => {
    expect(
      hasUnscheduledReminders(
        [reminder("a", NOW - 1, null), reminder("b", NOW + 1, "n1")],
        NOW,
      ),
    ).toBe(false);
    expect(hasUnscheduledReminders([], NOW)).toBe(false);
  });
});

describe("ReminderList (static)", () => {
  const src = readFileSync(join(__dirname, "../ReminderList.tsx"), "utf8");

  it("says notifications are off once, with a way to Settings", () => {
    expect(src.match(/notifications are off/gi)?.length).toBe(1);
    expect(src).toMatch(/testIDs\.buttons\.openSettings/);
    expect(src).toMatch(/onOpenSettings/);
    expect(src).toMatch(/hasUnscheduledReminders\(/);
    expect(src).toMatch(/notificationsAllowed === false/);
  });
});

describe("capsule screen (static)", () => {
  const screen = readFileSync(
    join(__dirname, "../../../app/(app)/(tabs)/capsules/[id].tsx"),
    "utf8",
  );

  it("doesn't repeat the message in its own notice, and opens the app's Settings", () => {
    expect(screen).not.toMatch(/notifications are off/i);
    expect(screen).toMatch(/Linking\.openSettings\(\)\.catch\(/);
    expect(screen).toMatch(/notificationsAllowed=\{notificationsAllowed\}/);
    // Back from Settings: reminders saved while off get scheduled.
    expect(screen).toMatch(/AppState\.addEventListener\("change"/);
    expect(screen).toMatch(/scheduleRemindersIfAllowed\(db\)/);
    // Never overlapping another sync or a reminder change.
    expect(screen).toMatch(
      /if \(syncInFlight\.current \|\| reminderInFlight\.current\) return;/,
    );
  });
});
