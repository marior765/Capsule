import type { SQLiteDatabase } from "expo-sqlite";
import {
  getAllConversations,
  getConversationById,
  insertConversation,
  type Conversation,
} from "@/entities/conversation";
import {
  getMessagesByConversation,
  insertMessage,
  type Message,
} from "@/entities/message";
import { serializePortable, parsePortable } from "@/shared/format";
import { generateId } from "@/shared/lib";
import { insertAuditEntry } from "@/entities/audit";

/**
 * "features/import-export (single conversation, single capsule, whole
 * vault)" (docs/DEVELOPMENT_PLAN.md 5.2) — the CLAUDE.md-required
 * "everything round-trips through the portable format" made real for the
 * first entity. Capsules aren't included yet: `entities/capsule` doesn't
 * exist (Phase 6 unbuilt) — "whole vault" here means every conversation,
 * not literally everything the app could ever hold; capsules join once
 * that entity ships.
 *
 * Naming note: "vault" in this step's own plan text is a *portability*
 * term ("your whole collection of data"), unrelated to
 * `features/encrypt-vault`'s cryptographic vault (the passphrase-wrapped
 * master key). The two features don't interact — this module never
 * touches encryption, keys, or `expo-secure-store`.
 *
 * Import always assigns fresh ids rather than reusing the exported ones,
 * remapping every internal reference (message.id, message.conversationId,
 * message.parentId, conversation.activeLeafId) consistently. This treats
 * an import as *new* data — safe to run twice, never collides with an
 * existing conversation of the same id, and never silently overwrites
 * anything. An id-*preserving* restore (make the app look exactly like it
 * did at backup time, replacing what's there) is a different semantic —
 * that's `features/backup-restore` (5.3), deliberately not this step's job.
 *
 * Audit logging: CLAUDE.md's hard rule names "export, decrypt, wipe, model
 * download" as privacy-sensitive. Export is the direction that can move
 * data outside the device, so `exportConversation`/`exportAllConversations`
 * both log an "export" entry, written only after the export has actually
 * succeeded (never on a failure — nothing left the device). Import only
 * ever brings data *in* and isn't named by the rule's own wording, so it
 * deliberately writes nothing.
 */

const CONVERSATION_KIND = "conversation";
const VAULT_KIND = "vault";

type PortableConversation = {
  conversation: Conversation;
  messages: Message[];
};

type PortableVault = {
  conversations: PortableConversation[];
};

/**
 * Restores a conversation + its full message tree (every branch, not just
 * the active leaf) under freshly generated ids. Shared by both
 * `importConversation` and `importAllConversations` so the id-remapping
 * logic exists in exactly one place.
 */
function restoreConversation(
  db: SQLiteDatabase,
  { conversation, messages }: PortableConversation,
): Conversation {
  const idMap = new Map<string, string>();
  for (const message of messages) {
    idMap.set(message.id, generateId());
  }

  const newConversationId = generateId();
  const restored: Conversation = {
    ...conversation,
    id: newConversationId,
    activeLeafId:
      conversation.activeLeafId !== null
        ? (idMap.get(conversation.activeLeafId) ?? null)
        : null,
  };
  insertConversation(db, restored);

  for (const message of messages) {
    insertMessage(db, {
      ...message,
      id: idMap.get(message.id)!,
      conversationId: newConversationId,
      parentId:
        message.parentId !== null
          ? (idMap.get(message.parentId) ?? null)
          : null,
    });
  }

  return restored;
}

/** Exports a single conversation and its full message tree. */
export function exportConversation(
  db: SQLiteDatabase,
  conversationId: string,
): string {
  const conversation = getConversationById(db, conversationId);
  if (conversation === null) {
    throw new Error(`No conversation with id "${conversationId}"`);
  }
  const messages = getMessagesByConversation(db, conversationId);
  const json = serializePortable<PortableConversation>(CONVERSATION_KIND, {
    conversation,
    messages,
  });
  insertAuditEntry(db, {
    id: generateId(),
    action: "export",
    detail: `Conversation "${conversation.title}"`,
    createdAt: Date.now(),
  });
  return json;
}

/** Imports a single conversation export, always as a new conversation. */
export function importConversation(
  db: SQLiteDatabase,
  json: string,
): Conversation {
  const data = parsePortable<PortableConversation>(json, CONVERSATION_KIND);
  return restoreConversation(db, data);
}

/** Exports every conversation — the "whole vault" scope. */
export function exportAllConversations(db: SQLiteDatabase): string {
  const allConversations = getAllConversations(db);
  const conversations = allConversations.map((conversation) => ({
    conversation,
    messages: getMessagesByConversation(db, conversation.id),
  }));
  const json = serializePortable<PortableVault>(VAULT_KIND, { conversations });
  insertAuditEntry(db, {
    id: generateId(),
    action: "export",
    detail: `Whole vault (${allConversations.length} conversation${allConversations.length === 1 ? "" : "s"})`,
    createdAt: Date.now(),
  });
  return json;
}

/** Imports a whole-vault export, restoring every conversation as new. */
export function importAllConversations(
  db: SQLiteDatabase,
  json: string,
): Conversation[] {
  const { conversations } = parsePortable<PortableVault>(json, VAULT_KIND);
  return conversations.map((entry) => restoreConversation(db, entry));
}
