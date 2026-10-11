import type { SQLiteDatabase } from "expo-sqlite";
import {
  deleteReminder,
  getReminderById,
  insertReminder,
  updateReminder,
  type Reminder,
  getRemindersByCapsule,
} from "@/entities/reminder";
import { getAllCapsules, getCapsuleById } from "@/entities/capsule";
import { generateId } from "@/shared/lib";
import {
  cancelLocalNotification,
  ensureNotificationPermission,
  scheduleLocalNotification,
} from "@/shared/notifications";

export type CreateReminderInput = {
  capsuleId: string;
  remindAt: number;
  message?: string | null;
};

/**
 * Creates a reminder for a capsule — cross-entity-composition-shaped id/
 * timestamp generation lives here in the feature layer, mirroring
 * `create-capsule`'s own `createCapsule`. Record only — no OS
 * notification; the app uses `addReminder` below, which also schedules
 * one.
 */
export function createReminder(
  db: SQLiteDatabase,
  input: CreateReminderInput,
): Reminder {
  const now = Date.now();
  const reminder: Reminder = {
    id: generateId(),
    capsuleId: input.capsuleId,
    remindAt: input.remindAt,
    message: input.message ?? null,
    notificationId: null,
    createdAt: now,
    updatedAt: now,
  };
  insertReminder(db, reminder);
  return reminder;
}

/** Changes when a reminder fires. */
export function rescheduleReminder(
  db: SQLiteDatabase,
  id: string,
  remindAt: number,
): void {
  updateReminder(db, id, { remindAt, updatedAt: Date.now() });
}

/** Removes a reminder — e.g. once it's been shown, or cancelled by the user. */
export function removeReminder(db: SQLiteDatabase, id: string): void {
  deleteReminder(db, id);
}

// --- Reminders that actually notify (8.8) ---
//
// The functions above only record reminders. These are what the app uses:
// they also schedule / move / cancel the OS notification. Notifications are
// LOCAL (`shared/notifications`) — nothing leaves the device.

const NOTIFICATION_TITLE = "Reminder";

function assertFuture(remindAt: number): void {
  if (remindAt <= Date.now()) {
    throw new Error("A reminder time must be in the future.");
  }
}

function notificationBody(db: SQLiteDatabase, reminder: Reminder): string {
  return (
    reminder.message ??
    getCapsuleById(db, reminder.capsuleId)?.title ??
    "Open Capsule to see it."
  );
}

async function scheduleFor(
  db: SQLiteDatabase,
  reminder: Reminder,
): Promise<string> {
  return scheduleLocalNotification({
    at: reminder.remindAt,
    title: NOTIFICATION_TITLE,
    body: notificationBody(db, reminder),
  });
}

/**
 * Creates a reminder and schedules its notification, asking for
 * notification permission the first time (this runs from the user's own
 * tap). If notifications aren't allowed the reminder is still kept and
 * `scheduled` is false, so the UI can say so instead of failing silently.
 * If scheduling itself throws, the new reminder is removed again before
 * the error propagates — a retry can't produce a duplicate, and no row is
 * left claiming a reminder that will never fire.
 */
export async function addReminder(
  db: SQLiteDatabase,
  input: CreateReminderInput,
): Promise<{ reminder: Reminder; scheduled: boolean }> {
  assertFuture(input.remindAt);
  if (getCapsuleById(db, input.capsuleId) === null) {
    throw new Error("That capsule no longer exists.");
  }
  const allowed = await ensureNotificationPermission();
  const reminder = createReminder(db, input);
  if (!allowed) return { reminder, scheduled: false };

  let notificationId: string;
  try {
    notificationId = await scheduleFor(db, reminder);
  } catch (error) {
    deleteReminder(db, reminder.id);
    throw error;
  }
  updateReminder(db, reminder.id, { notificationId });
  return { reminder: { ...reminder, notificationId }, scheduled: true };
}

/**
 * Moves a reminder to a new time. The new notification is scheduled and
 * saved FIRST, and only then is the old one cancelled — if scheduling
 * throws, nothing has changed and the original reminder still fires. If
 * notifications have since been turned off, the new time is saved
 * unscheduled and the old notification (now at the wrong time) cancelled.
 * Null for an unknown id.
 */
export async function moveReminder(
  db: SQLiteDatabase,
  id: string,
  remindAt: number,
): Promise<Reminder | null> {
  assertFuture(remindAt);
  const existing = getReminderById(db, id);
  if (existing === null) return null;

  const moved: Reminder = { ...existing, remindAt, updatedAt: Date.now() };
  const allowed = await ensureNotificationPermission();
  const notificationId = allowed ? await scheduleFor(db, moved) : null;
  updateReminder(db, id, {
    remindAt,
    notificationId,
    updatedAt: moved.updatedAt,
  });
  if (existing.notificationId !== null) {
    await cancelLocalNotification(existing.notificationId);
  }
  return { ...moved, notificationId };
}

/** Cancels a reminder's notification and removes the reminder. */
export async function cancelReminder(
  db: SQLiteDatabase,
  id: string,
): Promise<void> {
  const existing = getReminderById(db, id);
  if (existing === null) return;
  if (existing.notificationId !== null) {
    await cancelLocalNotification(existing.notificationId);
  }
  deleteReminder(db, id);
}

/**
 * Schedules a notification for every future reminder that has none — what
 * a restored backup or an imported capsule brings in (notification ids
 * belong to the device that scheduled them, so they never travel). Asks
 * for permission only if there is something to schedule. Returns how many
 * were scheduled; a reminder that can't be scheduled simply stays a record.
 */
export async function scheduleUnscheduledReminders(
  db: SQLiteDatabase,
): Promise<number> {
  const now = Date.now();
  const pending = getAllCapsules(db)
    .flatMap((capsule) => getRemindersByCapsule(db, capsule.id))
    .filter((r) => r.notificationId === null && r.remindAt > now);
  if (pending.length === 0) return 0;
  if (!(await ensureNotificationPermission())) return 0;
  let scheduled = 0;
  for (const reminder of pending) {
    try {
      const notificationId = await scheduleFor(db, reminder);
      try {
        updateReminder(db, reminder.id, { notificationId });
      } catch {
        // Without its id saved it could never be cancelled — take it back.
        await cancelLocalNotification(notificationId);
        continue;
      }
      scheduled += 1;
    } catch {
      // stays a record; the reminder list shows it as not scheduled
    }
  }
  return scheduled;
}
