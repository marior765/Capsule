// Tests for step 5.2 — written before implementation (TDD)
import type { SQLiteDatabase } from "expo-sqlite";
import { openDb, runMigrations, _resetDbForTesting } from "@/shared/db";
import {
  conversationsLeafMigration,
  conversationsMigration,
  conversationsPersonaMigration,
  getAllConversations,
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
import { PortableFormatError } from "@/shared/format";
import { auditMigration, getAllAuditEntries } from "@/entities/audit";
import {
  exportConversation,
  importConversation,
  exportAllConversations,
  importAllConversations,
} from "../index";

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

beforeEach(() => {
  _resetDbForTesting();
  db = openDb();
  runMigrations(db, [
    conversationsMigration,
    conversationsPersonaMigration,
    conversationsLeafMigration,
    messagesMigration,
    messagesParentMigration,
    auditMigration,
  ]);
});

describe("exportConversation / importConversation — round trip", () => {
  it("round-trips a conversation with a linear message history", () => {
    const conversation = makeConversation("c1", "My chat");
    insertConversation(db, conversation);
    insertMessage(db, makeMessage("m1", "c1", null, "hi"));
    insertMessage(db, makeMessage("m2", "c1", "m1", "hello"));

    const json = exportConversation(db, "c1");
    const imported = importConversation(db, json);

    expect(imported.title).toBe("My chat");
    const importedMessages = getMessagesByConversation(db, imported.id);
    expect(importedMessages.map((m) => m.content).sort()).toEqual([
      "hello",
      "hi",
    ]);
  });

  it("round-trips a branching message tree — every branch, not just the active leaf", () => {
    const conversation = makeConversation("c1");
    insertConversation(db, conversation);
    insertMessage(db, makeMessage("m1", "c1", null, "root"));
    insertMessage(db, makeMessage("m2a", "c1", "m1", "branch A"));
    insertMessage(db, makeMessage("m2b", "c1", "m1", "branch B"));

    const json = exportConversation(db, "c1");
    const imported = importConversation(db, json);

    const importedMessages = getMessagesByConversation(db, imported.id);
    expect(importedMessages).toHaveLength(3);
    expect(importedMessages.map((m) => m.content).sort()).toEqual([
      "branch A",
      "branch B",
      "root",
    ]);
  });

  it("assigns a fresh conversation id on import rather than reusing the original", () => {
    const conversation = makeConversation("c1");
    insertConversation(db, conversation);
    insertMessage(db, makeMessage("m1", "c1", null, "hi"));

    const json = exportConversation(db, "c1");
    const imported = importConversation(db, json);

    expect(imported.id).not.toBe("c1");
  });

  it("importing the same export twice creates two independent conversations, not a collision", () => {
    const conversation = makeConversation("c1");
    insertConversation(db, conversation);
    insertMessage(db, makeMessage("m1", "c1", null, "hi"));

    const json = exportConversation(db, "c1");
    const first = importConversation(db, json);
    const second = importConversation(db, json);

    expect(first.id).not.toBe(second.id);
    expect(getAllConversations(db)).toHaveLength(3); // original + 2 imports
  });

  it("remaps every message's conversationId to the new conversation's id", () => {
    const conversation = makeConversation("c1");
    insertConversation(db, conversation);
    insertMessage(db, makeMessage("m1", "c1", null, "hi"));

    const json = exportConversation(db, "c1");
    const imported = importConversation(db, json);

    const importedMessages = getMessagesByConversation(db, imported.id);
    expect(
      importedMessages.every((m) => m.conversationId === imported.id),
    ).toBe(true);
  });

  it("remaps parentId references consistently within the imported tree", () => {
    const conversation = makeConversation("c1");
    insertConversation(db, conversation);
    insertMessage(db, makeMessage("m1", "c1", null, "root"));
    insertMessage(db, makeMessage("m2", "c1", "m1", "reply"));

    const json = exportConversation(db, "c1");
    const imported = importConversation(db, json);

    const importedMessages = getMessagesByConversation(db, imported.id);
    const root = importedMessages.find((m) => m.content === "root")!;
    const reply = importedMessages.find((m) => m.content === "reply")!;
    expect(reply.parentId).toBe(root.id);
    expect(root.parentId).toBeNull();
  });

  it("remaps activeLeafId to the corresponding new message id", () => {
    const conversation = { ...makeConversation("c1"), activeLeafId: "m1" };
    insertConversation(db, conversation);
    insertMessage(db, makeMessage("m1", "c1", null, "hi"));

    const json = exportConversation(db, "c1");
    const imported = importConversation(db, json);

    const importedMessages = getMessagesByConversation(db, imported.id);
    expect(imported.activeLeafId).toBe(importedMessages[0].id);
  });
});

describe("exportConversation — error handling", () => {
  it("throws for a conversation id that does not exist", () => {
    expect(() => exportConversation(db, "nonexistent")).toThrow();
  });
});

// CLAUDE.md hard rule: "Privacy-sensitive actions (export, decrypt, wipe,
// model download) must write to the audit entity." Export is the direction
// that can move data outside the device, so it's the one covered here —
// import only ever brings data in, and isn't named by the rule's own
// wording, so it deliberately does not write an audit entry.
describe("exportConversation — audit logging", () => {
  it("writes an 'export' audit entry", () => {
    insertConversation(db, makeConversation("c1", "My chat"));
    insertMessage(db, makeMessage("m1", "c1", null, "hi"));

    exportConversation(db, "c1");

    const entries = getAllAuditEntries(db);
    expect(entries).toContainEqual(
      expect.objectContaining({ action: "export" }),
    );
  });

  it("does not write an audit entry when the export fails", () => {
    expect(() => exportConversation(db, "nonexistent")).toThrow();
    expect(getAllAuditEntries(db)).toEqual([]);
  });
});

describe("importConversation — error handling", () => {
  it("rejects a portable payload of the wrong kind", () => {
    const wrongKindJson = JSON.stringify({
      formatVersion: 1,
      kind: "capsule",
      exportedAt: 1000,
      data: { conversation: makeConversation("c1"), messages: [] },
    });
    expect(() => importConversation(db, wrongKindJson)).toThrow(
      PortableFormatError,
    );
  });

  it("rejects malformed JSON", () => {
    expect(() => importConversation(db, "not json")).toThrow(
      PortableFormatError,
    );
  });
});

describe("exportAllConversations — audit logging", () => {
  it("writes an 'export' audit entry", () => {
    insertConversation(db, makeConversation("c1", "First"));
    exportAllConversations(db);
    const entries = getAllAuditEntries(db);
    expect(entries).toContainEqual(
      expect.objectContaining({ action: "export" }),
    );
  });
});

describe("exportAllConversations / importAllConversations — the 'whole vault' scope", () => {
  it("exports and reimports every conversation", () => {
    insertConversation(db, makeConversation("c1", "First"));
    insertMessage(db, makeMessage("m1", "c1", null, "hi"));
    insertConversation(db, makeConversation("c2", "Second"));
    insertMessage(db, makeMessage("m2", "c2", null, "hey"));

    const json = exportAllConversations(db);
    _resetDbForTesting();
    db = openDb();
    runMigrations(db, [
      conversationsMigration,
      conversationsPersonaMigration,
      conversationsLeafMigration,
      messagesMigration,
      messagesParentMigration,
      auditMigration,
    ]);

    const imported = importAllConversations(db, json);

    expect(imported).toHaveLength(2);
    expect(
      getAllConversations(db)
        .map((c) => c.title)
        .sort(),
    ).toEqual(["First", "Second"]);
  });

  it("is empty, not an error, when there are no conversations", () => {
    const json = exportAllConversations(db);
    const imported = importAllConversations(db, json);
    expect(imported).toEqual([]);
  });

  it("keeps each conversation's own messages correctly separated after a whole-vault reimport", () => {
    insertConversation(db, makeConversation("c1", "First"));
    insertMessage(db, makeMessage("m1", "c1", null, "only in first"));
    insertConversation(db, makeConversation("c2", "Second"));
    insertMessage(db, makeMessage("m2", "c2", null, "only in second"));

    const json = exportAllConversations(db);
    const [importedFirst, importedSecond] = importAllConversations(
      db,
      json,
    ).sort((a, b) => a.title.localeCompare(b.title));

    const firstMessages = getMessagesByConversation(db, importedFirst.id);
    const secondMessages = getMessagesByConversation(db, importedSecond.id);
    expect(firstMessages.map((m) => m.content)).toEqual(["only in first"]);
    expect(secondMessages.map((m) => m.content)).toEqual(["only in second"]);
  });
});
