import type { SQLiteDatabase } from "expo-sqlite";
import {
  deleteConversation,
  getAllConversations,
  insertConversation,
  type Conversation,
} from "@/entities/conversation";
import {
  deleteImagesByConversation,
  deleteMessagesByConversation,
  deleteSourcesByConversation,
  getImageByMessage,
  getMessagesByConversation,
  getSourcesByConversation,
  insertMessage,
  insertMessageImage,
  insertMessageSources,
  type Message,
  type MessageSource,
} from "@/entities/message";
import {
  deleteCapsuleType,
  getAllCapsuleTypes,
  insertCapsuleType,
  type CapsuleType,
} from "@/entities/capsule-type";
import {
  deleteFieldsByCapsuleType,
  getFieldsByCapsuleType,
  insertCapsuleField,
  type CapsuleField,
} from "@/entities/field";
import {
  deleteCapsule,
  deleteEmbedding,
  deleteValuesByCapsule,
  deleteVersionsByCapsule,
  getAllCapsules,
  getValuesByCapsule,
  getVersionsByCapsule,
  insertCapsule,
  insertCapsuleVersion,
  upsertCapsuleValue,
  type Capsule,
  type CapsuleValue,
  type CapsuleVersion,
} from "@/entities/capsule";
import {
  addTagToCapsule,
  deleteCapsuleTagsByCapsule,
  deleteTag,
  getAllTags,
  getTagsByCapsule,
  insertTag,
  type Tag,
} from "@/entities/tag";
import {
  deleteLinksByCapsule,
  getLinksFrom,
  insertLink,
  type CapsuleLink,
} from "@/entities/link";
import {
  deleteRemindersByCapsule,
  getRemindersByCapsule,
  insertReminder,
  type Reminder,
} from "@/entities/reminder";
import {
  ATTACHMENTS_DIRECTORY,
  deleteAttachmentsByCapsule,
  getAttachmentsByCapsule,
  insertAttachment,
  type Attachment,
} from "@/entities/attachment";
import { insertAuditEntry } from "@/entities/audit";
import {
  deletePersona,
  getAllPersonas,
  insertPersona,
  type Persona,
} from "@/entities/persona";
import {
  deleteSnippet,
  getAllSnippets,
  insertSnippet,
  type Snippet,
} from "@/entities/snippet";
import { inTransaction } from "@/shared/db";
import { cancelLocalNotification } from "@/shared/notifications";
import {
  deleteAppDirectoryIfExists,
  deleteAppFileIfExists,
  isSafeSegment,
  readAppFileBytes,
  toSafeFileName,
  writeAppFileBytes,
} from "@/shared/fs";
import {
  PortableFormatError,
  parsePortable,
  serializePortable,
} from "@/shared/format";
import { generateId } from "@/shared/lib";
import {
  MAX_BUNDLE_BYTES,
  textFromBytes,
  textToBytes,
  unzipFiles,
  zipFiles,
} from "@/shared/zip";

/**
 * The full backup as a zip bundle (5.5): everything a person would lose
 * with their phone — conversations (with branches, grounding sources and
 * chat images), capsules (types, fields, values, tags, links, history,
 * reminders and attachments), and personas and snippets (5.6) — with ids
 * unchanged, so restoring puts things
 * back exactly as they were. Embeddings are left out (rebuilt from the
 * capsules on the next start); OS notification ids too (they belong to the
 * device that made them), so restored reminders are records until
 * rescheduled.
 *
 * Restore replaces everything, carefully:
 * 1. Everything is read and checked first; ids become folder names, so a
 *    bundle with an unsafe id is refused before anything changes.
 * 2. The backup's files are written to NEW, unique file names (rows store
 *    their own path), so nothing currently on disk is overwritten.
 * 3. All rows are replaced in one transaction. If that fails, the new
 *    files are deleted and the current data is exactly as it was.
 * 4. Only then are the old files (and folders of anything no longer
 *    there) deleted and the replaced reminders' notifications cancelled —
 *    best effort: a failure leaves an orphan file, never a missing one.
 */

const KIND = "full-backup";
const JSON_ENTRY = "backup.json";
const CHAT_IMAGES_DIRECTORY = "chat-images";

type BundleFile = string | null;

type BackupConversation = {
  conversation: Conversation;
  messages: Message[];
  sources: MessageSource[];
  images: { messageId: string; name: string; file: BundleFile }[];
};

