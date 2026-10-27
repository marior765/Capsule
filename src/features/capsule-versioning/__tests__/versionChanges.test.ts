// Tests for step 10.28 — written before implementation (TDD)
//
// Found in the simulator: history rows showed only the title and a time, so
// three identical-looking "Dune by Frank Herbert" entries said nothing about
// what each edit did. A version is the state just BEFORE an edit, so the
// edit is the difference to the next newer state.
import type { SQLiteDatabase } from "expo-sqlite";
import { openDb, runMigrations, _resetDbForTesting } from "@/shared/db";
import {
  capsuleParentIdMigration,
  capsulesMigration,
  capsuleValuesMigration,
  capsuleVersionsMigration,
  insertCapsule,
  insertCapsuleVersion,
  upsertCapsuleValue,
} from "@/entities/capsule";
import {
  capsuleFieldsMigration,
  insertCapsuleField,
  type FieldType,
} from "@/entities/field";
import { getCapsuleHistory, getVersionChanges } from "../index";

let db: SQLiteDatabase;

const field = (
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

const version = (
  id: string,
  createdAt: number,
  title: string,
  values: Record<string, string | null>,
) =>
  insertCapsuleVersion(db, { id, capsuleId: "dune", title, values, createdAt });

beforeEach(() => {
  _resetDbForTesting();
  db = openDb();
  runMigrations(db, [
    capsulesMigration,
    capsuleValuesMigration,
    capsuleVersionsMigration,
    capsuleParentIdMigration,
    capsuleFieldsMigration,
  ]);
  field("author", "Author", "text", 0);
  field("read", "Read", "boolean", 1);
  field("notes", "Notes", "long_text", 2);
  insertCapsule(db, {
    id: "dune",
    capsuleTypeId: "book",
    title: "Dune",
    parentCapsuleId: null,
    createdAt: 0,
    updatedAt: 0,
  });
  upsertCapsuleValue(db, {
    id: "v-author",
    capsuleId: "dune",
    fieldId: "author",
    value: "Frank Herbert",
    createdAt: 0,
    updatedAt: 0,
  });
  upsertCapsuleValue(db, {
    id: "v-read",
    capsuleId: "dune",
    fieldId: "read",
    value: "true",
    createdAt: 0,
    updatedAt: 0,
  });
});

describe("getVersionChanges", () => {
  it("describes each edit as the difference to the next newer state, in field order", () => {
    version("old", 1, "Dune", { author: "F. Herbert", read: "false" });
    version("new", 2, "Dune", { author: "Frank Herbert", read: "false" });
    const changes = getVersionChanges(
      db,
      "dune",
      getCapsuleHistory(db, "dune"),
    );

    // newest snapshot vs the capsule as it is now: Read false → true
    expect(changes.new).toEqual([
      { label: "Read", before: "No", after: "Yes" },
    ]);
    // older snapshot vs the newer one: Author changed
    expect(changes.old).toEqual([
      { label: "Author", before: "F. Herbert", after: "Frank Herbert" },
    ]);
  });

  it("includes a title change first", () => {
    version("v", 1, "Dune (draft)", { author: "Frank Herbert", read: "true" });
    expect(
      getVersionChanges(db, "dune", getCapsuleHistory(db, "dune")).v,
    ).toEqual([{ label: "Title", before: "Dune (draft)", after: "Dune" }]);
  });

  it("treats a field missing from an older snapshot as empty", () => {
    version("v", 1, "Dune", { author: "Frank Herbert" });
    expect(
      getVersionChanges(db, "dune", getCapsuleHistory(db, "dune")).v,
    ).toEqual([{ label: "Read", before: null, after: "Yes" }]);
  });

  it("is empty when nothing differs (e.g. a restore's safety snapshot)", () => {
    version("v", 1, "Dune", { author: "Frank Herbert", read: "true" });
    expect(
      getVersionChanges(db, "dune", getCapsuleHistory(db, "dune")).v,
    ).toEqual([]);
  });

  it("names a field that no longer exists on the type generically", () => {
    version("v", 1, "Dune", {
      author: "Frank Herbert",
      read: "true",
      gone: "x",
    });
    expect(
      getVersionChanges(db, "dune", getCapsuleHistory(db, "dune")).v,
    ).toEqual([{ label: "A removed field", before: "x", after: null }]);
  });

  it("catches edits a readable value would hide: later lines, spacing", () => {
    upsertCapsuleValue(db, {
      id: "v-notes",
      capsuleId: "dune",
      fieldId: "notes",
      value: "Line one\nLine three",
      createdAt: 0,
      updatedAt: 0,
    });
    version("lines", 1, "Dune", {
      author: "Frank Herbert",
      read: "true",
      notes: "Line one\nLine two",
    });
    expect(
      getVersionChanges(db, "dune", getCapsuleHistory(db, "dune")).lines,
    ).toEqual([
      {
        label: "Notes",
        before: "Line one Line two",
        after: "Line one Line three",
      },
    ]);
  });

  it("still reports a spacing-only edit, with equal readable values", () => {
    version("space", 1, "Dune", { author: "Frank Herbert ", read: "true" });
    expect(
      getVersionChanges(db, "dune", getCapsuleHistory(db, "dune")).space,
    ).toEqual([
      { label: "Author", before: "Frank Herbert", after: "Frank Herbert" },
    ]);
  });

  it("pairs versions saved in the same millisecond in a stable order", () => {
    version("a", 5, "Dune (1)", { author: "Frank Herbert", read: "true" });
    version("b", 5, "Dune (2)", { author: "Frank Herbert", read: "true" });
    const history = getCapsuleHistory(db, "dune");
    expect(history.map((v) => v.id)).toEqual(["b", "a"]);
  });
});
