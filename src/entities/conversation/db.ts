import type { Migration } from "@/shared/db";
import type { SQLiteDatabase, SQLiteVariadicBindParams } from "expo-sqlite";
import {
  rowToConversation,
  type Conversation,
  type ConversationRow,
} from "./model";

export const conversationsMigration: Migration = {
  version: 2,
  up: (db: SQLiteDatabase) => {
    db.execSync(`
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        model_id TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);
  },
};

export function getAllConversations(db: SQLiteDatabase): Conversation[] {
  const rows = db.getAllSync(
    "SELECT * FROM conversations ORDER BY updated_at DESC;",
  ) as ConversationRow[];
  return rows.map(rowToConversation);
}

export function getConversationById(
  db: SQLiteDatabase,
  id: string,
): Conversation | null {
  const row = db.getFirstSync(
    "SELECT * FROM conversations WHERE id = ?;",
    id,
  ) as ConversationRow | null;
  return row ? rowToConversation(row) : null;
}

export function insertConversation(
  db: SQLiteDatabase,
  conversation: Conversation,
): void {
  db.runSync(
    `INSERT INTO conversations (id, title, model_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?);`,
    conversation.id,
    conversation.title,
    conversation.modelId,
    conversation.createdAt,
    conversation.updatedAt,
  );
}

export function updateConversation(
  db: SQLiteDatabase,
  id: string,
  patch: Partial<Omit<Conversation, "id">>,
): void {
  const fields: string[] = [];
  const values: unknown[] = [];

  if (patch.title !== undefined) {
    fields.push("title = ?");
    values.push(patch.title);
  }
  if (patch.modelId !== undefined) {
    fields.push("model_id = ?");
    values.push(patch.modelId);
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
    `UPDATE conversations SET ${fields.join(", ")} WHERE id = ?;`,
    ...(values as SQLiteVariadicBindParams),
  );
}

export function deleteConversation(db: SQLiteDatabase, id: string): void {
  db.runSync("DELETE FROM conversations WHERE id = ?;", id);
}
