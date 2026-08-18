// Tests for step 6.1 — written before implementation (TDD)
import type { SQLiteDatabase } from "expo-sqlite";
import { openDb, runMigrations, _resetDbForTesting } from "@/shared/db";
import {
  capsuleTypesMigration,
  deleteCapsuleType,
  getAllCapsuleTypes,
  getCapsuleTypeById,
  insertCapsuleType,
  updateCapsuleType,
  type CapsuleType,
} from "../index";

const makeCapsuleType = (
  overrides: Partial<CapsuleType> = {},
): CapsuleType => ({
  id: `ct-${Math.random().toString(36).slice(2)}`,
  name: "Book",
  description: "Track books I'm reading",
  createdAt: 1000,
  updatedAt: 1000,
  ...overrides,
});

let db: SQLiteDatabase;

beforeEach(() => {
  _resetDbForTesting();
  db = openDb();
  runMigrations(db, [capsuleTypesMigration]);
});

describe("entities/capsule-type — happy path", () => {
  it("inserts and retrieves a capsule type", () => {
    const capsuleType = makeCapsuleType();
    insertCapsuleType(db, capsuleType);
    const found = getCapsuleTypeById(db, capsuleType.id);
    expect(found?.id).toBe(capsuleType.id);
    expect(found?.name).toBe("Book");
    expect(found?.description).toBe("Track books I'm reading");
  });

  it("getAllCapsuleTypes orders by updatedAt descending", () => {
    insertCapsuleType(db, makeCapsuleType({ id: "old", updatedAt: 100 }));
    insertCapsuleType(db, makeCapsuleType({ id: "new", updatedAt: 300 }));
    insertCapsuleType(db, makeCapsuleType({ id: "mid", updatedAt: 200 }));
    expect(getAllCapsuleTypes(db).map((c) => c.id)).toEqual([
      "new",
      "mid",
      "old",
    ]);
  });

  it("updates name and description", () => {
    const capsuleType = makeCapsuleType();
    insertCapsuleType(db, capsuleType);
    updateCapsuleType(db, capsuleType.id, {
      name: "Movie",
      description: "Track movies I've watched",
      updatedAt: 2000,
    });
    const found = getCapsuleTypeById(db, capsuleType.id);
    expect(found?.name).toBe("Movie");
    expect(found?.description).toBe("Track movies I've watched");
    expect(found?.updatedAt).toBe(2000);
  });

  it("deletes a capsule type", () => {
    const capsuleType = makeCapsuleType();
    insertCapsuleType(db, capsuleType);
    deleteCapsuleType(db, capsuleType.id);
    expect(getCapsuleTypeById(db, capsuleType.id)).toBeNull();
  });
});

describe("entities/capsule-type — edge cases", () => {
  it("getCapsuleTypeById returns null for an unknown id", () => {
    expect(getCapsuleTypeById(db, "nope")).toBeNull();
  });

  it("getAllCapsuleTypes returns an empty array when none exist", () => {
    expect(getAllCapsuleTypes(db)).toEqual([]);
  });

  it("stores a null description — description is optional", () => {
    const capsuleType = makeCapsuleType({ description: null });
    insertCapsuleType(db, capsuleType);
    expect(getCapsuleTypeById(db, capsuleType.id)?.description).toBeNull();
  });

  it("updateCapsuleType with an empty patch leaves the record unchanged", () => {
    const capsuleType = makeCapsuleType();
    insertCapsuleType(db, capsuleType);
    expect(() => updateCapsuleType(db, capsuleType.id, {})).not.toThrow();
    expect(getCapsuleTypeById(db, capsuleType.id)?.name).toBe(capsuleType.name);
  });

  it("updateCapsuleType can set description back to null", () => {
    const capsuleType = makeCapsuleType({ description: "Has one" });
    insertCapsuleType(db, capsuleType);
    updateCapsuleType(db, capsuleType.id, { description: null });
    expect(getCapsuleTypeById(db, capsuleType.id)?.description).toBeNull();
  });

  it("deleting an unknown id does not throw", () => {
    expect(() => deleteCapsuleType(db, "missing")).not.toThrow();
  });
});

describe("entities/capsule-type — error handling", () => {
  it("throws on duplicate id insert", () => {
    insertCapsuleType(db, makeCapsuleType({ id: "dup" }));
    expect(() =>
      insertCapsuleType(db, makeCapsuleType({ id: "dup" })),
    ).toThrow();
  });
});
