// Tests for step 6.9 — written before implementation (TDD)
import type { SQLiteDatabase } from "expo-sqlite";
import { openDb, runMigrations, _resetDbForTesting } from "@/shared/db";
import {
  capsuleLinksFieldIdMigration,
  deleteLink,
  deleteLinksByCapsule,
  getLinkById,
  getLinksFrom,
  getLinksFromByField,
  getLinksTo,
  insertLink,
  linksMigration,
  type CapsuleLink,
} from "../index";

const makeLink = (overrides: Partial<CapsuleLink> = {}): CapsuleLink => ({
  id: `link-${Math.random().toString(36).slice(2)}`,
  fromCapsuleId: "c-1",
  toCapsuleId: "c-2",
  fieldId: null,
  label: null,
  createdAt: 1000,
  ...overrides,
});

let db: SQLiteDatabase;

beforeEach(() => {
  _resetDbForTesting();
  db = openDb();
  runMigrations(db, [linksMigration, capsuleLinksFieldIdMigration]);
});

describe("entities/link — CRUD", () => {
  it("inserts and retrieves a link by id", () => {
    const link = makeLink({ label: "related to" });
    insertLink(db, link);
    const found = getLinkById(db, link.id);
    expect(found?.fromCapsuleId).toBe("c-1");
    expect(found?.toCapsuleId).toBe("c-2");
    expect(found?.label).toBe("related to");
  });

  it("getLinkById returns null for an unknown id", () => {
    expect(getLinkById(db, "missing")).toBeNull();
  });

  it("stores a null label as null, not the string 'null'", () => {
    const link = makeLink({ label: null });
    insertLink(db, link);
    expect(getLinkById(db, link.id)?.label).toBeNull();
  });

  it("deleteLink removes the link record", () => {
    const link = makeLink();
    insertLink(db, link);
    deleteLink(db, link.id);
    expect(getLinkById(db, link.id)).toBeNull();
  });

  it("deleting an unknown link id does not throw", () => {
    expect(() => deleteLink(db, "missing")).not.toThrow();
  });

  it("stores a null fieldId as null (a generic, not-field-backed link)", () => {
    const link = makeLink({ fieldId: null });
    insertLink(db, link);
    expect(getLinkById(db, link.id)?.fieldId).toBeNull();
  });

  it("stores a real fieldId when the link represents a relation field's value", () => {
    const link = makeLink({ fieldId: "f-author" });
    insertLink(db, link);
    expect(getLinkById(db, link.id)?.fieldId).toBe("f-author");
  });
});

describe("entities/link — directional queries", () => {
  it("getLinksFrom returns only links where the capsule is the source", () => {
    insertLink(
      db,
      makeLink({ id: "l-1", fromCapsuleId: "c-1", toCapsuleId: "c-2" }),
    );
    insertLink(
      db,
      makeLink({ id: "l-2", fromCapsuleId: "c-2", toCapsuleId: "c-1" }),
    );
    expect(getLinksFrom(db, "c-1").map((l) => l.id)).toEqual(["l-1"]);
  });

  it("getLinksTo returns only links where the capsule is the target", () => {
    insertLink(
      db,
      makeLink({ id: "l-1", fromCapsuleId: "c-1", toCapsuleId: "c-2" }),
    );
    insertLink(
      db,
      makeLink({ id: "l-2", fromCapsuleId: "c-2", toCapsuleId: "c-1" }),
    );
    expect(getLinksTo(db, "c-2").map((l) => l.id)).toEqual(["l-1"]);
  });

  it("a capsule with no links returns an empty array in both directions, not an error", () => {
    expect(getLinksFrom(db, "untouched")).toEqual([]);
    expect(getLinksTo(db, "untouched")).toEqual([]);
  });
});

describe("entities/link — getLinksFromByField", () => {
  it("scopes to only links created by one specific relation field, ignoring links from a different field on the same capsule", () => {
    insertLink(
      db,
      makeLink({
        id: "l-author",
        fromCapsuleId: "c-1",
        toCapsuleId: "c-person",
        fieldId: "f-author",
      }),
    );
    insertLink(
      db,
      makeLink({
        id: "l-related",
        fromCapsuleId: "c-1",
        toCapsuleId: "c-other-book",
        fieldId: "f-related-books",
      }),
    );
    expect(getLinksFromByField(db, "c-1", "f-author").map((l) => l.id)).toEqual(
      ["l-author"],
    );
  });

  it("does not return a generic (fieldId: null) link when scoped to a specific field", () => {
    insertLink(
      db,
      makeLink({ id: "l-generic", fromCapsuleId: "c-1", fieldId: null }),
    );
    expect(getLinksFromByField(db, "c-1", "f-author")).toEqual([]);
  });

  it("a field with no links yet returns an empty array, not an error", () => {
    expect(getLinksFromByField(db, "c-1", "f-author")).toEqual([]);
  });
});

describe("entities/link — graceful missing-target handling", () => {
  it("getLinksFrom/getLinksTo still return the link even if the target capsule doesn't exist anywhere — no FK, no join, nothing to fail", () => {
    // No capsules table involved at all in this test — links are stored
    // and queried purely by id string, exactly as they would be after the
    // capsule on the other end was deleted.
    insertLink(
      db,
      makeLink({
        id: "l-dangling",
        fromCapsuleId: "c-real",
        toCapsuleId: "c-deleted",
      }),
    );
    expect(getLinksFrom(db, "c-real").map((l) => l.id)).toEqual(["l-dangling"]);
    expect(getLinksTo(db, "c-deleted").map((l) => l.id)).toEqual([
      "l-dangling",
    ]);
  });
});

describe("entities/link — deleteLinksByCapsule cascade helper", () => {
  it("removes every link where the capsule is the source", () => {
    insertLink(
      db,
      makeLink({ id: "l-1", fromCapsuleId: "c-1", toCapsuleId: "c-2" }),
    );
    deleteLinksByCapsule(db, "c-1");
    expect(getLinksFrom(db, "c-1")).toEqual([]);
  });

  it("removes every link where the capsule is the target", () => {
    insertLink(
      db,
      makeLink({ id: "l-1", fromCapsuleId: "c-1", toCapsuleId: "c-2" }),
    );
    deleteLinksByCapsule(db, "c-2");
    expect(getLinksTo(db, "c-2")).toEqual([]);
  });

  it("leaves links belonging to other capsules intact", () => {
    insertLink(
      db,
      makeLink({ id: "l-1", fromCapsuleId: "c-1", toCapsuleId: "c-2" }),
    );
    insertLink(
      db,
      makeLink({ id: "l-2", fromCapsuleId: "c-3", toCapsuleId: "c-4" }),
    );
    deleteLinksByCapsule(db, "c-1");
    expect(getLinksFrom(db, "c-3").map((l) => l.id)).toEqual(["l-2"]);
  });
});
