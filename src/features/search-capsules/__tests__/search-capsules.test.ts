// Tests for step 6.5 — written before implementation (TDD)
import type { SQLiteDatabase } from "expo-sqlite";
import { openDb, runMigrations, _resetDbForTesting } from "@/shared/db";
import {
  capsuleParentIdMigration,
  capsulesMigration,
  capsuleValuesMigration,
} from "@/entities/capsule";
import { createCapsule } from "@/features/create-capsule";
import { searchCapsules } from "../index";

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

// Tests for step 10.56 — written before implementation (TDD)
//
// Tap-latency audit: every keystroke in the capsule search ran one
// synchronous query per capsule on the JS thread. The number of queries
// must not grow with the number of capsules.
describe("searchCapsules — query count (10.56)", () => {
  const countQueries = (n: number, query: string): number => {
    for (let i = 0; i < n; i++) {
      createCapsule(db, { capsuleTypeId: "ct-1", title: `Item ${n}-${i}` });
    }
    const spy = jest.spyOn(db, "getAllSync");
    try {
      searchCapsules(db, query);
      return spy.mock.calls.length;
    } finally {
      spy.mockRestore();
    }
  };

  it("runs a fixed number of queries, however many capsules there are", () => {
    const few = countQueries(2, "zzz");
    const many = countQueries(40, "zzz");
    expect(many).toBe(few);
    expect(many).toBeLessThanOrEqual(2);
  });

  // Case-insensitive matching stays in JS (SQLite's lower() only folds
  // ASCII), so non-Latin text keeps matching.
  it("still matches field values case-insensitively, beyond ASCII", () => {
    const c = createCapsule(db, {
      capsuleTypeId: "ct-1",
      title: "Untitled",
      values: { f1: "Тарас Шевченко" },
    });
    expect(searchCapsules(db, "шевченко").map((x) => x.id)).toEqual([c.id]);
  });
});
