import type { SQLiteDatabase } from "expo-sqlite";
import {
  deleteConversation as deleteConversationRecord,
  getAllConversations,
  insertConversation,
  updateConversation,
  type Conversation,
} from "@/entities/conversation";
import { deleteMessagesByConversation } from "@/entities/message";
import { generateId } from "@/shared/lib";

export type CreateConversationInput = {
  title?: string;
  modelId?: string | null;
};

export function createConversation(
  db: SQLiteDatabase,
  input: CreateConversationInput = {}
): Conversation {
  const now = Date.now();
  const conversation: Conversation = {
    id: generateId(),
    title: input.title ?? "New chat",
    modelId: input.modelId ?? null,
    createdAt: now,
    updatedAt: now,
  };
  insertConversation(db, conversation);
  return conversation;
}

export function renameConversation(
  db: SQLiteDatabase,
  id: string,
  title: string
): void {
  updateConversation(db, id, { title, updatedAt: Date.now() });
}

/**
 * Deletes a conversation and all of its messages. Cross-entity cascade lives
 * here in the feature layer — the entities themselves stay independent.
 */
export function deleteConversation(db: SQLiteDatabase, id: string): void {
  deleteMessagesByConversation(db, id);
  deleteConversationRecord(db, id);
}

export function listConversations(db: SQLiteDatabase): Conversation[] {
  return getAllConversations(db);
}

export function searchConversations(
  db: SQLiteDatabase,
  query: string
): Conversation[] {
  const needle = query.toLowerCase();
  return getAllConversations(db).filter((c) =>
    c.title.toLowerCase().includes(needle)
  );
}
