// Tests for step 6.1 — written before implementation (TDD)
import type { SQLiteDatabase } from "expo-sqlite";
import { openDb, runMigrations, _resetDbForTesting } from "@/shared/db";
import { capsuleTypesMigration } from "@/entities/capsule-type";
import {
  capsuleFieldsMigration,
  deleteCapsuleField,
  deleteFieldsByCapsuleType,
  getCapsuleFieldById,
  getFieldsByCapsuleType,
  insertCapsuleField,
  updateCapsuleField,
  type CapsuleField,
} from "../index";

const makeField = (overrides: Partial<CapsuleField> = {}): CapsuleField => ({
  id: `f-${Math.random().toString(36).slice(2)}`,
  capsuleTypeId: "ct-1",
  name: "Title",
  fieldType: "text",
  config: null,
  sortOrder: 0,
  required: false,
  createdAt: 1000,
  updatedAt: 1000,
  ...overrides,
});

let db: SQLiteDatabase;

beforeEach(() => {
  _resetDbForTesting();
  db = openDb();
  runMigrations(db, [capsuleTypesMigration, capsuleFieldsMigration]);
});

describe("entities/field — happy path", () => {
  it("inserts and retrieves a field", () => {
    const field = makeField({ name: "Author", fieldType: "text" });
    insertCapsuleField(db, field);
    const found = getCapsuleFieldById(db, field.id);
    expect(found?.name).toBe("Author");
    expect(found?.fieldType).toBe("text");
  });

  it("getFieldsByCapsuleType orders by sortOrder ascending — display order, not recency", () => {
    insertCapsuleField(
      db,
      makeField({ id: "third", capsuleTypeId: "ct-1", sortOrder: 2 }),
    );
    insertCapsuleField(
      db,
      makeField({ id: "first", capsuleTypeId: "ct-1", sortOrder: 0 }),
    );
    insertCapsuleField(
      db,
      makeField({ id: "second", capsuleTypeId: "ct-1", sortOrder: 1 }),
    );
    expect(getFieldsByCapsuleType(db, "ct-1").map((f) => f.id)).toEqual([
      "first",
      "second",
      "third",
    ]);
  });

  it("getFieldsByCapsuleType only returns fields belonging to that capsule type", () => {
    insertCapsuleField(db, makeField({ id: "a", capsuleTypeId: "ct-1" }));
    insertCapsuleField(db, makeField({ id: "b", capsuleTypeId: "ct-2" }));
    expect(getFieldsByCapsuleType(db, "ct-1").map((f) => f.id)).toEqual(["a"]);
  });

  it("stores every field type correctly", () => {
    const types: CapsuleField["fieldType"][] = [
      "text",
      "long_text",
      "number",
      "boolean",
      "date",
      "single_select",
      "multi_select",
      "relation",
      "attachment",
    ];
    for (const fieldType of types) {
      const field = makeField({ id: `f-${fieldType}`, fieldType });
      insertCapsuleField(db, field);
      expect(getCapsuleFieldById(db, field.id)?.fieldType).toBe(fieldType);
    }
  });

  it("stores type-specific config as an opaque string, unparsed", () => {
    const config = JSON.stringify({ options: ["Fiction", "Non-fiction"] });
    const field = makeField({ fieldType: "single_select", config });
    insertCapsuleField(db, field);
    expect(getCapsuleFieldById(db, field.id)?.config).toBe(config);
  });

  it("stores the required flag correctly for both true and false", () => {
    const requiredField = makeField({ id: "req", required: true });
    const optionalField = makeField({ id: "opt", required: false });
    insertCapsuleField(db, requiredField);
    insertCapsuleField(db, optionalField);
    expect(getCapsuleFieldById(db, "req")?.required).toBe(true);
    expect(getCapsuleFieldById(db, "opt")?.required).toBe(false);
  });

  it("updates name, fieldType, config, sortOrder, and required", () => {
    const field = makeField();
    insertCapsuleField(db, field);
    updateCapsuleField(db, field.id, {
      name: "Renamed",
      fieldType: "number",
      config: '{"min":0}',
      sortOrder: 5,
      required: true,
      updatedAt: 2000,
    });
    const found = getCapsuleFieldById(db, field.id);
    expect(found?.name).toBe("Renamed");
    expect(found?.fieldType).toBe("number");
    expect(found?.config).toBe('{"min":0}');
    expect(found?.sortOrder).toBe(5);
    expect(found?.required).toBe(true);
    expect(found?.updatedAt).toBe(2000);
  });

  it("deletes a field", () => {
    const field = makeField();
    insertCapsuleField(db, field);
    deleteCapsuleField(db, field.id);
    expect(getCapsuleFieldById(db, field.id)).toBeNull();
  });

  it("deleteFieldsByCapsuleType removes every field for that type, leaving other types' fields intact", () => {
    insertCapsuleField(db, makeField({ id: "a", capsuleTypeId: "ct-1" }));
    insertCapsuleField(db, makeField({ id: "b", capsuleTypeId: "ct-1" }));
    insertCapsuleField(db, makeField({ id: "c", capsuleTypeId: "ct-2" }));

    deleteFieldsByCapsuleType(db, "ct-1");

    expect(getFieldsByCapsuleType(db, "ct-1")).toEqual([]);
    expect(getFieldsByCapsuleType(db, "ct-2").map((f) => f.id)).toEqual(["c"]);
  });
});

describe("entities/field — edge cases", () => {
  it("getCapsuleFieldById returns null for an unknown id", () => {
    expect(getCapsuleFieldById(db, "nope")).toBeNull();
  });

  it("getFieldsByCapsuleType returns an empty array when none exist", () => {
    expect(getFieldsByCapsuleType(db, "ct-1")).toEqual([]);
  });

  it("stores a null config — config is optional", () => {
    const field = makeField({ fieldType: "boolean", config: null });
    insertCapsuleField(db, field);
    expect(getCapsuleFieldById(db, field.id)?.config).toBeNull();
  });

  it("updateCapsuleField can set config back to null", () => {
    const field = makeField({ config: '{"a":1}' });
    insertCapsuleField(db, field);
    updateCapsuleField(db, field.id, { config: null });
    expect(getCapsuleFieldById(db, field.id)?.config).toBeNull();
  });

  it("updateCapsuleField with an empty patch leaves the record unchanged", () => {
    const field = makeField();
    insertCapsuleField(db, field);
    expect(() => updateCapsuleField(db, field.id, {})).not.toThrow();
    expect(getCapsuleFieldById(db, field.id)?.name).toBe(field.name);
  });

  it("deleting an unknown id does not throw", () => {
    expect(() => deleteCapsuleField(db, "missing")).not.toThrow();
  });

  it("no FK constraint enforced at the DB level — a field can reference a capsule type that doesn't exist yet, matching this app's graceful-degradation convention", () => {
    expect(() =>
      insertCapsuleField(db, makeField({ capsuleTypeId: "nonexistent" })),
    ).not.toThrow();
  });
});

describe("entities/field — error handling", () => {
  it("throws on duplicate id insert", () => {
    insertCapsuleField(db, makeField({ id: "dup" }));
    expect(() => insertCapsuleField(db, makeField({ id: "dup" }))).toThrow();
  });
});
