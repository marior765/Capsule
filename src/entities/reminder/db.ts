import type { Migration } from "@/shared/db";
import type { SQLiteDatabase, SQLiteVariadicBindParams } from "expo-sqlite";
import { rowToReminder, type Reminder, type ReminderRow } from "./model";

export const remindersMigration: Migration = {
  version: 22,
  up: (db: SQLiteDatabase) => {
    db.execSync(`
      CREATE TABLE IF NOT EXISTS reminders (
        id TEXT PRIMARY KEY,
        capsule_id TEXT NOT NULL,
        remind_at INTEGER NOT NULL,
        message TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);
  },
};

export function getReminderById(
  db: SQLiteDatabase,
  id: string,
): Reminder | null {
  const row = db.getFirstSync(
    "SELECT * FROM reminders WHERE id = ?;",
    id,
  ) as ReminderRow | null;
  return row ? rowToReminder(row) : null;
}

/** Every reminder for one capsule, soonest first. */
export function getRemindersByCapsule(
  db: SQLiteDatabase,
  capsuleId: string,
): Reminder[] {
  const rows = db.getAllSync(
    "SELECT * FROM reminders WHERE capsule_id = ? ORDER BY remind_at ASC;",
    capsuleId,
  ) as ReminderRow[];
  return rows.map(rowToReminder);
}

/**
 * Reminders whose `remindAt` is at or before `now` — the query a future
 * notification-scheduling layer will use to know what to fire. "At or
 * before," not strictly before: a reminder due exactly now is due.
 */
export function getDueReminders(db: SQLiteDatabase, now: number): Reminder[] {
  const rows = db.getAllSync(
    "SELECT * FROM reminders WHERE remind_at <= ? ORDER BY remind_at ASC;",
    now,
  ) as ReminderRow[];
  return rows.map(rowToReminder);
}

export function insertReminder(db: SQLiteDatabase, reminder: Reminder): void {
  db.runSync(
    `INSERT INTO reminders (id, capsule_id, remind_at, message, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?);`,
    reminder.id,
    reminder.capsuleId,
    reminder.remindAt,
    reminder.message,
    reminder.createdAt,
    reminder.updatedAt,
  );
}

export function updateReminder(
  db: SQLiteDatabase,
  id: string,
  patch: Partial<Omit<Reminder, "id" | "capsuleId">>,
): void {
  const fields: string[] = [];
  const values: unknown[] = [];

  if (patch.remindAt !== undefined) {
    fields.push("remind_at = ?");
    values.push(patch.remindAt);
  }
  if (patch.message !== undefined) {
    fields.push("message = ?");
    values.push(patch.message);
  }
  if (patch.createdAt !== undefined) {
    fields.push("created_at = ?");
    values.push(patch.createdAt);
  }
  if (patch.updatedAt !== undefined) {
    fields.push("updated_at = ?");
    values.push(patch.updatedAt);
  }

  if (fields.length === 0) return;

  values.push(id);
  db.runSync(
    `UPDATE reminders SET ${fields.join(", ")} WHERE id = ?;`,
    ...(values as SQLiteVariadicBindParams),
  );
}

export function deleteReminder(db: SQLiteDatabase, id: string): void {
  db.runSync("DELETE FROM reminders WHERE id = ?;", id);
}

/** Removes every reminder belonging to one capsule — e.g. before deleting the capsule itself (composed by the feature layer, not automatic here). */
export function deleteRemindersByCapsule(
  db: SQLiteDatabase,
  capsuleId: string,
): void {
  db.runSync("DELETE FROM reminders WHERE capsule_id = ?;", capsuleId);
}
