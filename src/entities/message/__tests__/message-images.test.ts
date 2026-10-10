// Tests for 8.4 (images attached to chat messages) — written before implementation (TDD)
import type { SQLiteDatabase } from "expo-sqlite";
import { openDb, runMigrations, _resetDbForTesting } from "@/shared/db";
import {
  deleteImagesByConversation,
  getImageByMessage,
  insertMessageImage,
  messageImagesMigration,
} from "../index";

let db: SQLiteDatabase;

beforeEach(() => {
  _resetDbForTesting();
  db = openDb();
  runMigrations(db, [messageImagesMigration]);
});

describe("message images", () => {
  it("stores and returns a message's image path", () => {
    insertMessageImage(db, {
      messageId: "m1",
      conversationId: "c1",
      path: "chat-images/c1/m1-photo.jpg",
    });
    expect(getImageByMessage(db, "m1")).toEqual({
      messageId: "m1",
      conversationId: "c1",
      path: "chat-images/c1/m1-photo.jpg",
    });
  });

  it("returns null for a message without an image", () => {
    expect(getImageByMessage(db, "none")).toBeNull();
  });

  it("deletes a conversation's image rows only", () => {
    insertMessageImage(db, {
      messageId: "m1",
      conversationId: "c1",
      path: "a",
    });
    insertMessageImage(db, {
      messageId: "m2",
      conversationId: "c2",
      path: "b",
    });
    deleteImagesByConversation(db, "c1");
    expect(getImageByMessage(db, "m1")).toBeNull();
    expect(getImageByMessage(db, "m2")).not.toBeNull();
  });
});
