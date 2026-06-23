import type { SQLiteDatabase } from "expo-sqlite";
import type { Migration } from "@/shared/db";
import { rowToMessage, type Message, type MessageRow } from "./model";

export const messagesMigration: Migration = {
  version: 3,
  up: (db: SQLiteDatabase) => {
    db.execSync(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        token_count INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL
      );
    `);
    db.execSync(
      `CREATE INDEX IF NOT EXISTS idx_messages_conversation
       ON messages (conversation_id, created_at);`
    );
  },
};

export function getMessagesByConversation(
  db: SQLiteDatabase,
  conversationId: string
): Message[] {
  const rows = db.getAllSync(
    `SELECT * FROM messages
     WHERE conversation_id = ?
     ORDER BY created_at ASC, rowid ASC;`,
    conversationId
  ) as MessageRow[];
  return rows.map(rowToMessage);
}

export function insertMessage(db: SQLiteDatabase, message: Message): void {
  db.runSync(
    `INSERT INTO messages (id, conversation_id, role, content, token_count, created_at)
     VALUES (?, ?, ?, ?, ?, ?);`,
    message.id,
    message.conversationId,
    message.role,
    message.content,
    message.tokenCount,
    message.createdAt
  );
}

export function deleteMessagesByConversation(
  db: SQLiteDatabase,
  conversationId: string
): void {
  db.runSync(
    "DELETE FROM messages WHERE conversation_id = ?;",
    conversationId
  );
}
