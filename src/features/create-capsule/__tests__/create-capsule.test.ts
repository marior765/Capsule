// Tests for step 6.4 — written before implementation (TDD)
import type { SQLiteDatabase } from "expo-sqlite";
import { openDb, runMigrations, _resetDbForTesting } from "@/shared/db";
import {
  capsulesMigration,
  capsuleValuesMigration,
  getValuesByCapsule,
} from "@/entities/capsule";
import { createCapsule } from "../index";

let db: SQLiteDatabase;

beforeEach(() => {
  _resetDbForTesting();
  db = openDb();
  runMigrations(db, [capsulesMigration, capsuleValuesMigration]);
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
});
