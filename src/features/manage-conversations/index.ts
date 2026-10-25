import type { SQLiteDatabase } from "expo-sqlite";
import {
  deleteConversation as deleteConversationRecord,
  getAllConversations,
  insertConversation,
  getConversationById,
  updateConversation,
  type Conversation,
  DEFAULT_CONVERSATION_TITLE,
} from "@/entities/conversation";
import {
  deleteImagesByConversation,
  deleteMessagesByConversation,
  deleteSourcesByConversation,
} from "@/entities/message";
import { getPersonaById, type Persona } from "@/entities/persona";
import { deleteAppDirectoryIfExists, isSafeSegment } from "@/shared/fs";
import { generateId } from "@/shared/lib";

export type CreateConversationInput = {
  title?: string;
  modelId?: string | null;
  personaId?: string | null;
};

export function createConversation(
  db: SQLiteDatabase,
  input: CreateConversationInput = {},
): Conversation {
  const now = Date.now();
  const conversation: Conversation = {
    id: generateId(),
    title: input.title ?? DEFAULT_CONVERSATION_TITLE,
    modelId: input.modelId ?? null,
    personaId: input.personaId ?? null,
    activeLeafId: null,
    createdAt: now,
    updatedAt: now,
  };
  insertConversation(db, conversation);
  return conversation;
}

export function renameConversation(
  db: SQLiteDatabase,
  id: string,
  title: string,
): void {
  updateConversation(db, id, { title, updatedAt: Date.now() });
}

/**
 * Switches the persona an existing conversation uses — `null` for none.
 * Takes effect from the next message: earlier replies keep the voice they
 * were written in.
 */
export function setConversationPersona(
  db: SQLiteDatabase,
  id: string,
  personaId: string | null,
): void {
  updateConversation(db, id, { personaId, updatedAt: Date.now() });
}

/**
 * The persona a conversation currently uses, or `null` for none — also when
 * the persona has since been deleted, the same way sending treats it.
 */
export function getConversationPersona(
  db: SQLiteDatabase,
  id: string,
): Persona | null {
  const personaId = getConversationById(db, id)?.personaId;
  return personaId ? getPersonaById(db, personaId) : null;
}

/**
 * Deletes a conversation and all of its messages. Cross-entity cascade lives
 * here in the feature layer — the entities themselves stay independent.
 */
export function deleteConversation(db: SQLiteDatabase, id: string): void {
  // Image files first: if that throws, the conversation is still intact
  // and the delete can be retried — never rows gone with bytes left behind.
  // An id that isn't a valid folder name (only possible via a hand-edited
  // backup) can't have an image folder — skip rather than block the delete.
  if (isSafeSegment(id)) deleteAppDirectoryIfExists("chat-images", id);
  deleteImagesByConversation(db, id);
  deleteSourcesByConversation(db, id);
  deleteMessagesByConversation(db, id);
  deleteConversationRecord(db, id);
}

export function listConversations(db: SQLiteDatabase): Conversation[] {
  return getAllConversations(db);
}

export function searchConversations(
  db: SQLiteDatabase,
  query: string,
): Conversation[] {
  const needle = query.toLowerCase();
  return getAllConversations(db).filter((c) =>
    c.title.toLowerCase().includes(needle),
  );
}
