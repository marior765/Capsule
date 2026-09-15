// Tests for step 8.8 — written before implementation (TDD)
import type { SQLiteDatabase } from "expo-sqlite";
import { openDb, runMigrations, _resetDbForTesting } from "@/shared/db";
import { getRemindersByCapsule, remindersMigration } from "@/entities/reminder";
import { createReminder, rescheduleReminder, removeReminder } from "../index";

let db: SQLiteDatabase;

beforeEach(() => {
  _resetDbForTesting();
  db = openDb();
  runMigrations(db, [remindersMigration]);
});

describe("createReminder", () => {
  it("creates a reminder for the given capsule and time", () => {
    const reminder = createReminder(db, { capsuleId: "c-1", remindAt: 5000 });
    expect(reminder.capsuleId).toBe("c-1");
    expect(reminder.remindAt).toBe(5000);
  });

  it("defaults to a null message when none is given", () => {
    const reminder = createReminder(db, { capsuleId: "c-1", remindAt: 5000 });
    expect(reminder.message).toBeNull();
  });

  it("stores a custom message when given", () => {
    const reminder = createReminder(db, {
      capsuleId: "c-1",
      remindAt: 5000,
      message: "Check on this",
    });
    expect(reminder.message).toBe("Check on this");
  });

  it("sets createdAt and updatedAt to the same fresh timestamp", () => {
    const before = Date.now();
    const reminder = createReminder(db, { capsuleId: "c-1", remindAt: 5000 });
    expect(reminder.createdAt).toBeGreaterThanOrEqual(before);
    expect(reminder.createdAt).toBe(reminder.updatedAt);
  });

  it("persists the reminder — it shows up in getRemindersByCapsule", () => {
    createReminder(db, { capsuleId: "c-1", remindAt: 5000 });
    expect(getRemindersByCapsule(db, "c-1")).toHaveLength(1);
  });

  it("creating two reminders produces two distinct ids", () => {
    const a = createReminder(db, { capsuleId: "c-1", remindAt: 1000 });
    const b = createReminder(db, { capsuleId: "c-1", remindAt: 2000 });
    expect(a.id).not.toBe(b.id);
  });
});

describe("rescheduleReminder", () => {
  it("changes a reminder's remindAt", () => {
    const reminder = createReminder(db, { capsuleId: "c-1", remindAt: 1000 });
    rescheduleReminder(db, reminder.id, 9000);
    expect(
      getRemindersByCapsule(db, "c-1").find((r) => r.id === reminder.id)
        ?.remindAt,
    ).toBe(9000);
  });

  it("bumps updatedAt", () => {
    const reminder = createReminder(db, { capsuleId: "c-1", remindAt: 1000 });
    const before = reminder.updatedAt;
    rescheduleReminder(db, reminder.id, 9000);
    const found = getRemindersByCapsule(db, "c-1").find(
      (r) => r.id === reminder.id,
    );
    expect(found!.updatedAt).toBeGreaterThanOrEqual(before);
  });

  it("rescheduling an unknown id does not throw", () => {
    expect(() => rescheduleReminder(db, "missing", 9000)).not.toThrow();
  });
});

describe("removeReminder", () => {
  it("removes the reminder", () => {
    const reminder = createReminder(db, { capsuleId: "c-1", remindAt: 1000 });
    removeReminder(db, reminder.id);
    expect(getRemindersByCapsule(db, "c-1")).toEqual([]);
  });

  it("leaves other reminders on the same capsule intact", () => {
    const a = createReminder(db, { capsuleId: "c-1", remindAt: 1000 });
    createReminder(db, { capsuleId: "c-1", remindAt: 2000 });
    removeReminder(db, a.id);
    expect(getRemindersByCapsule(db, "c-1")).toHaveLength(1);
  });

  it("removing an unknown id does not throw", () => {
    expect(() => removeReminder(db, "missing")).not.toThrow();
  });
});