type BackupCapsule = {
  capsule: Capsule;
  values: CapsuleValue[];
  tagIds: string[];
  versions: CapsuleVersion[];
  reminders: Reminder[];
  links: CapsuleLink[];
  attachments: { attachment: Attachment; file: BundleFile }[];
};

type FullBackup = {
  conversations: BackupConversation[];
  /**
   * 5.6 — optional so a backup made before personas and snippets were
   * included still restores; then the current ones are left as they are.
   */
  personas?: Persona[];
  snippets?: Snippet[];
  capsules: {
    types: { type: CapsuleType; fields: CapsuleField[] }[];
    tags: Tag[];
    capsules: BackupCapsule[];
  };
};

export class BackupTooLargeError extends Error {
  constructor() {
    super("This backup is too large to make as one file.");
    this.name = "BackupTooLargeError";
  }
}

const lastSegment = (path: string) => path.slice(path.lastIndexOf("/") + 1);

export async function createBackupBundle(
  db: SQLiteDatabase,
  options: { maxTotalBytes?: number } = {},
): Promise<Uint8Array> {
  const limit = options.maxTotalBytes ?? MAX_BUNDLE_BYTES;
  const files: Record<string, Uint8Array> = {};
  let total = 0;
  let count = 0;
  const addFile = async (path: string): Promise<BundleFile> => {
    let bytes: Uint8Array;
    try {
      bytes = await readAppFileBytes(path);
    } catch {
      return null; // missing on this device — recorded, not fatal
    }
    total += bytes.length;
    if (total > limit) throw new BackupTooLargeError();
    const name = `files/${++count}`;
    files[name] = bytes;
    return name;
  };

  const conversations: BackupConversation[] = [];
  for (const conversation of getAllConversations(db)) {
    const messages = getMessagesByConversation(db, conversation.id);
    const images: BackupConversation["images"] = [];
    for (const message of messages) {
      const image = getImageByMessage(db, message.id);
      if (image === null) continue;
      images.push({
        messageId: message.id,
        name: lastSegment(image.path),
        file: await addFile(image.path),
      });
    }
    conversations.push({
      conversation,
      messages,
      sources: getSourcesByConversation(db, conversation.id),
      images,
    });
  }

  const capsules: BackupCapsule[] = [];
  for (const capsule of getAllCapsules(db)) {
    const attachments: BackupCapsule["attachments"] = [];
    for (const attachment of getAttachmentsByCapsule(db, capsule.id)) {
      attachments.push({
        attachment,
        file: await addFile(attachment.storagePath),
      });
    }
    capsules.push({
      capsule,
      values: getValuesByCapsule(db, capsule.id),
      tagIds: getTagsByCapsule(db, capsule.id).map((t) => t.id),
      versions: getVersionsByCapsule(db, capsule.id),
      reminders: getRemindersByCapsule(db, capsule.id),
      links: getLinksFrom(db, capsule.id),
      attachments,
    });
  }

  const personas = getAllPersonas(db);
  const snippets = getAllSnippets(db);
  const json = textToBytes(
    serializePortable<FullBackup>(KIND, {
      conversations,
      personas,
      snippets,
      capsules: {
        types: getAllCapsuleTypes(db).map((type) => ({
          type,
          fields: getFieldsByCapsuleType(db, type.id),
        })),
        tags: getAllTags(db),
        capsules,
      },
    }),
  );
  if (total + json.length > limit) throw new BackupTooLargeError();
  const bundle = zipFiles({ [JSON_ENTRY]: json, ...files });

  insertAuditEntry(db, {
    id: generateId(),
    action: "export",
    detail: `Full backup (${conversations.length} conversation${conversations.length === 1 ? "" : "s"}, ${capsules.length} capsule${capsules.length === 1 ? "" : "s"}, ${personas.length} persona${personas.length === 1 ? "" : "s"}, ${snippets.length} snippet${snippets.length === 1 ? "" : "s"})`,
    createdAt: Date.now(),
  });
  return bundle;
}

