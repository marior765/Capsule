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
 * This entity only records WHEN a reminder fires and WHAT it says (plus
 * the id of its scheduled OS notification, if any). Scheduling, moving and
 * cancelling the notification itself is `features/manage-reminders`' job,
 * through `shared/notifications` (local notifications only).
 */
export type Reminder = {
  id: string;
  capsuleId: string;
  remindAt: number;
  /** Falls back to the capsule's own title when null — decided by whoever renders/schedules the notification, not this entity. */
  message: string | null;
  /**
   * Id of the scheduled OS notification (8.8), or null if none is scheduled
   * (notifications not allowed, or a record-only reminder). Needed to
   * cancel or move the notification later.
   */
  notificationId: string | null;
  createdAt: number;
  updatedAt: number;
};

export type ReminderRow = {
  id: string;
  capsule_id: string;
  remind_at: number;
  message: string | null;
  notification_id: string | null;
  created_at: number;
  updated_at: number;
};

export function rowToReminder(row: ReminderRow): Reminder {
  return {
    id: row.id,
    capsuleId: row.capsule_id,
    remindAt: row.remind_at,
    message: row.message,
    notificationId: row.notification_id ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
