import type { SQLiteDatabase } from "expo-sqlite";
import type { Migration } from "@/shared/db";
import {
  rowToMessage,
  rowToMessageImage,
  rowToMessageSource,
  type Message,
  type MessageRow,
  type MessageImage,
  type MessageImageRow,
  type MessageSource,
  type MessageSourceRow,
} from "./model";

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

// --- Grounding sources (7.4) ---

/**
 * `message_sources`: which capsules grounded each assistant reply. No FK
 * (codebase convention); `conversation_id` is stored so a conversation's
 * sources can be deleted or exported together without a join.
 */
export const messageSourcesMigration: Migration = {
  version: 23,
  up: (db: SQLiteDatabase) => {
    db.execSync(`
      CREATE TABLE IF NOT EXISTS message_sources (
        message_id TEXT NOT NULL,
        conversation_id TEXT NOT NULL,
        capsule_id TEXT NOT NULL,
        title TEXT NOT NULL,
        rank INTEGER NOT NULL,
        PRIMARY KEY (message_id, rank)
      );
    `);
    db.execSync(
      `CREATE INDEX IF NOT EXISTS idx_message_sources_conversation
       ON message_sources (conversation_id);`,
    );
  },
};

/** Stores a reply's sources in the given order (rank 0 = best match). */
export function insertMessageSources(
  db: SQLiteDatabase,
  messageId: string,
  conversationId: string,
  sources: { capsuleId: string; title: string }[],
): void {
  sources.forEach((source, rank) => {
    db.runSync(
      `INSERT INTO message_sources (message_id, conversation_id, capsule_id, title, rank)
       VALUES (?, ?, ?, ?, ?);`,
      messageId,
      conversationId,
      source.capsuleId,
      source.title,
      rank,
    );
  });
}

export function getSourcesByMessage(
  db: SQLiteDatabase,
  messageId: string,
): MessageSource[] {
  const rows = db.getAllSync(
    "SELECT * FROM message_sources WHERE message_id = ? ORDER BY rank ASC;",
    messageId,
  ) as MessageSourceRow[];
  return rows.map(rowToMessageSource);
}

export function getSourcesByConversation(
  db: SQLiteDatabase,
  conversationId: string,
): MessageSource[] {
  const rows = db.getAllSync(
    `SELECT * FROM message_sources WHERE conversation_id = ?
     ORDER BY message_id ASC, rank ASC;`,
    conversationId,
  ) as MessageSourceRow[];
  return rows.map(rowToMessageSource);
}

export function deleteSourcesByConversation(
  db: SQLiteDatabase,
  conversationId: string,
): void {
  db.runSync(
    "DELETE FROM message_sources WHERE conversation_id = ?;",
    conversationId,
  );
}

// --- Message images (8.4) ---

/** `message_images`: at most one image per message. No FK (codebase convention). */
export const messageImagesMigration: Migration = {
  version: 25,
  up: (db: SQLiteDatabase) => {
    db.execSync(`
      CREATE TABLE IF NOT EXISTS message_images (
        message_id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        path TEXT NOT NULL
      );
    `);
    db.execSync(
      `CREATE INDEX IF NOT EXISTS idx_message_images_conversation
       ON message_images (conversation_id);`,
    );
  },
};

export function insertMessageImage(
  db: SQLiteDatabase,
  image: MessageImage,
): void {
  db.runSync(
    "INSERT INTO message_images (message_id, conversation_id, path) VALUES (?, ?, ?);",
    image.messageId,
    image.conversationId,
    image.path,
  );
}

export function getImageByMessage(
  db: SQLiteDatabase,
  messageId: string,
): MessageImage | null {
  const row = db.getFirstSync(
    "SELECT * FROM message_images WHERE message_id = ?;",
    messageId,
  ) as MessageImageRow | null;
  return row ? rowToMessageImage(row) : null;
}

export function deleteImageByMessage(
  db: SQLiteDatabase,
  messageId: string,
): void {
  db.runSync("DELETE FROM message_images WHERE message_id = ?;", messageId);
}

export function deleteImagesByConversation(
  db: SQLiteDatabase,
  conversationId: string,
): void {
  db.runSync(
    "DELETE FROM message_images WHERE conversation_id = ?;",
    conversationId,
  );
}