function readBundle(bytes: Uint8Array): {
  backup: FullBackup;
  entries: Record<string, Uint8Array>;
} {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipFiles(bytes);
  } catch (error) {
    throw new PortableFormatError(
      error instanceof Error ? error.message : "That file isn't a backup.",
    );
  }
  if (!Object.hasOwn(entries, JSON_ENTRY)) {
    throw new PortableFormatError(
      `This isn't a Capsule backup (no ${JSON_ENTRY} inside).`,
    );
  }
  const backup = parsePortable<FullBackup>(
    textFromBytes(entries[JSON_ENTRY]),
    KIND,
  );
  for (const list of [backup.personas, backup.snippets]) {
    if (list !== undefined && !Array.isArray(list)) {
      throw new PortableFormatError(
        "This backup's personas or snippets are damaged.",
      );
    }
  }
  const unsafe = [
    ...backup.conversations.map((c) => c.conversation.id),
    ...backup.conversations.flatMap((c) => c.images.map((i) => i.messageId)),
    ...backup.capsules.capsules.map((c) => c.capsule.id),
    ...backup.capsules.capsules.flatMap((c) =>
      c.attachments.map((a) => a.attachment.id),
    ),
  ].find((id) => typeof id !== "string" || !isSafeSegment(id));
  if (unsafe !== undefined) {
    throw new PortableFormatError(
      "This backup contains ids that can't be used safely on this device.",
    );
  }
  return { backup, entries };
}

