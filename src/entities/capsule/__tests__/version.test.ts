// Tests for step 8.5 "version history" — written before implementation (TDD)
import type { SQLiteDatabase } from "expo-sqlite";
import { openDb, runMigrations, _resetDbForTesting } from "@/shared/db";
import {
  capsuleVersionsMigration,
  deleteVersionsByCapsule,
  getVersionById,
  getVersionsByCapsule,
  insertCapsuleVersion,
  type CapsuleVersion,
} from "../index";

const makeVersion = (
  overrides: Partial<CapsuleVersion> = {},
): CapsuleVersion => ({
  id: `v-${Math.random().toString(36).slice(2)}`,
  capsuleId: "c-1",
  title: "Dune",
  values: { "f-author": "Frank Herbert" },
  createdAt: 1000,
  ...overrides,
});

let db: SQLiteDatabase;

beforeEach(() => {
  _resetDbForTesting();
  db = openDb();
  runMigrations(db, [capsuleVersionsMigration]);
});

describe("entities/capsule — CapsuleVersion CRUD", () => {
  it("inserts and retrieves a version by id", () => {
    const version = makeVersion({ id: "v1" });
    insertCapsuleVersion(db, version);
    const found = getVersionById(db, "v1");
    expect(found?.title).toBe("Dune");
    expect(found?.values).toEqual({ "f-author": "Frank Herbert" });
  });

  it("getVersionById returns null for an unknown id", () => {
    expect(getVersionById(db, "missing")).toBeNull();
  });

  it("round-trips a values snapshot losslessly, including null and multiple fields", () => {
    const values = { "f-author": "Frank Herbert", "f-year": null, "f-x": "" };
    insertCapsuleVersion(db, makeVersion({ id: "v1", values }));
    expect(getVersionById(db, "v1")?.values).toEqual(values);
  });

  it("getVersionsByCapsule orders by createdAt descending", () => {
    insertCapsuleVersion(
      db,
      makeVersion({ id: "old", capsuleId: "c-1", createdAt: 100 }),
    );
    insertCapsuleVersion(
      db,
      makeVersion({ id: "new", capsuleId: "c-1", createdAt: 300 }),
    );
    insertCapsuleVersion(
      db,
      makeVersion({ id: "mid", capsuleId: "c-1", createdAt: 200 }),
    );
    expect(getVersionsByCapsule(db, "c-1").map((v) => v.id)).toEqual([
      "new",
      "mid",
      "old",
    ]);
  });

  it("getVersionsByCapsule only returns versions for that capsule", () => {
    insertCapsuleVersion(db, makeVersion({ id: "a", capsuleId: "c-1" }));
    insertCapsuleVersion(db, makeVersion({ id: "b", capsuleId: "c-2" }));
    expect(getVersionsByCapsule(db, "c-1").map((v) => v.id)).toEqual(["a"]);
  });

  it("getVersionsByCapsule returns an empty array when none exist", () => {
    expect(getVersionsByCapsule(db, "c-1")).toEqual([]);
  });

  it("deleteVersionsByCapsule removes every version for that capsule, leaving other capsules' versions intact", () => {
    insertCapsuleVersion(db, makeVersion({ id: "a", capsuleId: "c-1" }));
    insertCapsuleVersion(db, makeVersion({ id: "b", capsuleId: "c-1" }));
    insertCapsuleVersion(db, makeVersion({ id: "c", capsuleId: "c-2" }));

    deleteVersionsByCapsule(db, "c-1");

    expect(getVersionsByCapsule(db, "c-1")).toEqual([]);
    expect(getVersionsByCapsule(db, "c-2")).toHaveLength(1);
  });

  it("deleteVersionsByCapsule for a capsule with no versions does not throw", () => {
    expect(() => deleteVersionsByCapsule(db, "no-versions")).not.toThrow();
  });

  it("no FK constraint — a version can reference a capsule id that no longer exists", () => {
    expect(() =>
      insertCapsuleVersion(db, makeVersion({ capsuleId: "gone" })),
    ).not.toThrow();
  });
});
