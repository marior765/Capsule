// Tests for step 1.4 — written before implementation (TDD)
import type { SQLiteDatabase } from "expo-sqlite";
import { openDb, runMigrations, _resetDbForTesting } from "@/shared/db";
import {
  deleteMessagesByConversation,
  getMessagesByConversation,
  insertMessage,
  messagesMigration,
  type Message,
} from "../index";

const makeMessage = (overrides: Partial<Message> = {}): Message => ({
  id: `m-${Math.random().toString(36).slice(2)}`,
  conversationId: "conv-1",
  role: "user",
  content: "Hello",
  tokenCount: 0,
  createdAt: 1000,
  ...overrides,
});

let db: SQLiteDatabase;

beforeEach(() => {
  _resetDbForTesting();
  db = openDb();
  runMigrations(db, [messagesMigration]);
});

describe("entities/message — happy path", () => {
  it("inserts and retrieves messages in chronological order", () => {
    insertMessage(db, makeMessage({ id: "second", createdAt: 200 }));
    insertMessage(db, makeMessage({ id: "first", createdAt: 100 }));
    expect(getMessagesByConversation(db, "conv-1").map((m) => m.id)).toEqual([
      "first",
      "second",
    ]);
  });

  it("persists all three roles", () => {
    insertMessage(db, makeMessage({ id: "s", role: "system", createdAt: 1 }));
    insertMessage(db, makeMessage({ id: "u", role: "user", createdAt: 2 }));
    insertMessage(db, makeMessage({ id: "a", role: "assistant", createdAt: 3 }));
    const roles = getMessagesByConversation(db, "conv-1").map((m) => m.role);
    expect(roles).toEqual(["system", "user", "assistant"]);
  });

  it("records content and tokenCount", () => {
    insertMessage(
      db,
      makeMessage({ id: "x", content: "Hi there", tokenCount: 2 })
    );
    const [m] = getMessagesByConversation(db, "conv-1");
    expect(m.content).toBe("Hi there");
    expect(m.tokenCount).toBe(2);
  });
});

describe("entities/message — edge cases", () => {
  it("isolates messages by conversation", () => {
    insertMessage(db, makeMessage({ id: "a1", conversationId: "A" }));
    insertMessage(db, makeMessage({ id: "b1", conversationId: "B" }));
    expect(getMessagesByConversation(db, "A").map((m) => m.id)).toEqual(["a1"]);
  });

  it("returns empty array for unknown conversation", () => {
    expect(getMessagesByConversation(db, "missing")).toEqual([]);
  });

  it("deleteMessagesByConversation removes all messages for that conversation", () => {
    insertMessage(db, makeMessage({ id: "a1", conversationId: "A" }));
    insertMessage(db, makeMessage({ id: "a2", conversationId: "A" }));
    insertMessage(db, makeMessage({ id: "b1", conversationId: "B" }));
    deleteMessagesByConversation(db, "A");
    expect(getMessagesByConversation(db, "A")).toEqual([]);
    expect(getMessagesByConversation(db, "B")).toHaveLength(1);
  });
});

describe("entities/message — error handling", () => {
  it("throws on duplicate id insert", () => {
    insertMessage(db, makeMessage({ id: "dup" }));
    expect(() => insertMessage(db, makeMessage({ id: "dup" }))).toThrow();
  });
});
