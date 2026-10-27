// Tests for step 10.27 — written before implementation (TDD)
//
// Reviewer finding: after "Open Settings" → allow notifications → back, the
// reminders saved while notifications were off stayed unscheduled (only an
// import ever rescheduled them), so the banner kept saying they were off.
import type { SQLiteDatabase } from "expo-sqlite";
import { openDb, runMigrations, _resetDbForTesting } from "@/shared/db";
import {
  getReminderById,
  insertReminder,
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
import { hasNotificationPermission } from "@/shared/notifications";
import { addReminder, scheduleRemindersIfAllowed } from "../index";

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
    title: "Dentist",
    parentCapsuleId: null,
    createdAt: 1,
    updatedAt: 1,
  });
  insertReminder(db, {
    id: "r1",
    capsuleId: "c1",
    remindAt: NOW + 60_000,
    message: null,
    notificationId: null,
    createdAt: 1,
    updatedAt: 1,
  });
});

afterEach(() => jest.restoreAllMocks());

describe("hasNotificationPermission", () => {
  it("reports the current state and never asks", async () => {
    __permission.granted = false;
    expect(await hasNotificationPermission()).toBe(false);
    __permission.granted = true;
    expect(await hasNotificationPermission()).toBe(true);
    expect(__permission.prompted).toBe(0);
  });
});

describe("scheduleRemindersIfAllowed", () => {
  it("does nothing — and never prompts — while notifications are off", async () => {
    __permission.granted = false;
    expect(await scheduleRemindersIfAllowed(db)).toBe(0);
    expect(getReminderById(db, "r1")?.notificationId).toBeNull();
    expect(__permission.prompted).toBe(0);
  });

  it("schedules reminders saved while they were off, once they're allowed", async () => {
    __permission.granted = true;
    expect(await scheduleRemindersIfAllowed(db)).toBe(1);
    expect(getReminderById(db, "r1")?.notificationId).not.toBeNull();
  });

  it("never leaves two notifications for one reminder when calls overlap", async () => {
    // e.g. the app coming back to the foreground twice in quick succession,
    // or right after the permission prompt during an add.
    __permission.granted = true;
    const [a, b] = await Promise.all([
      scheduleRemindersIfAllowed(db),
      scheduleRemindersIfAllowed(db),
    ]);
    expect(a + b).toBe(1);
    expect(__scheduled.size).toBe(1);
    expect(__scheduled.has(getReminderById(db, "r1")!.notificationId!)).toBe(
      true,
    );
  });

  it("an add whose scheduling is overtaken by a sync keeps a single notification", async () => {
    __permission.granted = true;
    // Hold the add's own scheduling call open until a full sync has run —
    // the sync sees the new reminder still unscheduled and schedules it.
    const original = scheduleNotificationAsync.getMockImplementation()!;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    let addIsScheduling = false;
    scheduleNotificationAsync.mockImplementationOnce(async (request) => {
      addIsScheduling = true;
      await gate;
      return original(request);
    });

    const adding = addReminder(db, {
      capsuleId: "c1",
      remindAt: NOW + 120_000,
    });
    while (!addIsScheduling) await Promise.resolve();
    await scheduleRemindersIfAllowed(db);
    release();
    const { reminder } = await adding;

    // r1 (from setup) and the new reminder: one live notification each.
    expect(__scheduled.size).toBe(2);
    expect(
      __scheduled.has(getReminderById(db, reminder.id)!.notificationId!),
    ).toBe(true);
    expect(__scheduled.has(getReminderById(db, "r1")!.notificationId!)).toBe(
      true,
    );
  });
});
