// Tests for step 6.9 — written before implementation (TDD)
// Extended for 6.8 (relation field type): linkCapsules now takes an
// options object ({ fieldId, label }) instead of a positional label, to
// make room for fieldId without an ambiguous third/fourth positional arg.
import type { SQLiteDatabase } from "expo-sqlite";
import {
  capsuleLinksFieldIdMigration,
  getLinkById,
  getLinksFrom,
  getLinksFromByField,
  linksMigration,
} from "@/entities/link";
import { openDb, runMigrations, _resetDbForTesting } from "@/shared/db";
import { linkCapsules, unlinkCapsules } from "../index";

let db: SQLiteDatabase;

beforeEach(() => {
  _resetDbForTesting();
  db = openDb();
  runMigrations(db, [linksMigration, capsuleLinksFieldIdMigration]);
});

describe("linkCapsules", () => {
  it("creates a link from one capsule to another", () => {
    const link = linkCapsules(db, "c-1", "c-2");
    expect(link.fromCapsuleId).toBe("c-1");
    expect(link.toCapsuleId).toBe("c-2");
    expect(getLinksFrom(db, "c-1").map((l) => l.id)).toEqual([link.id]);
  });

  it("stores a trimmed label when given", () => {
    const link = linkCapsules(db, "c-1", "c-2", { label: "  related to  " });
    expect(link.label).toBe("related to");
  });

  it("stores null when no label is given", () => {
    const link = linkCapsules(db, "c-1", "c-2");
    expect(link.label).toBeNull();
  });

  it("treats a whitespace-only label as no label", () => {
    const link = linkCapsules(db, "c-1", "c-2", { label: "   " });
    expect(link.label).toBeNull();
  });

  it("creating the same pair twice creates two distinct links, not a dedup — labels can differ", () => {
    const first = linkCapsules(db, "c-1", "c-2", { label: "related to" });
    const second = linkCapsules(db, "c-1", "c-2", { label: "part of" });
    expect(first.id).not.toBe(second.id);
    expect(getLinksFrom(db, "c-1")).toHaveLength(2);
  });

  it("stores null fieldId when none is given — a generic, not-field-backed link", () => {
    const link = linkCapsules(db, "c-1", "c-2");
    expect(link.fieldId).toBeNull();
  });

  it("stores the given fieldId, and getLinksFromByField finds it", () => {
    const link = linkCapsules(db, "c-1", "c-2", { fieldId: "f-author" });
    expect(link.fieldId).toBe("f-author");
    expect(getLinksFromByField(db, "c-1", "f-author").map((l) => l.id)).toEqual(
      [link.id],
    );
  });

  it("links from two different relation fields on the same capsule stay independently scoped", () => {
    const author = linkCapsules(db, "c-1", "c-person", { fieldId: "f-author" });
    const related = linkCapsules(db, "c-1", "c-book", {
      fieldId: "f-related-books",
    });
    expect(getLinksFromByField(db, "c-1", "f-author").map((l) => l.id)).toEqual(
      [author.id],
    );
    expect(
      getLinksFromByField(db, "c-1", "f-related-books").map((l) => l.id),
    ).toEqual([related.id]);
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
