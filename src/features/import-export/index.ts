import type { SQLiteDatabase } from "expo-sqlite";
import {
  getAllConversations,
  getConversationById,
  insertConversation,
  type Conversation,
} from "@/entities/conversation";
import {
  getMessagesByConversation,
  getSourcesByConversation,
  insertMessage,
  insertMessageSources,
  type Message,
  type MessageSource,
} from "@/entities/message";
import { serializePortable, parsePortable } from "@/shared/format";
import { generateId } from "@/shared/lib";
import { inTransaction } from "@/shared/db";
import { insertAuditEntry } from "@/entities/audit";
import {
  getPersonaById,
  insertPersona,
  type Persona,
} from "@/entities/persona";

/**
 * "features/import-export (single conversation, single capsule, whole
 * vault)" (docs/DEVELOPMENT_PLAN.md 5.2). Scope, stated exactly: this
 * file round-trips conversations + their messages + their persona;
 * `./capsules.ts`
 * round-trips capsules and everything they own (exceptions listed
 * there). A conversation carries its persona (10.49), so its `personaId`
 * doesn't dangle on another device; snippets, model records, and audit
 * entries are NOT part of any 5.2 portable scope. This file holds
 * the conversation scope; the capsule scope (single capsule + every
 * capsule) lives in `./capsules.ts` and is re-exported below. The two
 * "whole" exports are separate files of separate kinds ("vault" for
 * conversations, "capsule-collection" for capsules) rather than one
 * combined file, so the already-shipped "vault" format didn't change.
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
 * anything. One exception (10.49): a conversation's persona keeps its
 * id, so importing a file twice adds it once — a local persona with that
 * id always wins and is never overwritten, so it can't collide. An
 * id-*preserving* restore (make the app look exactly like it
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
  /**
   * Which capsules grounded each reply (7.4). Optional so exports made
   * before 7.4 still import. Capsule ids aren't remapped — on another
   * device they usually won't exist, and the stored title still says what
   * was used.
   */
  sources?: MessageSource[];
  /**
   * The conversation's persona (10.49). Optional: absent for a conversation
   * without one, and in files exported before 10.49.
   */
  persona?: Persona;
};

type PortableVault = {
  conversations: PortableConversation[];
};

/** Whether a value from a file has a persona's shape (10.49). */
function isPersona(value: unknown): value is Persona {
  if (value === null || typeof value !== "object") return false;
  const p = value as Record<string, unknown>;
  return (
    typeof p.id === "string" &&
    typeof p.name === "string" &&
    typeof p.systemPrompt === "string" &&
    typeof p.createdAt === "number" &&
    typeof p.updatedAt === "number"
  );
}

/**
 * The personaId the imported conversation should point at (10.49). This
 * device's own persona wins and is never overwritten; otherwise the file's
 * persona is added under its own id (so importing twice adds it once). An
 * id this device doesn't know and the file can't supply is cleared, so it
 * doesn't dangle. A file persona that is malformed or whose id doesn't
 * match is ignored. (Unlike a capsule relation, which is kept dangling so
 * its target can be imported later, a persona can't be imported on its
 * own, so a dangling personaId could never be re-attached.)
 */
function restorePersona(
  db: SQLiteDatabase,
  personaId: string | null,
  persona: unknown,
): string | null {
  if (personaId === null) return null;
  if (getPersonaById(db, personaId) !== null) return personaId;
  if (!isPersona(persona) || persona.id !== personaId) return null;
  insertPersona(db, persona);
  return personaId;
}

/** The persona a conversation points at, for its export (10.49). */
function personaFor(
  db: SQLiteDatabase,
  conversation: Conversation,
): Persona | undefined {
  if (conversation.personaId === null) return undefined;
  return getPersonaById(db, conversation.personaId) ?? undefined;
}

/**
 * Restores a conversation + its full message tree (every branch, not just
 * the active leaf) under freshly generated ids. Shared by both
 * `importConversation` and `importAllConversations` so the id-remapping
 * logic exists in exactly one place.
 */
function restoreConversation(
  db: SQLiteDatabase,
  { conversation, messages, sources = [], persona }: PortableConversation,
): Conversation {
  const idMap = new Map<string, string>();
  for (const message of messages) {
    idMap.set(message.id, generateId());
  }

  const newConversationId = generateId();
  const restored: Conversation = {
    ...conversation,
    id: newConversationId,
    personaId: restorePersona(db, conversation.personaId, persona),
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

  // Group by the reply they belong to, keep rank order, re-point at new ids.
  const byMessage = new Map<string, MessageSource[]>();
  for (const source of sources) {
    const newMessageId = idMap.get(source.messageId);
    if (newMessageId === undefined) continue; // reply not in this export
    const list = byMessage.get(newMessageId) ?? [];
    list.push(source);
    byMessage.set(newMessageId, list);
  }
  for (const [newMessageId, list] of byMessage) {
    insertMessageSources(
      db,
      newMessageId,
      newConversationId,
      list.sort((a, b) => a.rank - b.rank),
    );
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
  const persona = personaFor(db, conversation);
  const json = serializePortable<PortableConversation>(CONVERSATION_KIND, {
    conversation,
    messages,
    sources: getSourcesByConversation(db, conversationId),
    persona,
  });
  insertAuditEntry(db, {
    id: generateId(),
    action: "export",
    detail:
      persona === undefined
        ? `Conversation "${conversation.title}"`
        : `Conversation "${conversation.title}" (with its persona "${persona.name}")`,
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
  return inTransaction(db, () => restoreConversation(db, data));
}

/** Exports every conversation — the "whole vault" scope. */
export function exportAllConversations(db: SQLiteDatabase): string {
  const allConversations = getAllConversations(db);
  const conversations = allConversations.map((conversation) => ({
    conversation,
    messages: getMessagesByConversation(db, conversation.id),
    sources: getSourcesByConversation(db, conversation.id),
    persona: personaFor(db, conversation),
  }));
  const json = serializePortable<PortableVault>(VAULT_KIND, { conversations });
  const personaCount = new Set(
    conversations.flatMap((c) => (c.persona ? [c.persona.id] : [])),
  ).size;
  const personaNote =
    personaCount === 0
      ? ""
      : `, ${personaCount} persona${personaCount === 1 ? "" : "s"}`;
  insertAuditEntry(db, {
    id: generateId(),
    action: "export",
    detail: `Whole vault (${allConversations.length} conversation${allConversations.length === 1 ? "" : "s"}${personaNote})`,
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
  // All or nothing: a bad entry mustn't leave half a vault behind.
  return inTransaction(db, () =>
    conversations.map((entry) => restoreConversation(db, entry)),
  );
}

export {
  exportCapsule,
  importCapsule,
  exportAllCapsules,
  importAllCapsules,
  exportCapsulesBundle,
  importCapsulesBundle,
} from "./capsules";
