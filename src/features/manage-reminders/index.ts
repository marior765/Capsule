import type { SQLiteDatabase } from "expo-sqlite";
import {
  deleteReminder,
  insertReminder,
  updateReminder,
  type Reminder,
} from "@/entities/reminder";
import { generateId } from "@/shared/lib";

export type CreateReminderInput = {
  capsuleId: string;
  remindAt: number;
  message?: string | null;
};

/**
 * Creates a reminder for a capsule — cross-entity-composition-shaped id/
 * timestamp generation lives here in the feature layer, mirroring
 * `create-capsule`'s own `createCapsule`. Does not schedule or deliver
 * any OS-level notification (see `entities/reminder/model.ts`'s doc
 * comment) — this only records that a reminder should exist.
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
