// Tests for step 6.4 — written before implementation (TDD)
import type { SQLiteDatabase } from "expo-sqlite";
import { openDb, runMigrations, _resetDbForTesting } from "@/shared/db";
import {
  capsulesMigration,
  capsuleValuesMigration,
  getCapsuleById,
  getValuesByCapsule,
} from "@/entities/capsule";
import {
  capsuleTagsMigration,
  getTagsByCapsule,
  tagsMigration,
} from "@/entities/tag";
import { createCapsule } from "@/features/create-capsule";
import { tagCapsule } from "@/features/tag-capsule";
import { deleteCapsule } from "../index";

let db: SQLiteDatabase;

beforeEach(() => {
  _resetDbForTesting();
  db = openDb();
  runMigrations(db, [
    capsulesMigration,
    capsuleValuesMigration,
    tagsMigration,
    capsuleTagsMigration,
  ]);
});

describe("deleteCapsule", () => {
  it("removes the capsule itself", () => {
    const capsule = createCapsule(db, { capsuleTypeId: "ct-1" });
    deleteCapsule(db, capsule.id);
    expect(getCapsuleById(db, capsule.id)).toBeNull();
  });

  it("removes every one of the capsule's field values too — cross-entity cleanup", () => {
    const capsule = createCapsule(db, {
      capsuleTypeId: "ct-1",
      values: { "f-a": "1", "f-b": "2" },
    });
    deleteCapsule(db, capsule.id);
    expect(getValuesByCapsule(db, capsule.id)).toEqual([]);
  });

  it("leaves other capsules' values intact", () => {
    const a = createCapsule(db, { capsuleTypeId: "ct-1", values: { f: "a" } });
    const b = createCapsule(db, { capsuleTypeId: "ct-1", values: { f: "b" } });
    deleteCapsule(db, a.id);
    expect(getCapsuleById(db, b.id)).not.toBeNull();
    expect(getValuesByCapsule(db, b.id)).toHaveLength(1);
  });

  it("deleting an unknown id does not throw", () => {
    expect(() => deleteCapsule(db, "missing")).not.toThrow();
  });

  it("removes the capsule's tag attachments too, without deleting the tag records themselves (6.6 cascade)", () => {
    const capsule = createCapsule(db, { capsuleTypeId: "ct-1" });
    tagCapsule(db, capsule.id, "urgent");
    deleteCapsule(db, capsule.id);
    expect(getTagsByCapsule(db, capsule.id)).toEqual([]);
  });

  it("leaves another capsule's tag attachments intact", () => {
    const a = createCapsule(db, { capsuleTypeId: "ct-1" });
    const b = createCapsule(db, { capsuleTypeId: "ct-1" });
    const tag = tagCapsule(db, a.id, "shared-tag");
    tagCapsule(db, b.id, "shared-tag");
    deleteCapsule(db, a.id);
    expect(getTagsByCapsule(db, b.id).map((t) => t.id)).toEqual([tag.id]);
  });
});
