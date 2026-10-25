// Tests for step 10.24 — written before implementation (TDD)
//
// Found in the simulator: capsule cards showed only a title and a type, so
// list and card views looked the same and told you little. Each capsule now
// gets a preview — its tags and its first few filled-in fields.
import { readFileSync } from "fs";
import { join } from "path";
import type { SQLiteDatabase } from "expo-sqlite";
import { openDb, runMigrations, _resetDbForTesting } from "@/shared/db";
import {
  capsuleParentIdMigration,
  capsulesMigration,
  capsuleValuesMigration,
  insertCapsule,
  upsertCapsuleValue,
  type Capsule,
} from "@/entities/capsule";
import {
  capsuleTypesMigration,
  insertCapsuleType,
} from "@/entities/capsule-type";
import {
  capsuleFieldsMigration,
  insertCapsuleField,
  type FieldType,
} from "@/entities/field";
import {
  addTagToCapsule,
  capsuleTagsMigration,
  insertTag,
  tagsMigration,
} from "@/entities/tag";
import { getCapsulePreviews } from "../index";

let db: SQLiteDatabase;

const capsule = (id: string, capsuleTypeId = "book"): Capsule => ({
  id,
  capsuleTypeId,
  title: id,
  parentCapsuleId: null,
  createdAt: 0,
  updatedAt: 0,
});

const addField = (
  id: string,
  name: string,
  fieldType: FieldType,
  sortOrder: number,
) =>
  insertCapsuleField(db, {
    id,
    capsuleTypeId: "book",
    name,
    fieldType,
    config: null,
    sortOrder,
    required: false,
    createdAt: 0,
    updatedAt: 0,
  });

const setValue = (capsuleId: string, fieldId: string, value: string) =>
  upsertCapsuleValue(db, {
    id: `${capsuleId}-${fieldId}`,
    capsuleId,
    fieldId,
    value,
    createdAt: 0,
    updatedAt: 0,
  });

beforeEach(() => {
  _resetDbForTesting();
  db = openDb();
  runMigrations(db, [
    capsuleTypesMigration,
    capsuleFieldsMigration,
    capsulesMigration,
    capsuleValuesMigration,
    capsuleParentIdMigration,
    tagsMigration,
    capsuleTagsMigration,
  ]);
  insertCapsuleType(db, {
    id: "book",
    name: "Book",
    description: null,
    createdAt: 0,
    updatedAt: 0,
  });
  // Deliberately inserted out of display order.
  addField("finished", "Finished", "date", 2);
  addField("author", "Author", "text", 0);
  addField("pages", "Pages", "number", 1);
  addField("read", "Read", "boolean", 3);
  addField("related", "Related", "relation", 4);
});

describe("getCapsulePreviews", () => {
  it("lists filled-in fields in the type's field order, formatted, up to the limit", () => {
    insertCapsule(db, capsule("dune"));
    setValue("dune", "finished", "2026-10-14");
    setValue("dune", "author", "Frank Herbert");
    setValue("dune", "read", "true");

    const preview = getCapsulePreviews(db, [capsule("dune")], 2).dune;
    expect(preview.fields).toEqual([
      { name: "Author", value: "Frank Herbert" },
      { name: "Finished", value: "14 Oct 2026" },
    ]);
  });

  it("skips empty and unshowable fields rather than leaving gaps", () => {
    insertCapsule(db, capsule("dune"));
    setValue("dune", "author", "  ");
    setValue("dune", "related", "x");
    setValue("dune", "pages", "412");
    expect(getCapsulePreviews(db, [capsule("dune")]).dune.fields).toEqual([
      { name: "Pages", value: "412" },
    ]);
  });

  it("includes the capsule's tag names, alphabetically", () => {
    insertCapsule(db, capsule("dune"));
    for (const [id, name] of [
      ["t1", "sci-fi"],
      ["t2", "classic"],
    ]) {
      insertTag(db, { id, name, createdAt: 0, updatedAt: 0 });
      addTagToCapsule(db, "dune", id, 0);
    }
    expect(getCapsulePreviews(db, [capsule("dune")]).dune.tags).toEqual([
      "classic",
      "sci-fi",
    ]);
  });

  it("gives an empty preview for a capsule whose type no longer exists", () => {
    insertCapsule(db, capsule("orphan", "gone"));
    expect(getCapsulePreviews(db, [capsule("orphan", "gone")]).orphan).toEqual({
      tags: [],
      fields: [],
    });
  });
});

describe("capsules screen (static)", () => {
  const screen = readFileSync(
    join(__dirname, "../../../app/(app)/(tabs)/capsules/index.tsx"),
    "utf8",
  );
  it("computes previews whenever it reloads capsules and passes them on", () => {
    expect(screen).toMatch(/setPreviews\(getCapsulePreviews\(db, all\)\)/);
    expect(screen).toMatch(/previewsById=\{previews\}/);
    expect(screen).not.toMatch(/setCapsules\(getAllCapsules\(db\)\)/);
  });
});
