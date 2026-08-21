// Tests for step 6.9 — written before implementation (TDD)
import type { SQLiteDatabase } from "expo-sqlite";
import { openDb, runMigrations, _resetDbForTesting } from "@/shared/db";
import { getLinkById, getLinksFrom, linksMigration } from "@/entities/link";
import { linkCapsules, unlinkCapsules } from "../index";

let db: SQLiteDatabase;

beforeEach(() => {
  _resetDbForTesting();
  db = openDb();
  runMigrations(db, [linksMigration]);
});

describe("linkCapsules", () => {
  it("creates a link from one capsule to another", () => {
    const link = linkCapsules(db, "c-1", "c-2");
    expect(link.fromCapsuleId).toBe("c-1");
    expect(link.toCapsuleId).toBe("c-2");
    expect(getLinksFrom(db, "c-1").map((l) => l.id)).toEqual([link.id]);
  });

  it("stores a trimmed label when given", () => {
    const link = linkCapsules(db, "c-1", "c-2", "  related to  ");
    expect(link.label).toBe("related to");
  });

  it("stores null when no label is given", () => {
    const link = linkCapsules(db, "c-1", "c-2");
    expect(link.label).toBeNull();
  });

  it("treats a whitespace-only label as no label", () => {
    const link = linkCapsules(db, "c-1", "c-2", "   ");
    expect(link.label).toBeNull();
  });

  it("creating the same pair twice creates two distinct links, not a dedup — labels can differ", () => {
    const first = linkCapsules(db, "c-1", "c-2", "related to");
    const second = linkCapsules(db, "c-1", "c-2", "part of");
    expect(first.id).not.toBe(second.id);
    expect(getLinksFrom(db, "c-1")).toHaveLength(2);
  });
});

describe("unlinkCapsules", () => {
  it("removes one link by id without affecting others", () => {
    const a = linkCapsules(db, "c-1", "c-2");
    const b = linkCapsules(db, "c-1", "c-3");
    unlinkCapsules(db, a.id);
    expect(getLinkById(db, a.id)).toBeNull();
    expect(getLinkById(db, b.id)).not.toBeNull();
  });
});
