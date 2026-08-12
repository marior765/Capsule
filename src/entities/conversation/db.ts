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

/**
 * Additive migration — the v2 `conversations` table already shipped, so the
 * column must be added rather than folded into the original CREATE TABLE.
 */
export const conversationsPersonaMigration: Migration = {
  version: 5,
  up: (db: SQLiteDatabase) => {
    db.execSync("ALTER TABLE conversations ADD COLUMN persona_id TEXT;");
  },
};

/** Additive migration — see `conversationsPersonaMigration`. */
export const conversationsLeafMigration: Migration = {
  version: 7,
  up: (db: SQLiteDatabase) => {
    db.execSync("ALTER TABLE conversations ADD COLUMN active_leaf_id TEXT;");
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
    `INSERT INTO conversations (id, title, model_id, persona_id, active_leaf_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?);`,
    conversation.id,
    conversation.title,
    conversation.modelId,
    conversation.personaId,
    conversation.activeLeafId,
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
  if (patch.personaId !== undefined) {
    fields.push("persona_id = ?");
    values.push(patch.personaId);
  }
  if (patch.activeLeafId !== undefined) {
    fields.push("active_leaf_id = ?");
    values.push(patch.activeLeafId);
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