/** Restores a full backup bundle, replacing everything (see the module comment). */
export async function restoreBackupBundle(
  db: SQLiteDatabase,
  bytes: Uint8Array,
): Promise<void> {
  const { backup, entries } = readBundle(bytes);

  // What's there now — its files and scheduled notifications go once the
  // new rows are in. Gathered before anything is written.
  const oldFiles: string[] = [];
  const oldConversationIds = getAllConversations(db).map((c) => c.id);
  const oldCapsuleIds = getAllCapsules(db).map((c) => c.id);
  for (const id of oldConversationIds) {
    for (const message of getMessagesByConversation(db, id)) {
      const image = getImageByMessage(db, message.id);
      if (image !== null) oldFiles.push(image.path);
    }
  }
  const oldNotificationIds: string[] = [];
  for (const id of oldCapsuleIds) {
    for (const attachment of getAttachmentsByCapsule(db, id)) {
      oldFiles.push(attachment.storagePath);
    }
    for (const reminder of getRemindersByCapsule(db, id)) {
      if (reminder.notificationId !== null) {
        oldNotificationIds.push(reminder.notificationId);
      }
    }
  }

  // Each file entry backs one row at most.
  const claimed = new Set<string>();
  const take = (file: unknown): Uint8Array | null => {
    if (typeof file !== "string" || claimed.has(file)) return null;
    if (!Object.hasOwn(entries, file)) return null;
    const data = entries[file];
    if (!(data instanceof Uint8Array)) return null;
    claimed.add(file);
    return data;
  };
  // Fresh names: a full random id per restore plus a counter, so two
  // backup names that sanitize alike still differ, and no earlier file —
  // from the current data or an earlier restore — can share a name.
  const restoreId = generateId();
  let fileCount = 0;
  const written: string[] = [];
  const write = (folder: string[], name: string, data: Uint8Array) => {
    const path = writeAppFileBytes(
      folder,
      `${restoreId}-${++fileCount}-${toSafeFileName(name) || "file"}`,
      data,
    );
    written.push(path);
    return path;
  };

  // 2. New files first, under fresh names.
  const imagePaths = new Map<string, string>(); // messageId → path
  const attachmentPaths = new Map<string, string>(); // attachmentId → path
  try {
    for (const { conversation, messages, images } of backup.conversations) {
      // An image only belongs to a message of its own conversation.
      const messageIds = new Set(messages.map((m) => m.id));
      for (const image of images) {
        if (!messageIds.has(image.messageId)) continue;
        const data = take(image.file);
        if (data === null) continue;
        imagePaths.set(
          image.messageId,
          write([CHAT_IMAGES_DIRECTORY, conversation.id], image.name, data),
        );
      }
    }
    for (const { capsule, attachments } of backup.capsules.capsules) {
      for (const { attachment, file } of attachments) {
        const data = take(file);
        if (data === null) continue;
        attachmentPaths.set(
          attachment.id,
          write(
            [ATTACHMENTS_DIRECTORY, capsule.id],
            `${attachment.id}-${attachment.filename}`,
            data,
          ),
        );
      }
    }
  } catch (error) {
    removeFiles(written);
    throw error;
  }

  // 3. Rows, all or nothing.
  try {
    inTransaction(db, () => {
      for (const id of oldConversationIds) {
        deleteImagesByConversation(db, id);
        deleteSourcesByConversation(db, id);
        deleteMessagesByConversation(db, id);
        deleteConversation(db, id);
      }
      for (const id of oldCapsuleIds) {
        deleteAttachmentsByCapsule(db, id);
        deleteRemindersByCapsule(db, id);
        deleteLinksByCapsule(db, id);
        deleteCapsuleTagsByCapsule(db, id);
        deleteVersionsByCapsule(db, id);
        deleteValuesByCapsule(db, id);
        deleteEmbedding(db, id);
        deleteCapsule(db, id);
      }
      for (const type of getAllCapsuleTypes(db)) {
        deleteFieldsByCapsuleType(db, type.id);
        deleteCapsuleType(db, type.id);
      }
      for (const tag of getAllTags(db)) deleteTag(db, tag.id);
      if (backup.personas !== undefined) {
        for (const p of getAllPersonas(db)) deletePersona(db, p.id);
        for (const p of backup.personas) insertPersona(db, p);
      }
      if (backup.snippets !== undefined) {
        for (const sn of getAllSnippets(db)) deleteSnippet(db, sn.id);
        for (const sn of backup.snippets) insertSnippet(db, sn);
      }

      for (const {
        conversation,
        messages,
        sources,
        images,
      } of backup.conversations) {
        insertConversation(db, conversation);
        for (const message of messages) insertMessage(db, message);
        const byMessage = new Map<string, MessageSource[]>();
        for (const source of sources) {
          byMessage.set(source.messageId, [
            ...(byMessage.get(source.messageId) ?? []),
            source,
          ]);
        }
        for (const [messageId, list] of byMessage) {
          insertMessageSources(
            db,
            messageId,
            conversation.id,
            list.sort((a, b) => a.rank - b.rank),
          );
        }
        for (const image of images) {
          const path = imagePaths.get(image.messageId);
          if (path === undefined) continue;
          insertMessageImage(db, {
            messageId: image.messageId,
            conversationId: conversation.id,
            path,
          });
        }
      }

      for (const { type, fields } of backup.capsules.types) {
        insertCapsuleType(db, type);
        for (const field of fields) insertCapsuleField(db, field);
      }
      for (const tag of backup.capsules.tags) insertTag(db, tag);
      const now = Date.now();
      for (const entry of backup.capsules.capsules) {
        insertCapsule(db, entry.capsule);
      }
      for (const entry of backup.capsules.capsules) {
        const id = entry.capsule.id;
        for (const value of entry.values) upsertCapsuleValue(db, value);
        for (const tagId of entry.tagIds) addTagToCapsule(db, id, tagId, now);
        for (const version of entry.versions) insertCapsuleVersion(db, version);
        for (const reminder of entry.reminders) {
          insertReminder(db, { ...reminder, notificationId: null });
        }
        for (const link of entry.links) insertLink(db, link);
        for (const { attachment } of entry.attachments) {
          const path = attachmentPaths.get(attachment.id);
          if (path === undefined) continue;
          insertAttachment(db, {
            ...attachment,
            capsuleId: id,
            storagePath: path,
          });
        }
      }

      insertAuditEntry(db, {
        id: generateId(),
        action: "wipe",
        detail:
          backup.personas !== undefined || backup.snippets !== undefined
            ? "Full backup restored — replaced conversations, capsules, personas and snippets"
            : "Full backup restored — replaced conversations and capsules",
        createdAt: Date.now(),
      });
    });
  } catch (error) {
    removeFiles(written);
    throw error;
  }

  // 4. Old files, the replaced reminders' notifications, then folders of
  // anything that's no longer there.
  removeFiles(oldFiles);
  for (const id of oldNotificationIds) {
    await cancelLocalNotification(id); // never throws
  }
  const keptConversations = new Set(
    backup.conversations.map((c) => c.conversation.id),
  );
  const keptCapsules = new Set(
    backup.capsules.capsules.map((c) => c.capsule.id),
  );
  for (const id of oldConversationIds) {
    if (!keptConversations.has(id)) removeFolder(CHAT_IMAGES_DIRECTORY, id);
  }
  for (const id of oldCapsuleIds) {
    if (!keptCapsules.has(id)) removeFolder(ATTACHMENTS_DIRECTORY, id);
  }
}

function removeFiles(paths: string[]): void {
  for (const path of paths) {
    try {
      deleteAppFileIfExists(path);
    } catch {
      // best effort — an orphan file, never a missing one
    }
  }
}

function removeFolder(directory: string, id: string): void {
  if (!isSafeSegment(id)) return;
  try {
    deleteAppDirectoryIfExists(directory, id);
  } catch {
    // best effort
  }
}
