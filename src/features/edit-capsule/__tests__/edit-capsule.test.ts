// Tests for step 6.4 — written before implementation (TDD)
import type { SQLiteDatabase } from "expo-sqlite";
import { openDb, runMigrations, _resetDbForTesting } from "@/shared/db";
import {
  capsulesMigration,
  capsuleValuesMigration,
  getCapsuleById,
  getValueByCapsuleAndField,
} from "@/entities/capsule";
import { createCapsule } from "@/features/create-capsule";
import { renameCapsule, setCapsuleFieldValue } from "../index";

let db: SQLiteDatabase;

beforeEach(() => {
  _resetDbForTesting();
  db = openDb();
  runMigrations(db, [capsulesMigration, capsuleValuesMigration]);
});

describe("renameCapsule", () => {
  it("updates the capsule's title", () => {
    const capsule = createCapsule(db, { capsuleTypeId: "ct-1", title: "Dune" });
    renameCapsule(db, capsule.id, "Dune Messiah");
    expect(getCapsuleById(db, capsule.id)?.title).toBe("Dune Messiah");
  });

  it("bumps updatedAt", () => {
    const capsule = createCapsule(db, { capsuleTypeId: "ct-1" });
    const before = getCapsuleById(db, capsule.id)!.updatedAt;
    renameCapsule(db, capsule.id, "New title");
    expect(getCapsuleById(db, capsule.id)!.updatedAt).toBeGreaterThanOrEqual(
      before,
    );
  });

  it("renaming an unknown capsule does not throw", () => {
    expect(() => renameCapsule(db, "missing", "x")).not.toThrow();
  });
});

describe("setCapsuleFieldValue", () => {
  it("sets a field's value on the capsule", () => {
    const capsule = createCapsule(db, { capsuleTypeId: "ct-1" });
    setCapsuleFieldValue(db, capsule.id, "f-author", "Frank Herbert");
    expect(getValueByCapsuleAndField(db, capsule.id, "f-author")?.value).toBe(
      "Frank Herbert",
    );
  });

  it("updates an existing value in place rather than creating a duplicate", () => {
    const capsule = createCapsule(db, {
      capsuleTypeId: "ct-1",
      values: { "f-author": "first" },
    });
    setCapsuleFieldValue(db, capsule.id, "f-author", "second");
    expect(getValueByCapsuleAndField(db, capsule.id, "f-author")?.value).toBe(
      "second",
    );
  });

  it("also bumps the capsule's own updatedAt — editing a value counts as editing the capsule", () => {
    const capsule = createCapsule(db, { capsuleTypeId: "ct-1" });
    const before = getCapsuleById(db, capsule.id)!.updatedAt;
    setCapsuleFieldValue(db, capsule.id, "f-author", "Frank Herbert");
    expect(getCapsuleById(db, capsule.id)!.updatedAt).toBeGreaterThanOrEqual(
      before,
    );
  });

  it("can set a value back to null", () => {
    const capsule = createCapsule(db, {
      capsuleTypeId: "ct-1",
      values: { "f-notes": "something" },
    });
    setCapsuleFieldValue(db, capsule.id, "f-notes", null);
    expect(
      getValueByCapsuleAndField(db, capsule.id, "f-notes")?.value,
    ).toBeNull();
  });
});
