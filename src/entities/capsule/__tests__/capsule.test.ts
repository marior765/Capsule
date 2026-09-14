// Tests for step 6.1 — written before implementation (TDD)
import type { SQLiteDatabase } from "expo-sqlite";
import { openDb, runMigrations, _resetDbForTesting } from "@/shared/db";
import {
  capsuleParentIdMigration,
  capsulesMigration,
  capsuleValuesMigration,
  deleteCapsule,
  deleteValuesByCapsule,
  getAllCapsules,
  getCapsuleById,
  getCapsulesByType,
  getChildCapsules,
  getValueByCapsuleAndField,
  getValuesByCapsule,
  getValuesByField,
  insertCapsule,
  orphanChildCapsules,
  updateCapsule,
  upsertCapsuleValue,
  type Capsule,
  type CapsuleValue,
} from "../index";

const makeCapsule = (overrides: Partial<Capsule> = {}): Capsule => ({
  id: `c-${Math.random().toString(36).slice(2)}`,
  capsuleTypeId: "ct-1",
  title: "Dune",
  parentCapsuleId: null,
  createdAt: 1000,
  updatedAt: 1000,
  ...overrides,
});

const makeValue = (overrides: Partial<CapsuleValue> = {}): CapsuleValue => ({
  id: `cv-${Math.random().toString(36).slice(2)}`,
  capsuleId: "c-1",
  fieldId: "f-1",
  value: "Frank Herbert",
  createdAt: 1000,
  updatedAt: 1000,
  ...overrides,
});

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

describe("entities/capsule — Capsule CRUD happy path", () => {
  it("inserts and retrieves a capsule", () => {
    const capsule = makeCapsule({ title: "Dune" });
    insertCapsule(db, capsule);
    const found = getCapsuleById(db, capsule.id);
    expect(found?.title).toBe("Dune");
    expect(found?.capsuleTypeId).toBe("ct-1");
  });

  it("getAllCapsules orders by updatedAt descending", () => {
    insertCapsule(db, makeCapsule({ id: "old", updatedAt: 100 }));
    insertCapsule(db, makeCapsule({ id: "new", updatedAt: 300 }));
    insertCapsule(db, makeCapsule({ id: "mid", updatedAt: 200 }));
    expect(getAllCapsules(db).map((c) => c.id)).toEqual(["new", "mid", "old"]);
  });

  it("getCapsulesByType only returns capsules of that type", () => {
    insertCapsule(db, makeCapsule({ id: "a", capsuleTypeId: "ct-1" }));
    insertCapsule(db, makeCapsule({ id: "b", capsuleTypeId: "ct-2" }));
    expect(getCapsulesByType(db, "ct-1").map((c) => c.id)).toEqual(["a"]);
  });

  it("updates title", () => {
    const capsule = makeCapsule();
    insertCapsule(db, capsule);
    updateCapsule(db, capsule.id, { title: "Dune Messiah", updatedAt: 2000 });
    const found = getCapsuleById(db, capsule.id);
    expect(found?.title).toBe("Dune Messiah");
    expect(found?.updatedAt).toBe(2000);
  });

  it("deletes a capsule", () => {
    const capsule = makeCapsule();
    insertCapsule(db, capsule);
    deleteCapsule(db, capsule.id);
    expect(getCapsuleById(db, capsule.id)).toBeNull();
  });
});

