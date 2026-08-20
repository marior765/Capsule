// Tests for step 6.6 — written before implementation (TDD)
import type { SQLiteDatabase } from "expo-sqlite";
import { openDb, runMigrations, _resetDbForTesting } from "@/shared/db";
import {
  capsuleTagsMigration,
  getTagByName,
  getTagsByCapsule,
  tagsMigration,
} from "@/entities/tag";
import { tagCapsule, untagCapsule, deleteTag } from "../index";

let db: SQLiteDatabase;

beforeEach(() => {
  _resetDbForTesting();
  db = openDb();
  runMigrations(db, [tagsMigration, capsuleTagsMigration]);
});

describe("tagCapsule", () => {
  it("creates a new tag by name and attaches it to the capsule", () => {
    const tag = tagCapsule(db, "c-1", "urgent");
    expect(tag.name).toBe("urgent");
    expect(getTagsByCapsule(db, "c-1").map((t) => t.id)).toEqual([tag.id]);
  });

  it("reuses an existing tag with the same name rather than creating a duplicate", () => {
    const first = tagCapsule(db, "c-1", "urgent");
    const second = tagCapsule(db, "c-2", "urgent");
    expect(second.id).toBe(first.id);
    expect(getTagByName(db, "urgent")?.id).toBe(first.id);
  });

  it("trims the tag name before creating or matching", () => {
    const tag = tagCapsule(db, "c-1", "  urgent  ");
    expect(tag.name).toBe("urgent");
    const reused = tagCapsule(db, "c-2", "urgent");
    expect(reused.id).toBe(tag.id);
  });

  it("tagging the same capsule with the same name twice does not duplicate the attachment", () => {
    tagCapsule(db, "c-1", "urgent");
    tagCapsule(db, "c-1", "urgent");
    expect(getTagsByCapsule(db, "c-1")).toHaveLength(1);
  });
});

describe("untagCapsule", () => {
  it("detaches a tag from a capsule without deleting the tag record itself", () => {
    const tag = tagCapsule(db, "c-1", "urgent");
    untagCapsule(db, "c-1", tag.id);
    expect(getTagsByCapsule(db, "c-1")).toEqual([]);
    expect(getTagByName(db, "urgent")).not.toBeNull();
  });

  it("does not affect other capsules tagged with the same tag", () => {
    const tag = tagCapsule(db, "c-1", "urgent");
    tagCapsule(db, "c-2", "urgent");
    untagCapsule(db, "c-1", tag.id);
    expect(getTagsByCapsule(db, "c-2").map((t) => t.id)).toEqual([tag.id]);
  });
});

describe("deleteTag", () => {
  it("removes the tag record and every capsule's attachment to it", () => {
    const tag = tagCapsule(db, "c-1", "urgent");
    tagCapsule(db, "c-2", "urgent");
    deleteTag(db, tag.id);
    expect(getTagByName(db, "urgent")).toBeNull();
    expect(getTagsByCapsule(db, "c-1")).toEqual([]);
    expect(getTagsByCapsule(db, "c-2")).toEqual([]);
  });

  it("does not affect a different tag still attached to the same capsule", () => {
    const tagA = tagCapsule(db, "c-1", "a");
    const tagB = tagCapsule(db, "c-1", "b");
    deleteTag(db, tagA.id);
    expect(getTagsByCapsule(db, "c-1").map((t) => t.id)).toEqual([tagB.id]);
  });
});
