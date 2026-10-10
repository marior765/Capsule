// Tests for 7.4 (which capsules grounded an answer) — written before implementation (TDD)
import type { SQLiteDatabase } from "expo-sqlite";
import { openDb, runMigrations, _resetDbForTesting } from "@/shared/db";
import {
  deleteSourcesByConversation,
  getSourcesByConversation,
  getSourcesByMessage,
  insertMessageSources,
  messageSourcesMigration,
} from "../index";

let db: SQLiteDatabase;

beforeEach(() => {
  _resetDbForTesting();
  db = openDb();
  runMigrations(db, [messageSourcesMigration]);
});

describe("message sources", () => {
  it("stores and returns a message's sources in rank order", () => {
    insertMessageSources(db, "m1", "c1", [
      { capsuleId: "cap-a", title: "Dentist" },
      { capsuleId: "cap-b", title: "Insurance" },
    ]);
    expect(getSourcesByMessage(db, "m1")).toEqual([
      {
        messageId: "m1",
        conversationId: "c1",
        capsuleId: "cap-a",
        title: "Dentist",
        rank: 0,
      },
      {
        messageId: "m1",
        conversationId: "c1",
        capsuleId: "cap-b",
        title: "Insurance",
        rank: 1,
      },
    ]);
  });

  it("returns an empty list for a message without sources", () => {
    expect(getSourcesByMessage(db, "none")).toEqual([]);
  });

  it("inserting no sources writes nothing", () => {
    insertMessageSources(db, "m1", "c1", []);
    expect(getSourcesByConversation(db, "c1")).toEqual([]);
  });

  it("lists all of a conversation's sources and deletes them together", () => {
    insertMessageSources(db, "m1", "c1", [{ capsuleId: "a", title: "A" }]);
    insertMessageSources(db, "m2", "c1", [{ capsuleId: "b", title: "B" }]);
    insertMessageSources(db, "m3", "c2", [{ capsuleId: "c", title: "C" }]);

    expect(getSourcesByConversation(db, "c1").map((s) => s.messageId)).toEqual([
      "m1",
      "m2",
    ]);
    deleteSourcesByConversation(db, "c1");
    expect(getSourcesByConversation(db, "c1")).toEqual([]);
    expect(getSourcesByConversation(db, "c2")).toHaveLength(1);
  });
});
