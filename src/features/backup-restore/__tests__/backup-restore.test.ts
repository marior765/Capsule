// Tests for step 5.3 — written before implementation (TDD)
// "hard" depth per CLAUDE.md's create-tests guidance (restore is a
// destructive, wipe-then-replace operation).
import type { SQLiteDatabase } from "expo-sqlite";
import { openDb, runMigrations, _resetDbForTesting } from "@/shared/db";
import {
  conversationsLeafMigration,
  conversationsMigration,
  conversationsPersonaMigration,
  getAllConversations,
  getConversationById,
  insertConversation,
  type Conversation,
} from "@/entities/conversation";
import {
  getMessagesByConversation,
  insertMessage,
  messagesMigration,
  messagesParentMigration,
  type Message,
} from "@/entities/message";
import { auditMigration, getAllAuditEntries } from "@/entities/audit";
import { PortableFormatError } from "@/shared/format";
import { createBackup, restoreBackup } from "../index";

let db: SQLiteDatabase;

const makeConversation = (id: string, title = "Chat"): Conversation => ({
  id,
  title,
  modelId: null,
  personaId: null,
  activeLeafId: null,
  createdAt: 1000,
  updatedAt: 1000,
});

const makeMessage = (
  id: string,
  conversationId: string,
  parentId: string | null,
  content: string,
): Message => ({
  id,
  conversationId,
  parentId,
  role: "user",
  content,
  tokenCount: 0,
  createdAt: 1000,
});

const runAllMigrations = (database: SQLiteDatabase) =>
  runMigrations(database, [
    conversationsMigration,
    conversationsPersonaMigration,
    conversationsLeafMigration,
    messagesMigration,
    messagesParentMigration,
    auditMigration,
  ]);

beforeEach(() => {
  _resetDbForTesting();
  db = openDb();
  runAllMigrations(db);
});

describe("createBackup / restoreBackup — round trip, id-preserving", () => {
  it("restores a conversation under its ORIGINAL id — unlike import, which regenerates", () => {
    insertConversation(db, makeConversation("c1", "My chat"));
    insertMessage(db, makeMessage("m1", "c1", null, "hi"));

    const backup = createBackup(db);
    restoreBackup(db, backup);

    expect(getConversationById(db, "c1")).not.toBeNull();
    expect(getConversationById(db, "c1")?.title).toBe("My chat");
  });

  it("restores messages under their original ids and parentId chain", () => {
    insertConversation(db, makeConversation("c1"));
    insertMessage(db, makeMessage("m1", "c1", null, "root"));
    insertMessage(db, makeMessage("m2", "c1", "m1", "reply"));

    const backup = createBackup(db);
    restoreBackup(db, backup);

    const messages = getMessagesByConversation(db, "c1");
    expect(messages.map((m) => m.id).sort()).toEqual(["m1", "m2"]);
    expect(messages.find((m) => m.id === "m2")?.parentId).toBe("m1");
  });

  it("restores the full branching tree, not just the active leaf", () => {
    insertConversation(db, makeConversation("c1"));
    insertMessage(db, makeMessage("m1", "c1", null, "root"));
    insertMessage(db, makeMessage("m2a", "c1", "m1", "branch A"));
    insertMessage(db, makeMessage("m2b", "c1", "m1", "branch B"));

    const backup = createBackup(db);
    restoreBackup(db, backup);

    expect(getMessagesByConversation(db, "c1")).toHaveLength(3);
  });

  it("preserves activeLeafId exactly", () => {
    insertConversation(db, { ...makeConversation("c1"), activeLeafId: "m1" });
    insertMessage(db, makeMessage("m1", "c1", null, "hi"));

    const backup = createBackup(db);
    restoreBackup(db, backup);

    expect(getConversationById(db, "c1")?.activeLeafId).toBe("m1");
  });
});

describe("restoreBackup — replaces existing data", () => {
  it("removes conversations that existed before the restore but aren't in the backup", () => {
    insertConversation(db, makeConversation("keep", "Will be backed up"));
    const backup = createBackup(db);

    insertConversation(db, makeConversation("stray", "Created after backup"));
    restoreBackup(db, backup);

    expect(getConversationById(db, "keep")).not.toBeNull();
    expect(getConversationById(db, "stray")).toBeNull();
  });

  it("removes messages belonging to conversations not in the backup", () => {
    insertConversation(db, makeConversation("keep"));
    insertMessage(db, makeMessage("m1", "keep", null, "hi"));
    const backup = createBackup(db);

    insertConversation(db, makeConversation("stray"));
    insertMessage(db, makeMessage("m2", "stray", null, "gone soon"));
    restoreBackup(db, backup);

    expect(getAllConversations(db).map((c) => c.id)).toEqual(["keep"]);
    expect(getMessagesByConversation(db, "stray")).toEqual([]);
  });

  it("restoring twice in a row is idempotent — no duplicate conversations", () => {
    insertConversation(db, makeConversation("c1"));
    insertMessage(db, makeMessage("m1", "c1", null, "hi"));
    const backup = createBackup(db);

    restoreBackup(db, backup);
    restoreBackup(db, backup);

    expect(getAllConversations(db)).toHaveLength(1);
    expect(getMessagesByConversation(db, "c1")).toHaveLength(1);
  });
});

describe("restoreBackup — validates before destroying anything", () => {
  it("rejects a malformed backup without touching existing data", () => {
    insertConversation(db, makeConversation("c1", "Untouched"));

    expect(() => restoreBackup(db, "not json")).toThrow(PortableFormatError);

    expect(getConversationById(db, "c1")?.title).toBe("Untouched");
  });

  it("rejects a wrong-kind payload without touching existing data", () => {
    insertConversation(db, makeConversation("c1", "Untouched"));
    const wrongKindJson = JSON.stringify({
      formatVersion: 1,
      kind: "conversation",
      exportedAt: 1000,
      data: { conversations: [] },
    });

    expect(() => restoreBackup(db, wrongKindJson)).toThrow(PortableFormatError);
    expect(getConversationById(db, "c1")?.title).toBe("Untouched");
  });
});

describe("createBackup — audit logging", () => {
  it("writes an 'export' audit entry", () => {
    insertConversation(db, makeConversation("c1"));
    createBackup(db);
    expect(getAllAuditEntries(db)).toContainEqual(
      expect.objectContaining({ action: "export" }),
    );
  });
});

describe("restoreBackup — audit logging", () => {
  it("writes a 'wipe' audit entry before replacing existing data", () => {
    insertConversation(db, makeConversation("c1"));
    const backup = createBackup(db);

    restoreBackup(db, backup);

    expect(getAllAuditEntries(db)).toContainEqual(
      expect.objectContaining({ action: "wipe" }),
    );
  });

  it("does not write a 'wipe' entry when the backup is invalid", () => {
    expect(() => restoreBackup(db, "not json")).toThrow();
    expect(getAllAuditEntries(db).filter((e) => e.action === "wipe")).toEqual(
      [],
    );
  });
});

describe("createBackup — empty vault", () => {
  it("produces a backup that restores to an empty state without error", () => {
    const backup = createBackup(db);
    expect(() => restoreBackup(db, backup)).not.toThrow();
    expect(getAllConversations(db)).toEqual([]);
  });
});
