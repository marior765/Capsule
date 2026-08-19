// Tests for step 6.5 — written before implementation (TDD)
import type { SQLiteDatabase } from "expo-sqlite";
import { openDb, runMigrations, _resetDbForTesting } from "@/shared/db";
import { capsulesMigration, capsuleValuesMigration } from "@/entities/capsule";
import { createCapsule } from "@/features/create-capsule";
import { searchCapsules } from "../index";

let db: SQLiteDatabase;

beforeEach(() => {
  _resetDbForTesting();
  db = openDb();
  runMigrations(db, [capsulesMigration, capsuleValuesMigration]);
});

describe("searchCapsules", () => {
  it("matches on title, case-insensitively", () => {
    createCapsule(db, { capsuleTypeId: "ct-1", title: "Dune Messiah" });
    createCapsule(db, { capsuleTypeId: "ct-1", title: "Foundation" });
    const results = searchCapsules(db, "dune");
    expect(results.map((c) => c.title)).toEqual(["Dune Messiah"]);
  });

  it("matches on a field value, case-insensitively", () => {
    createCapsule(db, {
      capsuleTypeId: "ct-1",
      title: "Book one",
      values: { "f-author": "Frank Herbert" },
    });
    createCapsule(db, {
      capsuleTypeId: "ct-1",
      title: "Book two",
      values: { "f-author": "Ursula K. Le Guin" },
    });
    const results = searchCapsules(db, "HERBERT");
    expect(results.map((c) => c.title)).toEqual(["Book one"]);
  });

  it("returns every capsule for an empty or whitespace-only query", () => {
    createCapsule(db, { capsuleTypeId: "ct-1", title: "Dune" });
    createCapsule(db, { capsuleTypeId: "ct-1", title: "Foundation" });
    expect(searchCapsules(db, "")).toHaveLength(2);
    expect(searchCapsules(db, "   ")).toHaveLength(2);
  });

  it("returns an empty array when nothing matches", () => {
    createCapsule(db, { capsuleTypeId: "ct-1", title: "Dune" });
    expect(searchCapsules(db, "nonexistent")).toEqual([]);
  });

  it("does not throw on a capsule with a null field value", () => {
    createCapsule(db, {
      capsuleTypeId: "ct-1",
      title: "Blank notes",
      values: { "f-notes": null },
    });
    expect(() => searchCapsules(db, "anything")).not.toThrow();
    expect(searchCapsules(db, "anything")).toEqual([]);
  });

  it("matches a capsule only once even if both title and a field value match", () => {
    createCapsule(db, {
      capsuleTypeId: "ct-1",
      title: "Dune",
      values: { "f-series": "Dune" },
    });
    expect(searchCapsules(db, "dune")).toHaveLength(1);
  });
});
