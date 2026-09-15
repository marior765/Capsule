// Tests for step 8.8 — written before implementation (TDD)
import type { SQLiteDatabase } from "expo-sqlite";
import { openDb, runMigrations, _resetDbForTesting } from "@/shared/db";
import {
  deleteReminder,
  deleteRemindersByCapsule,
  getDueReminders,
  getReminderById,
  getRemindersByCapsule,
  insertReminder,
  remindersMigration,
  updateReminder,
  type Reminder,
} from "../index";

const makeReminder = (overrides: Partial<Reminder> = {}): Reminder => ({
  id: `r-${Math.random().toString(36).slice(2)}`,
  capsuleId: "c-1",
  remindAt: 1000,
  message: null,
  createdAt: 1000,
  updatedAt: 1000,
  ...overrides,
});

let db: SQLiteDatabase;

beforeEach(() => {
  _resetDbForTesting();
  db = openDb();
  runMigrations(db, [remindersMigration]);
});

describe("entities/reminder — CRUD", () => {
  it("inserts and retrieves a reminder", () => {
    const reminder = makeReminder({ message: "Follow up" });
    insertReminder(db, reminder);
    const found = getReminderById(db, reminder.id);
    expect(found?.capsuleId).toBe("c-1");
    expect(found?.remindAt).toBe(1000);
    expect(found?.message).toBe("Follow up");
  });

  it("stores a null message — a reminder doesn't require custom text", () => {
    const reminder = makeReminder({ message: null });
    insertReminder(db, reminder);
    expect(getReminderById(db, reminder.id)?.message).toBeNull();
  });

  it("getReminderById returns null for an unknown id", () => {
    expect(getReminderById(db, "missing")).toBeNull();
  });

  it("getRemindersByCapsule orders by remindAt ascending — soonest first", () => {
    insertReminder(
      db,
      makeReminder({ id: "later", capsuleId: "c-1", remindAt: 3000 }),
    );
    insertReminder(
      db,
      makeReminder({ id: "soonest", capsuleId: "c-1", remindAt: 1000 }),
    );
    insertReminder(
      db,
      makeReminder({ id: "middle", capsuleId: "c-1", remindAt: 2000 }),
    );
    expect(getRemindersByCapsule(db, "c-1").map((r) => r.id)).toEqual([
      "soonest",
      "middle",
      "later",
    ]);
  });

  it("getRemindersByCapsule only returns reminders for that capsule", () => {
    insertReminder(db, makeReminder({ id: "a", capsuleId: "c-1" }));
    insertReminder(db, makeReminder({ id: "b", capsuleId: "c-2" }));
    expect(getRemindersByCapsule(db, "c-1").map((r) => r.id)).toEqual(["a"]);
  });

  it("getRemindersByCapsule returns an empty array when none exist", () => {
    expect(getRemindersByCapsule(db, "c-1")).toEqual([]);
  });

  it("updateReminder can reschedule remindAt", () => {
    const reminder = makeReminder({ remindAt: 1000 });
    insertReminder(db, reminder);
    updateReminder(db, reminder.id, { remindAt: 5000, updatedAt: 2000 });
    expect(getReminderById(db, reminder.id)?.remindAt).toBe(5000);
  });

  it("updateReminder can change the message", () => {
    const reminder = makeReminder({ message: "Original" });
    insertReminder(db, reminder);
    updateReminder(db, reminder.id, { message: "Updated" });
    expect(getReminderById(db, reminder.id)?.message).toBe("Updated");
  });

  it("updating with an empty patch is a no-op, not an error", () => {
    const reminder = makeReminder();
    insertReminder(db, reminder);
    expect(() => updateReminder(db, reminder.id, {})).not.toThrow();
    expect(getReminderById(db, reminder.id)?.remindAt).toBe(1000);
  });

  it("deleteReminder removes the record", () => {
    const reminder = makeReminder();
    insertReminder(db, reminder);
    deleteReminder(db, reminder.id);
    expect(getReminderById(db, reminder.id)).toBeNull();
  });

  it("deleting an unknown id does not throw", () => {
    expect(() => deleteReminder(db, "missing")).not.toThrow();
  });

  it("deleteRemindersByCapsule removes every reminder for that capsule, leaving other capsules' reminders intact", () => {
    insertReminder(db, makeReminder({ id: "a", capsuleId: "c-1" }));
    insertReminder(db, makeReminder({ id: "b", capsuleId: "c-1" }));
    insertReminder(db, makeReminder({ id: "c", capsuleId: "c-2" }));

    deleteRemindersByCapsule(db, "c-1");

    expect(getRemindersByCapsule(db, "c-1")).toEqual([]);
    expect(getRemindersByCapsule(db, "c-2")).toHaveLength(1);
  });

  it("deleteRemindersByCapsule for a capsule with no reminders does not throw", () => {
    expect(() => deleteRemindersByCapsule(db, "no-reminders")).not.toThrow();
  });

  it("no FK constraint — a reminder can reference a capsule id that doesn't exist", () => {
    expect(() =>
      insertReminder(db, makeReminder({ capsuleId: "nonexistent" })),
    ).not.toThrow();
  });
});

describe("entities/reminder — getDueReminders", () => {
  it("returns reminders whose remindAt is at or before the given time", () => {
    insertReminder(db, makeReminder({ id: "past", remindAt: 1000 }));
    insertReminder(db, makeReminder({ id: "exact", remindAt: 2000 }));
    insertReminder(db, makeReminder({ id: "future", remindAt: 3000 }));

    expect(
      getDueReminders(db, 2000)
        .map((r) => r.id)
        .sort(),
    ).toEqual(["exact", "past"]);
  });

  it("orders due reminders soonest first", () => {
    insertReminder(db, makeReminder({ id: "later", remindAt: 500 }));
    insertReminder(db, makeReminder({ id: "earlier", remindAt: 100 }));

    expect(getDueReminders(db, 1000).map((r) => r.id)).toEqual([
      "earlier",
      "later",
    ]);
  });

  it("returns an empty array when nothing is due yet", () => {
    insertReminder(db, makeReminder({ remindAt: 5000 }));
    expect(getDueReminders(db, 1000)).toEqual([]);
  });
});
