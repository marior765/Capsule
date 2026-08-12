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
       ON messages (conversation_id, created_at);`,
    );
  },
};

/**
 * Additive migration — the v3 `messages` table already shipped, so parent_id
 * must be added rather than folded into the original CREATE TABLE.
 */
export const messagesParentMigration: Migration = {
  version: 6,
  up: (db: SQLiteDatabase) => {
    db.execSync("ALTER TABLE messages ADD COLUMN parent_id TEXT;");
    db.execSync(
      `CREATE INDEX IF NOT EXISTS idx_messages_parent
       ON messages (parent_id);`,
    );
  },
};

/**
 * Walks the tree from `leafId` up to its root, returning the path in
 * chronological (root-first) order. Unknown leaf → empty path.
 */
export function getMessagePath(db: SQLiteDatabase, leafId: string): Message[] {
  const path: Message[] = [];
  const seen = new Set<string>();
  let currentId: string | null = leafId;

  while (currentId && !seen.has(currentId)) {
    seen.add(currentId);
    const row = db.getFirstSync(
      "SELECT * FROM messages WHERE id = ?;",
      currentId,
    ) as MessageRow | null;
    if (!row) break;

    const message = rowToMessage(row);
    path.push(message);
    currentId = message.parentId;
  }

  return path.reverse();
}

/** Direct children of `parentId`. Pass null for the conversation's roots. */
export function getChildren(
  db: SQLiteDatabase,
  parentId: string | null,
): Message[] {
  // SQLite compares NULL with IS NULL, never with `= ?`.
  const rows = (
    parentId === null
      ? db.getAllSync(
          `SELECT * FROM messages
           WHERE parent_id IS NULL
           ORDER BY created_at ASC, rowid ASC;`,
        )
      : db.getAllSync(
          `SELECT * FROM messages
           WHERE parent_id = ?
           ORDER BY created_at ASC, rowid ASC;`,
          parentId,
        )
  ) as MessageRow[];
  return rows.map(rowToMessage);
}

export function getMessagesByConversation(
  db: SQLiteDatabase,
  conversationId: string,
): Message[] {
  const rows = db.getAllSync(
    `SELECT * FROM messages
     WHERE conversation_id = ?
     ORDER BY created_at ASC, rowid ASC;`,
    conversationId,
  ) as MessageRow[];
  return rows.map(rowToMessage);
}

export function insertMessage(db: SQLiteDatabase, message: Message): void {
  db.runSync(
    `INSERT INTO messages (id, conversation_id, parent_id, role, content, token_count, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?);`,
    message.id,
    message.conversationId,
    message.parentId,
    message.role,
    message.content,
    message.tokenCount,
    message.createdAt,
  );
}

export function deleteMessagesByConversation(
  db: SQLiteDatabase,
  conversationId: string,
): void {
  db.runSync("DELETE FROM messages WHERE conversation_id = ?;", conversationId);
}
