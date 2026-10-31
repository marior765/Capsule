// Tests for step 6.4 — written before implementation (TDD)
import type { SQLiteDatabase } from "expo-sqlite";
import { openDb, runMigrations, _resetDbForTesting } from "@/shared/db";
import {
  capsuleParentIdMigration,
  capsulesMigration,
  capsuleValuesMigration,
  getValuesByCapsule,
} from "@/entities/capsule";
import { createCapsule } from "../index";

let db: SQLiteDatabase;

beforeEach(() => {
  _resetDbForTesting();
  db = openDb();
  runMigrations(db, [
    capsulesMigration,
    capsuleValuesMigration,
    capsuleParentIdMigration,
  ]);
});

describe("createCapsule — happy path", () => {
  it("creates a capsule with the given title and type", () => {
    const capsule = createCapsule(db, {
      capsuleTypeId: "ct-1",
      title: "Dune",
    });
    expect(capsule.title).toBe("Dune");
    expect(capsule.capsuleTypeId).toBe("ct-1");
    expect(capsule.id).toBeTruthy();
  });

  it("defaults to an 'Untitled' title when none is given", () => {
    const capsule = createCapsule(db, { capsuleTypeId: "ct-1" });
    expect(capsule.title).toBe("Untitled");
  });

  it("sets createdAt and updatedAt to the same fresh timestamp", () => {
    const before = Date.now();
    const capsule = createCapsule(db, { capsuleTypeId: "ct-1" });
    expect(capsule.createdAt).toBeGreaterThanOrEqual(before);
    expect(capsule.createdAt).toBe(capsule.updatedAt);
  });

  it("creates initial field values alongside the capsule", () => {
    const capsule = createCapsule(db, {
      capsuleTypeId: "ct-1",
      values: { "f-author": "Frank Herbert", "f-year": "1965" },
    });
    const values = getValuesByCapsule(db, capsule.id);
    expect(values).toHaveLength(2);
    expect(values.find((v) => v.fieldId === "f-author")?.value).toBe(
      "Frank Herbert",
    );
    expect(values.find((v) => v.fieldId === "f-year")?.value).toBe("1965");
  });
});

describe("createCapsule — edge cases", () => {
  it("creates a capsule with no values when none are given", () => {
    const capsule = createCapsule(db, { capsuleTypeId: "ct-1" });
    expect(getValuesByCapsule(db, capsule.id)).toEqual([]);
  });

  it("stores an explicitly null value the same as any other value", () => {
    const capsule = createCapsule(db, {
      capsuleTypeId: "ct-1",
      values: { "f-notes": null },
    });
    const values = getValuesByCapsule(db, capsule.id);
    expect(values).toHaveLength(1);
    expect(values[0].value).toBeNull();
  });

  it("creating two capsules produces two distinct ids", () => {
    const a = createCapsule(db, { capsuleTypeId: "ct-1" });
    const b = createCapsule(db, { capsuleTypeId: "ct-1" });
    expect(a.id).not.toBe(b.id);
  });

  it("defaults to a root capsule (null parent) when none is given", () => {
    const capsule = createCapsule(db, { capsuleTypeId: "ct-1" });
    expect(capsule.parentCapsuleId).toBeNull();
  });

  it("creates a nested capsule when a parentCapsuleId is given (8.5)", () => {
    const parent = createCapsule(db, { capsuleTypeId: "ct-1", title: "Book" });
    const child = createCapsule(db, {
      capsuleTypeId: "ct-1",
      title: "Chapter 1",
      parentCapsuleId: parent.id,
    });
    expect(child.parentCapsuleId).toBe(parent.id);
  });
});

// Tests for step 10.43 — written before implementation (TDD)
//
// Quick capture used to create a capsule with the whole text as its title.
// captureQuickCapsule reads the type's fields, fills the ones a simple
// pattern names ("Dune by Frank Herbert (1965)"), and creates the capsule.
describe("captureQuickCapsule (10.43)", () => {
  const { captureQuickCapsule } =
    jest.requireActual<typeof import("../index")>("../index");
  const { capsuleFieldsMigration, insertCapsuleField } =
    jest.requireActual<typeof import("@/entities/field")>("@/entities/field");

  const addField = (
    id: string,
    capsuleTypeId: string,
    name: string,
    fieldType: "text" | "number",
  ) =>
    insertCapsuleField(db, {
      id,
      capsuleTypeId,
      name,
      fieldType,
      config: null,
      sortOrder: 0,
      required: false,
      createdAt: 0,
      updatedAt: 0,
    });

  beforeEach(() => {
    runMigrations(db, [capsuleFieldsMigration]);
    addField("f-author", "book", "Author", "text");
    addField("f-year", "book", "Year", "number");
    addField("f-other-author", "film", "Director", "text");
  });

  const valueMap = (capsuleId: string) =>
    Object.fromEntries(
      getValuesByCapsule(db, capsuleId).map((v) => [v.fieldId, v.value]),
    );

  it("creates the capsule with its title and the pattern's field values", () => {
    const capsule = captureQuickCapsule(db, {
      capsuleTypeId: "book",
      text: "Dune by Frank Herbert (1965)",
    });
    expect(capsule.title).toBe("Dune");
    expect(capsule.capsuleTypeId).toBe("book");
    expect(valueMap(capsule.id)).toEqual({
      "f-author": "Frank Herbert",
      "f-year": "1965",
    });
  });

  it("only uses the chosen type's own fields", () => {
    const capsule = captureQuickCapsule(db, {
      capsuleTypeId: "note",
      text: "Dune by Frank Herbert",
    });
    expect(capsule.title).toBe("Dune by Frank Herbert");
    expect(valueMap(capsule.id)).toEqual({});
  });

  it("keeps plain text as the title, with no values", () => {
    const capsule = captureQuickCapsule(db, {
      capsuleTypeId: "book",
      text: "  Buy milk ",
    });
    expect(capsule.title).toBe("Buy milk");
    expect(valueMap(capsule.id)).toEqual({});
  });
});
