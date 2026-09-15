/**
 * "Local reminders (on-device notifications)" per docs/DEVELOPMENT_PLAN.md
 * 8.8 — a point in time plus an optional message, attached to a capsule.
 * No SQL FOREIGN KEY on `capsuleId`, matching this codebase's universal
 * no-FK convention for capsule-domain references (a reminder whose
 * capsule has since been deleted is unreachable through normal queries,
 * since `features/delete-capsule` actively removes a capsule's own
 * reminders on delete — same "same-entity structural data gets active
 * cleanup" reasoning as `CapsuleVersion`/`CapsuleEmbedding`).
 *
 * Deliberately data-only this step: this entity records WHEN a reminder
 * should fire and WHAT it says, but does not itself schedule or deliver
 * an OS-level notification — that needs `expo-notifications`, an
 * uninstalled dependency, queued as a human decision in
 * `.claude/loop/BLOCKED.md` rather than added unattended. `getDueReminders`
 * is the query a future notification-scheduling layer will actually use.
 */
export type Reminder = {
  id: string;
  capsuleId: string;
  remindAt: number;
  /** Falls back to the capsule's own title when null — decided by whoever renders/schedules the notification, not this entity. */
  message: string | null;
  createdAt: number;
  updatedAt: number;
};

export type ReminderRow = {
  id: string;
  capsule_id: string;
  remind_at: number;
  message: string | null;
  created_at: number;
  updated_at: number;
};

export function rowToReminder(row: ReminderRow): Reminder {
  return {
    id: row.id,
    capsuleId: row.capsule_id,
    remindAt: row.remind_at,
    message: row.message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
