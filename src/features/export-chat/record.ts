import type { SQLiteDatabase } from "expo-sqlite";
import { insertAuditEntry } from "@/entities/audit";
import { generateId } from "@/shared/lib";

export interface ChatExportRecord {
  title: string;
  messageCount: number;
}

/**
 * Writes the activity-log entry for a conversation copied out of the app.
 * Copying to the clipboard hands the whole chat to every other app on the
 * device, so it is an export like any other and is logged as one. Call it
 * only after the copy actually succeeded.
 */
export function recordChatExport(
  db: SQLiteDatabase,
  { title, messageCount }: ChatExportRecord,
): void {
  const name = title.trim() || "Untitled conversation";
  const count = `${messageCount} ${messageCount === 1 ? "message" : "messages"}`;
  insertAuditEntry(db, {
    id: generateId(),
    action: "export",
    detail: `Copied conversation "${name}" (${count}) as Markdown`,
    createdAt: Date.now(),
  });
}
