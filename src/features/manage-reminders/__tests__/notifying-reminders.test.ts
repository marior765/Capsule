// Tests for 8.8 (reminders that actually notify) — written before implementation (TDD)
import type { SQLiteDatabase } from "expo-sqlite";
import { openDb, runMigrations, _resetDbForTesting } from "@/shared/db";
import {
  getReminderById,
  getRemindersByCapsule,
  remindersMigration,
  remindersNotificationIdMigration,
} from "@/entities/reminder";
import {
  capsuleParentIdMigration,
  capsulesMigration,
  insertCapsule,
} from "@/entities/capsule";
import {
  __permission,
  __resetNotificationsMock,
  __scheduled,
  scheduleNotificationAsync,
} from "@/__mocks__/expo-notifications";
import { addReminder, cancelReminder, moveReminder } from "../index";

let db: SQLiteDatabase;
const NOW = 1_000_000;

beforeEach(() => {
  _resetDbForTesting();
  __resetNotificationsMock();
  jest.spyOn(Date, "now").mockReturnValue(NOW);
  db = openDb();
  runMigrations(db, [
    capsulesMigration,
    capsuleParentIdMigration,
    remindersMigration,
    remindersNotificationIdMigration,
  ]);
  insertCapsule(db, {
    id: "c1",
    capsuleTypeId: "t",
    title: "Dentist appointment",
    parentCapsuleId: null,
    createdAt: 1,
    updatedAt: 1,
  });
});

afterEach(() => jest.restoreAllMocks());

describe("addReminder", () => {
  it("records the reminder and schedules a local notification titled by the capsule", async () => {
    const { reminder, scheduled } = await addReminder(db, {
      capsuleId: "c1",
      remindAt: NOW + 60_000,
    });
    expect(scheduled).toBe(true);
    expect(reminder.notificationId).not.toBeNull();
    expect(__scheduled.get(reminder.notificationId!)).toEqual({
      title: "Reminder",
      body: "Dentist appointment",
      date: NOW + 60_000,
    });
    expect(getReminderById(db, reminder.id)?.notificationId).toBe(
      reminder.notificationId,
    );
  });

  it("uses the reminder's own message when given", async () => {
    const { reminder } = await addReminder(db, {
      capsuleId: "c1",
      remindAt: NOW + 1,
      message: "Bring the forms",
    });
    expect(__scheduled.get(reminder.notificationId!)?.body).toBe(
      "Bring the forms",
    );
  });

  it("keeps the reminder but reports it unscheduled when notifications aren't allowed", async () => {
    __permission.granted = false;
    const { reminder, scheduled } = await addReminder(db, {
      capsuleId: "c1",
      remindAt: NOW + 1,
    });
    expect(scheduled).toBe(false);
    expect(reminder.notificationId).toBeNull();
    expect(getReminderById(db, reminder.id)).not.toBeNull();
    expect(__scheduled.size).toBe(0);
  });

  it("rejects a time that isn't in the future, storing nothing", async () => {
    await expect(
      addReminder(db, { capsuleId: "c1", remindAt: NOW }),
    ).rejects.toThrow(/future/i);
    expect(__scheduled.size).toBe(0);
  });
});

describe("moveReminder", () => {
  it("replaces the old notification with one at the new time", async () => {
    const { reminder } = await addReminder(db, {
      capsuleId: "c1",
      remindAt: NOW + 10,
    });
    const oldId = reminder.notificationId!;
    const moved = await moveReminder(db, reminder.id, NOW + 999);

    expect(__scheduled.has(oldId)).toBe(false);
    expect(moved?.notificationId).not.toBe(oldId);
    expect(__scheduled.get(moved!.notificationId!)?.date).toBe(NOW + 999);
    expect(getReminderById(db, reminder.id)?.remindAt).toBe(NOW + 999);
  });

  it("rejects a past time without touching the existing notification", async () => {
    const { reminder } = await addReminder(db, {
      capsuleId: "c1",
      remindAt: NOW + 10,
    });
    await expect(moveReminder(db, reminder.id, NOW - 1)).rejects.toThrow(
      /future/i,
    );
    expect(__scheduled.has(reminder.notificationId!)).toBe(true);
  });

  it("returns null for an unknown reminder", async () => {
    await expect(moveReminder(db, "nope", NOW + 1)).resolves.toBeNull();
  });
});

describe("cancelReminder", () => {
  it("cancels the notification and removes the reminder", async () => {
    const { reminder } = await addReminder(db, {
      capsuleId: "c1",
      remindAt: NOW + 10,
    });
    await cancelReminder(db, reminder.id);
    expect(__scheduled.size).toBe(0);
    expect(getReminderById(db, reminder.id)).toBeNull();
  });

  it("is a no-op for an unknown reminder", async () => {
    await expect(cancelReminder(db, "nope")).resolves.toBeUndefined();
  });
});

describe("failure ordering never leaves a reminder that silently won't fire", () => {
  it("addReminder: if scheduling throws, no reminder row is left behind", async () => {
    scheduleNotificationAsync.mockRejectedValueOnce(new Error("OS refused"));
    await expect(
      addReminder(db, { capsuleId: "c1", remindAt: NOW + 10 }),
    ).rejects.toThrow("OS refused");
    expect(getRemindersByCapsule(db, "c1")).toEqual([]);
  });

  it("moveReminder: if scheduling the new time throws, the original notification and row are untouched", async () => {
    const { reminder } = await addReminder(db, {
      capsuleId: "c1",
      remindAt: NOW + 10,
    });
    scheduleNotificationAsync.mockRejectedValueOnce(new Error("OS refused"));
    await expect(moveReminder(db, reminder.id, NOW + 999)).rejects.toThrow(
      "OS refused",
    );
    expect(__scheduled.has(reminder.notificationId!)).toBe(true);
    expect(getReminderById(db, reminder.id)).toMatchObject({
      remindAt: NOW + 10,
      notificationId: reminder.notificationId,
    });
  });

  it("moveReminder with notifications now off: keeps the new time, unscheduled, and cancels the stale one", async () => {
    const { reminder } = await addReminder(db, {
      capsuleId: "c1",
      remindAt: NOW + 10,
    });
    __permission.granted = false;
    __permission.canAskAgain = false;
    const moved = await moveReminder(db, reminder.id, NOW + 999);
    expect(moved).toMatchObject({ remindAt: NOW + 999, notificationId: null });
    expect(__scheduled.has(reminder.notificationId!)).toBe(false);
  });

  it("addReminder rejects a capsule that doesn't exist", async () => {
    await expect(
      addReminder(db, { capsuleId: "missing", remindAt: NOW + 10 }),
    ).rejects.toThrow(/capsule/i);
    expect(__scheduled.size).toBe(0);
  });
});
