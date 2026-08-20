// Tests for step 6.6 — written before implementation (TDD)
import type { SQLiteDatabase } from "expo-sqlite";
import { openDb, runMigrations, _resetDbForTesting } from "@/shared/db";
import {
  addTagToCapsule,
  capsuleTagsMigration,
  deleteCapsuleTagsByCapsule,
  deleteCapsuleTagsByTag,
  deleteTag,
  getAllTags,
  getCapsuleIdsByTag,
  getTagById,
  getTagByName,
  getTagsByCapsule,
  insertTag,
  removeTagFromCapsule,
  tagsMigration,
  updateTag,
  type Tag,
} from "../index";

const makeTag = (overrides: Partial<Tag> = {}): Tag => ({
  id: `tag-${Math.random().toString(36).slice(2)}`,
  name: "urgent",
  createdAt: 1000,
  updatedAt: 1000,
  ...overrides,
});

let db: SQLiteDatabase;

beforeEach(() => {
  _resetDbForTesting();
  db = openDb();
  runMigrations(db, [tagsMigration, capsuleTagsMigration]);
});

describe("entities/tag — Tag CRUD", () => {
  it("inserts and retrieves a tag", () => {
    const tag = makeTag();
    insertTag(db, tag);
    expect(getTagById(db, tag.id)?.name).toBe("urgent");
  });

  it("getAllTags orders by updatedAt descending", () => {
    insertTag(db, makeTag({ id: "old", updatedAt: 100 }));
    insertTag(db, makeTag({ id: "new", updatedAt: 300 }));
    insertTag(db, makeTag({ id: "mid", updatedAt: 200 }));
    expect(getAllTags(db).map((t) => t.id)).toEqual(["new", "mid", "old"]);
  });

  it("getTagByName finds an existing tag by exact name", () => {
    insertTag(db, makeTag({ name: "reading-list" }));
    expect(getTagByName(db, "reading-list")?.name).toBe("reading-list");
  });

  it("getTagByName returns null when no tag has that name", () => {
    expect(getTagByName(db, "nonexistent")).toBeNull();
  });

  it("updates a tag's name", () => {
    const tag = makeTag();
    insertTag(db, tag);
    updateTag(db, tag.id, { name: "renamed", updatedAt: 2000 });
    expect(getTagById(db, tag.id)?.name).toBe("renamed");
  });

  it("a rename is reflected in getTagByName lookups — old name misses, new name hits", () => {
    const tag = makeTag({ name: "old-name" });
    insertTag(db, tag);
    updateTag(db, tag.id, { name: "new-name", updatedAt: 2000 });
    expect(getTagByName(db, "old-name")).toBeNull();
    expect(getTagByName(db, "new-name")?.id).toBe(tag.id);
  });

  it("deleteTag removes the tag record", () => {
    const tag = makeTag();
    insertTag(db, tag);
    deleteTag(db, tag.id);
    expect(getTagById(db, tag.id)).toBeNull();
  });
});

describe("entities/tag — capsule/tag junction", () => {
  it("addTagToCapsule then getTagsByCapsule returns the tag", () => {
    const tag = makeTag();
    insertTag(db, tag);
    addTagToCapsule(db, "c-1", tag.id, 1000);
    expect(getTagsByCapsule(db, "c-1").map((t) => t.id)).toEqual([tag.id]);
  });

  it("addTagToCapsule is idempotent — tagging the same pair twice does not throw or duplicate", () => {
    const tag = makeTag();
    insertTag(db, tag);
    addTagToCapsule(db, "c-1", tag.id, 1000);
    expect(() => addTagToCapsule(db, "c-1", tag.id, 2000)).not.toThrow();
    expect(getTagsByCapsule(db, "c-1")).toHaveLength(1);
  });

  it("getCapsuleIdsByTag returns every capsule tagged with a given tag", () => {
    const tag = makeTag();
    insertTag(db, tag);
    addTagToCapsule(db, "c-1", tag.id, 1000);
    addTagToCapsule(db, "c-2", tag.id, 1000);
    expect(getCapsuleIdsByTag(db, tag.id).sort()).toEqual(["c-1", "c-2"]);
  });

  it("removeTagFromCapsule detaches only that one pair", () => {
    const tagA = makeTag({ id: "tag-a", name: "a" });
    const tagB = makeTag({ id: "tag-b", name: "b" });
    insertTag(db, tagA);
    insertTag(db, tagB);
    addTagToCapsule(db, "c-1", tagA.id, 1000);
    addTagToCapsule(db, "c-1", tagB.id, 1000);
    removeTagFromCapsule(db, "c-1", tagA.id);
    expect(getTagsByCapsule(db, "c-1").map((t) => t.id)).toEqual([tagB.id]);
  });

  it("deleteCapsuleTagsByCapsule removes every tag attachment for one capsule, leaving other capsules' attachments intact", () => {
    const tag = makeTag();
    insertTag(db, tag);
    addTagToCapsule(db, "c-1", tag.id, 1000);
    addTagToCapsule(db, "c-2", tag.id, 1000);
    deleteCapsuleTagsByCapsule(db, "c-1");
    expect(getTagsByCapsule(db, "c-1")).toEqual([]);
    expect(getTagsByCapsule(db, "c-2").map((t) => t.id)).toEqual([tag.id]);
  });

  it("deleteCapsuleTagsByTag removes every capsule's attachment to one tag, leaving other tags' attachments intact", () => {
    const tagA = makeTag({ id: "tag-a", name: "a" });
    const tagB = makeTag({ id: "tag-b", name: "b" });
    insertTag(db, tagA);
    insertTag(db, tagB);
    addTagToCapsule(db, "c-1", tagA.id, 1000);
    addTagToCapsule(db, "c-1", tagB.id, 1000);
    deleteCapsuleTagsByTag(db, tagA.id);
    expect(getTagsByCapsule(db, "c-1").map((t) => t.id)).toEqual([tagB.id]);
  });

  it("a capsule with no tags returns an empty array, not an error", () => {
    expect(getTagsByCapsule(db, "untagged-capsule")).toEqual([]);
  });
});