describe("entities/capsule — nesting (8.5)", () => {
  it("inserts and retrieves a capsule with a parent", () => {
    const parent = makeCapsule({ id: "parent" });
    const child = makeCapsule({ id: "child", parentCapsuleId: "parent" });
    insertCapsule(db, parent);
    insertCapsule(db, child);
    expect(getCapsuleById(db, "child")?.parentCapsuleId).toBe("parent");
  });

  it("defaults to a root capsule (null parent) when none is given", () => {
    insertCapsule(db, makeCapsule({ id: "root" }));
    expect(getCapsuleById(db, "root")?.parentCapsuleId).toBeNull();
  });

  it("getChildCapsules returns only capsules whose parent is the given id", () => {
    insertCapsule(db, makeCapsule({ id: "parent" }));
    insertCapsule(db, makeCapsule({ id: "other-root" }));
    insertCapsule(
      db,
      makeCapsule({ id: "child-a", parentCapsuleId: "parent" }),
    );
    insertCapsule(
      db,
      makeCapsule({ id: "child-b", parentCapsuleId: "parent" }),
    );

    expect(
      getChildCapsules(db, "parent")
        .map((c) => c.id)
        .sort(),
    ).toEqual(["child-a", "child-b"]);
  });

  it("getChildCapsules returns an empty array for a capsule with no children", () => {
    insertCapsule(db, makeCapsule({ id: "childless" }));
    expect(getChildCapsules(db, "childless")).toEqual([]);
  });

  it("updateCapsule can reparent a capsule", () => {
    insertCapsule(db, makeCapsule({ id: "a" }));
    insertCapsule(db, makeCapsule({ id: "b" }));
    updateCapsule(db, "b", { parentCapsuleId: "a" });
    expect(getCapsuleById(db, "b")?.parentCapsuleId).toBe("a");
  });

  it("updateCapsule can clear a parent, promoting a capsule back to root", () => {
    insertCapsule(db, makeCapsule({ id: "a" }));
    insertCapsule(db, makeCapsule({ id: "b", parentCapsuleId: "a" }));
    updateCapsule(db, "b", { parentCapsuleId: null });
    expect(getCapsuleById(db, "b")?.parentCapsuleId).toBeNull();
  });

  it("orphanChildCapsules clears parentCapsuleId on every direct child, promoting them to root", () => {
    insertCapsule(db, makeCapsule({ id: "parent" }));
    insertCapsule(
      db,
      makeCapsule({ id: "child-a", parentCapsuleId: "parent" }),
    );
    insertCapsule(
      db,
      makeCapsule({ id: "child-b", parentCapsuleId: "parent" }),
    );

    orphanChildCapsules(db, "parent");

    expect(getCapsuleById(db, "child-a")?.parentCapsuleId).toBeNull();
    expect(getCapsuleById(db, "child-b")?.parentCapsuleId).toBeNull();
  });

  it("orphanChildCapsules leaves unrelated capsules' parent untouched", () => {
    insertCapsule(db, makeCapsule({ id: "parent" }));
    insertCapsule(db, makeCapsule({ id: "other-parent" }));
    insertCapsule(
      db,
      makeCapsule({ id: "child", parentCapsuleId: "other-parent" }),
    );

    orphanChildCapsules(db, "parent");

    expect(getCapsuleById(db, "child")?.parentCapsuleId).toBe("other-parent");
  });

  it("orphanChildCapsules for a capsule with no children does not throw", () => {
    expect(() => orphanChildCapsules(db, "childless")).not.toThrow();
  });
});

describe("entities/capsule — Capsule CRUD edge cases", () => {
  it("getCapsuleById returns null for an unknown id", () => {
    expect(getCapsuleById(db, "nope")).toBeNull();
  });

  it("getAllCapsules returns an empty array when none exist", () => {
    expect(getAllCapsules(db)).toEqual([]);
  });

  it("updateCapsule with an empty patch leaves the record unchanged", () => {
    const capsule = makeCapsule();
    insertCapsule(db, capsule);
    expect(() => updateCapsule(db, capsule.id, {})).not.toThrow();
    expect(getCapsuleById(db, capsule.id)?.title).toBe(capsule.title);
  });

  it("deleting an unknown id does not throw", () => {
    expect(() => deleteCapsule(db, "missing")).not.toThrow();
  });

  it("no FK constraint — a capsule can reference a capsule type that doesn't exist yet", () => {
    expect(() =>
      insertCapsule(db, makeCapsule({ capsuleTypeId: "nonexistent" })),
    ).not.toThrow();
  });
});

describe("entities/capsule — Capsule error handling", () => {
  it("throws on duplicate id insert", () => {
    insertCapsule(db, makeCapsule({ id: "dup" }));
    expect(() => insertCapsule(db, makeCapsule({ id: "dup" }))).toThrow();
  });
});

