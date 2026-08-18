import type { SQLiteDatabase } from "expo-sqlite";
import {
  getAllConversations,
  deleteConversation as deleteConversationRecord,
  insertConversation,
  type Conversation,
} from "@/entities/conversation";
import {
  getMessagesByConversation,
  deleteMessagesByConversation,
  insertMessage,
  type Message,
} from "@/entities/message";
import { serializePortable, parsePortable } from "@/shared/format";
import { insertAuditEntry } from "@/entities/audit";
import { generateId } from "@/shared/lib";

/**
 * "features/backup-restore" (docs/DEVELOPMENT_PLAN.md 5.3) — the
 * id-*preserving* counterpart `features/import-export` (5.2) deliberately
 * deferred here: "make the app look exactly like it did at backup time,"
 * as opposed to import's "add this as new data." Same conversations +
 * messages scope as 5.2 today (capsules N/A — `entities/capsule` doesn't
 * exist yet, Phase 6 unbuilt; models/settings/the encryption vault key are
 * out of scope — see the module-level doc comments below for why each).
 *
 * `restoreBackup` always *replaces* everything conversations-and-messages
 * shaped: every existing conversation and message is deleted first, then
 * the backup's own conversations/messages are inserted under their
 * original ids. This is "restore to exactly this snapshot," not a merge —
 * restoring twice in a row is idempotent (the second restore just deletes
 * and re-inserts the same rows), never accumulates duplicates the way
 * repeated `importConversation` calls deliberately do.
 *
 * No transaction wraps the delete-then-restore sequence — matches this
 * codebase's existing style everywhere else (no `shared/db` helper for
 * transactions exists yet); a failure partway through (a malformed
 * conversation inside an otherwise-valid envelope, an unexpected SQL
 * error) could leave data partially deleted and partially restored. This
 * is a known, pre-existing limitation of the whole codebase, not something
 * newly introduced here — flagged rather than silently accepted.
 *
 * Validates the backup *before* deleting anything: `parsePortable` throws
 * on malformed JSON or a wrong `kind` before this module ever touches the
 * database, so a bad restore attempt can never leave the app in a
 * half-wiped state.
 *
 * Audit logging: `createBackup` writes "export" (same reasoning as 5.2 —
 * assembling a portable snapshot is the export-shaped direction).
 * `restoreBackup` writes "wipe" — it destroys existing conversations and
 * messages before replacing them, the same class of action
 * `features/wipe-data`/`features/encrypt-vault`'s `resetVault` already log
 * that way. Both entries are written only after the corresponding action
 * actually succeeds, never on a failure — mirrors 5.2's own discipline.
 *
 * Scope notes on what's deliberately excluded, not overlooked:
 * - **Models**: large binary GGUF files, already re-downloadable from
 *   their original source — including them in a JSON backup blob would
 *   bloat it enormously for no real benefit over re-downloading.
 * - **Settings** (MMKV): a real, honest gap for now, not a security
 *   concern like the vault key — just out of this beat's scope. A future
 *   pass could add it.
 * - **The encryption vault key** (`features/encrypt-vault`, secure-store):
 *   deliberately never touched. Backing up the master key alongside a
 *   portable JSON file would be a genuine security regression — anyone
 *   who obtained the backup file could decrypt the vault. This module
 *   never imports `features/encrypt-vault` (FSD also forbids that
 *   cross-feature import) and never references `expo-secure-store`.
 */

const BACKUP_KIND = "backup";

type BackupConversation = {
  conversation: Conversation;
  messages: Message[];
};

type Backup = {
  conversations: BackupConversation[];
};

/** Serializes every conversation + its full message tree, ids unchanged. */
export function createBackup(db: SQLiteDatabase): string {
  const conversations = getAllConversations(db).map((conversation) => ({
    conversation,
    messages: getMessagesByConversation(db, conversation.id),
  }));
  const json = serializePortable<Backup>(BACKUP_KIND, { conversations });
  insertAuditEntry(db, {
    id: generateId(),
    action: "export",
    detail: `Backup (${conversations.length} conversation${conversations.length === 1 ? "" : "s"})`,
    createdAt: Date.now(),
  });
  return json;
}

/**
 * Replaces every conversation and message with the backup's own snapshot,
 * under their original ids. Validates the backup before deleting anything.
 */
export function restoreBackup(db: SQLiteDatabase, json: string): void {
  const { conversations } = parsePortable<Backup>(json, BACKUP_KIND);

  for (const existing of getAllConversations(db)) {
    deleteMessagesByConversation(db, existing.id);
    deleteConversationRecord(db, existing.id);
  }

  for (const { conversation, messages } of conversations) {
    insertConversation(db, conversation);
    for (const message of messages) {
      insertMessage(db, message);
    }
  }

  insertAuditEntry(db, {
    id: generateId(),
    action: "wipe",
    detail: "Backup restore — replaced existing conversations",
    createdAt: Date.now(),
  });
}
