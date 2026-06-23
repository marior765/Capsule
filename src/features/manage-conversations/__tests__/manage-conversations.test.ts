// Tests for step 1.8 — written before implementation (TDD)
import type { SQLiteDatabase } from "expo-sqlite";
import { openDb, runMigrations, _resetDbForTesting } from "@/shared/db";
import {
  conversationsMigration,
  getConversationById,
} from "@/entities/conversation";
import {
  getMessagesByConversation,
  insertMessage,
  messagesMigration,
  type Message,
} from "@/entities/message";
import {
  createConversation,
  deleteConversation,
  listConversations,
  renameConversation,
  searchConversations,
} from "../index";

const makeMessage = (id: string, conversationId: string): Message => ({
  id,
  conversationId,
  role: "user",
  content: "Hello",
  tokenCount: 0,
  createdAt: Date.now(),
});

let db: SQLiteDatabase;

beforeEach(() => {
  _resetDbForTesting();
  db = openDb();
  runMigrations(db, [conversationsMigration, messagesMigration]);
});

describe("createConversation — happy path", () => {
  it("creates and persists a conversation with the given title and model", () => {
    const c = createConversation(db, { title: "Recipes", modelId: "model-1" });
    expect(c.id).toBeTruthy();
    expect(c.createdAt).toBeGreaterThan(0);
    expect(c.updatedAt).toBeGreaterThan(0);
    const found = getConversationById(db, c.id);
    expect(found?.title).toBe("Recipes");
    expect(found?.modelId).toBe("model-1");
  });
});

describe("createConversation — edge cases", () => {
  it("defaults the title when none is provided", () => {
    const c = createConversation(db);
    expect(c.title).toBe("New chat");
  });

  it("defaults modelId to null when none is provided", () => {
    const c = createConversation(db, { title: "x" });
    expect(c.modelId).toBeNull();
  });
});

describe("renameConversation — happy path", () => {
  it("updates the conversation title", () => {
    const c = createConversation(db, { title: "Old" });
    renameConversation(db, c.id, "New");
    expect(getConversationById(db, c.id)?.title).toBe("New");
  });
});

describe("renameConversation — edge cases", () => {
  it("does not throw when renaming an unknown id", () => {
    expect(() => renameConversation(db, "missing", "x")).not.toThrow();
  });
});

describe("deleteConversation — happy path", () => {
  it("removes the conversation and cascades to its messages", () => {
    const c = createConversation(db, { title: "Chat" });
    insertMessage(db, makeMessage("m1", c.id));
    insertMessage(db, makeMessage("m2", c.id));

    deleteConversation(db, c.id);

    expect(getConversationById(db, c.id)).toBeNull();
    expect(getMessagesByConversation(db, c.id)).toEqual([]);
  });

  it("does not touch messages of other conversations", () => {
    const a = createConversation(db, { title: "A" });
    const b = createConversation(db, { title: "B" });
    insertMessage(db, makeMessage("a1", a.id));
    insertMessage(db, makeMessage("b1", b.id));

    deleteConversation(db, a.id);

    expect(getMessagesByConversation(db, b.id)).toHaveLength(1);
  });
});

describe("deleteConversation — edge cases", () => {
  it("does not throw when deleting an unknown id", () => {
    expect(() => deleteConversation(db, "missing")).not.toThrow();
  });

  it("deletes a conversation that has no messages", () => {
    const c = createConversation(db, { title: "Empty" });
    deleteConversation(db, c.id);
    expect(getConversationById(db, c.id)).toBeNull();
  });
});

describe("searchConversations — happy path", () => {
  it("matches conversations by title, case-insensitively", () => {
    createConversation(db, { title: "Recipe ideas" });
    createConversation(db, { title: "Work notes" });

    expect(searchConversations(db, "recipe").map((c) => c.title)).toEqual([
      "Recipe ideas",
    ]);
    expect(searchConversations(db, "RECIPE")).toHaveLength(1);
  });
});

describe("searchConversations — edge cases", () => {
  it("returns all conversations for an empty query", () => {
    createConversation(db, { title: "A" });
    createConversation(db, { title: "B" });
    expect(searchConversations(db, "")).toHaveLength(2);
  });

  it("returns an empty array when nothing matches", () => {
    createConversation(db, { title: "A" });
    expect(searchConversations(db, "zzz")).toEqual([]);
  });
});

describe("listConversations", () => {
  it("returns all conversations ordered by updatedAt descending", () => {
    const nowSpy = jest.spyOn(Date, "now");
    nowSpy.mockReturnValue(100);
    const a = createConversation(db, { title: "A" }); // updatedAt 100
    nowSpy.mockReturnValue(200);
    const b = createConversation(db, { title: "B" }); // updatedAt 200
    nowSpy.mockReturnValue(300);
    renameConversation(db, a.id, "A2"); // a.updatedAt -> 300
    nowSpy.mockRestore();

    expect(listConversations(db).map((c) => c.id)).toEqual([a.id, b.id]);
  });
});