describe("entities/capsule — CapsuleValue, upsert semantics", () => {
  it("upsertCapsuleValue inserts a new value when none exists for that field", () => {
    const value = makeValue({ capsuleId: "c-1", fieldId: "f-1", value: "42" });
    upsertCapsuleValue(db, value);
    expect(getValueByCapsuleAndField(db, "c-1", "f-1")?.value).toBe("42");
  });

  it("upsertCapsuleValue updates the existing value in place — no duplicate row for the same capsule+field", () => {
    upsertCapsuleValue(
      db,
      makeValue({ id: "v1", capsuleId: "c-1", fieldId: "f-1", value: "first" }),
    );
    upsertCapsuleValue(
      db,
      makeValue({
        id: "v2",
        capsuleId: "c-1",
        fieldId: "f-1",
        value: "second",
        updatedAt: 2000,
      }),
    );

    expect(getValueByCapsuleAndField(db, "c-1", "f-1")?.value).toBe("second");
    expect(getValuesByCapsule(db, "c-1")).toHaveLength(1);
  });

  it("upsert preserves the original row's id and createdAt — an update does not change the row's own identity", () => {
    upsertCapsuleValue(
      db,
      makeValue({
        id: "v1",
        capsuleId: "c-1",
        fieldId: "f-1",
        value: "first",
        createdAt: 500,
      }),
    );
    upsertCapsuleValue(
      db,
      makeValue({
        id: "v2",
        capsuleId: "c-1",
        fieldId: "f-1",
        value: "second",
        createdAt: 999,
        updatedAt: 2000,
      }),
    );

    const found = getValueByCapsuleAndField(db, "c-1", "f-1");
    expect(found?.id).toBe("v1");
    expect(found?.createdAt).toBe(500);
    expect(found?.updatedAt).toBe(2000);
  });

  it("different fields on the same capsule get independent value rows", () => {
    upsertCapsuleValue(
      db,
      makeValue({ capsuleId: "c-1", fieldId: "f-1", value: "A" }),
    );
    upsertCapsuleValue(
      db,
      makeValue({ capsuleId: "c-1", fieldId: "f-2", value: "B" }),
    );
    expect(getValuesByCapsule(db, "c-1")).toHaveLength(2);
  });

  it("the same field on different capsules gets independent value rows", () => {
    upsertCapsuleValue(
      db,
      makeValue({ capsuleId: "c-1", fieldId: "f-1", value: "A" }),
    );
    upsertCapsuleValue(
      db,
      makeValue({ capsuleId: "c-2", fieldId: "f-1", value: "B" }),
    );
    expect(getValueByCapsuleAndField(db, "c-1", "f-1")?.value).toBe("A");
    expect(getValueByCapsuleAndField(db, "c-2", "f-1")?.value).toBe("B");
  });

  it("stores a null value — a field can be explicitly unset while still having a row", () => {
    upsertCapsuleValue(
      db,
      makeValue({ capsuleId: "c-1", fieldId: "f-1", value: null }),
    );
    expect(getValueByCapsuleAndField(db, "c-1", "f-1")?.value).toBeNull();
  });
});

describe("entities/capsule — CapsuleValue reads and cleanup", () => {
  it("getValueByCapsuleAndField returns null when no value has been set", () => {
    expect(getValueByCapsuleAndField(db, "c-1", "f-1")).toBeNull();
  });

  it("getValuesByCapsule returns an empty array when none exist", () => {
    expect(getValuesByCapsule(db, "c-1")).toEqual([]);
  });

  it("deleteValuesByCapsule removes every value for that capsule, leaving other capsules' values intact", () => {
    upsertCapsuleValue(db, makeValue({ capsuleId: "c-1", fieldId: "f-1" }));
    upsertCapsuleValue(db, makeValue({ capsuleId: "c-1", fieldId: "f-2" }));
    upsertCapsuleValue(db, makeValue({ capsuleId: "c-2", fieldId: "f-1" }));

    deleteValuesByCapsule(db, "c-1");

    expect(getValuesByCapsule(db, "c-1")).toEqual([]);
    expect(getValuesByCapsule(db, "c-2")).toHaveLength(1);
  });

  it("deleteValuesByCapsule for a capsule with no values does not throw", () => {
    expect(() => deleteValuesByCapsule(db, "no-values")).not.toThrow();
  });

  it("getValuesByField returns every value set for that field, across every capsule (8.7)", () => {
    upsertCapsuleValue(
      db,
      makeValue({ capsuleId: "c-1", fieldId: "f-status" }),
    );
    upsertCapsuleValue(
      db,
      makeValue({ capsuleId: "c-2", fieldId: "f-status" }),
    );
    upsertCapsuleValue(db, makeValue({ capsuleId: "c-1", fieldId: "f-other" }));

    expect(
      getValuesByField(db, "f-status")
        .map((v) => v.capsuleId)
        .sort(),
    ).toEqual(["c-1", "c-2"]);
  });

  it("getValuesByField returns an empty array when no capsule has a value for that field", () => {
    expect(getValuesByField(db, "f-status")).toEqual([]);
  });
});
