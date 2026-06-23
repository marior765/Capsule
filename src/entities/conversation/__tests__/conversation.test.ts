// Tests for step 1.4 — written before implementation (TDD)
import type { SQLiteDatabase } from "expo-sqlite";
import { openDb, runMigrations, _resetDbForTesting } from "@/shared/db";
import {
  conversationsMigration,
  deleteConversation,
  getAllConversations,
  getConversationById,
  insertConversation,
  updateConversation,
  type Conversation,
} from "../index";

const makeConversation = (
  overrides: Partial<Conversation> = {}
): Conversation => ({
  id: `c-${Math.random().toString(36).slice(2)}`,
  title: "New chat",
  modelId: "model-1",
  createdAt: 1000,
  updatedAt: 1000,
  ...overrides,
});

let db: SQLiteDatabase;

beforeEach(() => {
  _resetDbForTesting();
  db = openDb();
  runMigrations(db, [conversationsMigration]);
});

describe("entities/conversation — happy path", () => {
  it("inserts and retrieves a conversation", () => {
    const c = makeConversation();
    insertConversation(db, c);
    const found = getConversationById(db, c.id);
    expect(found?.id).toBe(c.id);
    expect(found?.title).toBe("New chat");
    expect(found?.modelId).toBe("model-1");
  });

  it("getAllConversations orders by updatedAt descending", () => {
    insertConversation(db, makeConversation({ id: "old", updatedAt: 100 }));
    insertConversation(db, makeConversation({ id: "new", updatedAt: 300 }));
    insertConversation(db, makeConversation({ id: "mid", updatedAt: 200 }));
    expect(getAllConversations(db).map((c) => c.id)).toEqual([
      "new",
      "mid",
      "old",
    ]);
  });

  it("updates title and bumps updatedAt", () => {
    const c = makeConversation({ updatedAt: 1000 });
    insertConversation(db, c);
    updateConversation(db, c.id, { title: "Renamed", updatedAt: 2000 });
    const found = getConversationById(db, c.id);
    expect(found?.title).toBe("Renamed");
    expect(found?.updatedAt).toBe(2000);
  });

  it("deletes a conversation", () => {
    const c = makeConversation();
    insertConversation(db, c);
    deleteConversation(db, c.id);
    expect(getConversationById(db, c.id)).toBeNull();
  });
});

describe("entities/conversation — edge cases", () => {
  it("round-trips a null modelId (no model / model deleted)", () => {
    const c = makeConversation({ modelId: null });
    insertConversation(db, c);
    expect(getConversationById(db, c.id)?.modelId).toBeNull();
  });

  it("getConversationById returns null for unknown id", () => {
    expect(getConversationById(db, "nope")).toBeNull();
  });

  it("getAllConversations returns empty array when none", () => {
    expect(getAllConversations(db)).toEqual([]);
  });
});

describe("entities/conversation — error handling", () => {
  it("throws on duplicate id insert", () => {
    const c = makeConversation({ id: "dup" });
    insertConversation(db, c);
    expect(() => insertConversation(db, makeConversation({ id: "dup" }))).toThrow();
  });
});
