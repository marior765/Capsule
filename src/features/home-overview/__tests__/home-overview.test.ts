// Tests for step 10.11 — written before implementation (TDD)
//
// Found in the simulator: Home was a title and a search box over an empty
// screen, even with capsules and conversations on the device. Home now shows
// what was touched most recently.
import type { SQLiteDatabase } from "expo-sqlite";
import { openDb, runMigrations, _resetDbForTesting } from "@/shared/db";
import {
  capsuleParentIdMigration,
  capsulesMigration,
  insertCapsule,
  type Capsule,
} from "@/entities/capsule";
import {
  conversationsLeafMigration,
  conversationsMigration,
  conversationsPersonaMigration,
  insertConversation,
  type Conversation,
} from "@/entities/conversation";
import { getRecentActivity } from "../index";

let db: SQLiteDatabase;

beforeEach(() => {
  _resetDbForTesting();
  db = openDb();
  runMigrations(db, [
    capsulesMigration,
    capsuleParentIdMigration,
    conversationsMigration,
    conversationsPersonaMigration,
    conversationsLeafMigration,
  ]);
});

const capsule = (id: string, updatedAt: number): Capsule => ({
  id,
  capsuleTypeId: "type-1",
  title: `Capsule ${id}`,
  parentCapsuleId: null,
  createdAt: 1,
  updatedAt,
});

const conversation = (id: string, updatedAt: number): Conversation => ({
  id,
  title: `Chat ${id}`,
  modelId: null,
  personaId: null,
  activeLeafId: null,
  createdAt: 1,
  updatedAt,
});

describe("getRecentActivity", () => {
  it("is empty on a fresh device", () => {
    expect(getRecentActivity(db)).toEqual({ capsules: [], conversations: [] });
  });

  it("lists capsules and conversations most recently updated first", () => {
    insertCapsule(db, capsule("a", 100));
    insertCapsule(db, capsule("b", 300));
    insertCapsule(db, capsule("c", 200));
    insertConversation(db, conversation("x", 50));
    insertConversation(db, conversation("y", 500));

    const { capsules, conversations } = getRecentActivity(db);
    expect(capsules.map((c) => c.id)).toEqual(["b", "c", "a"]);
    expect(conversations.map((c) => c.id)).toEqual(["y", "x"]);
  });

  it("returns at most `limit` of each (default 5)", () => {
    for (let i = 0; i < 8; i++) {
      insertCapsule(db, capsule(`cap-${i}`, i));
      insertConversation(db, conversation(`conv-${i}`, i));
    }
    expect(getRecentActivity(db).capsules).toHaveLength(5);
    expect(getRecentActivity(db).conversations).toHaveLength(5);

    const three = getRecentActivity(db, 3);
    expect(three.capsules.map((c) => c.id)).toEqual([
      "cap-7",
      "cap-6",
      "cap-5",
    ]);
    expect(three.conversations).toHaveLength(3);
  });

  it("treats a non-positive limit as nothing", () => {
    insertCapsule(db, capsule("a", 1));
    expect(getRecentActivity(db, 0)).toEqual({
      capsules: [],
      conversations: [],
    });
  });
});
