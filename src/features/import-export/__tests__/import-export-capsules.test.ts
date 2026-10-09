// Tests for step 5.2 (capsule scope) — written before implementation (TDD)
import type { SQLiteDatabase } from "expo-sqlite";
import { openDb, runMigrations, _resetDbForTesting } from "@/shared/db";
import {
  capsuleTypesMigration,
  getAllCapsuleTypes,
  insertCapsuleType,
  type CapsuleType,
} from "@/entities/capsule-type";
import {
  capsuleFieldsMigration,
  getFieldsByCapsuleType,
  insertCapsuleField,
  type CapsuleField,
} from "@/entities/field";
import {
  capsuleParentIdMigration,
  capsuleValuesMigration,
  capsuleVersionsMigration,
  capsulesMigration,
  getAllCapsules,
  getValuesByCapsule,
  getVersionsByCapsule,
  insertCapsule,
  insertCapsuleVersion,
  upsertCapsuleValue,
  type Capsule,
} from "@/entities/capsule";
import {
  addTagToCapsule,
  capsuleTagsMigration,
  getAllTags,
  getTagsByCapsule,
  insertTag,
  tagsMigration,
} from "@/entities/tag";
import {
  capsuleLinksFieldIdMigration,
  getLinksFrom,
  insertLink,
  linksMigration,
} from "@/entities/link";
import { auditMigration, getAllAuditEntries } from "@/entities/audit";
import {
  getRemindersByCapsule,
  insertReminder,
  remindersMigration,
} from "@/entities/reminder";
import { PortableFormatError } from "@/shared/format";
import {
  exportCapsule,
  importCapsule,
  exportAllCapsules,
  importAllCapsules,
  exportConversation,
} from "../index";

let db: SQLiteDatabase;

const type = (id: string, name = "Book"): CapsuleType => ({
  id,
  name,
  description: null,
  createdAt: 1000,
  updatedAt: 1000,
});

const field = (
  id: string,
  capsuleTypeId: string,
  name: string,
  fieldType: CapsuleField["fieldType"] = "text",
  sortOrder = 0,
): CapsuleField => ({
  id,
  capsuleTypeId,
  name,
  fieldType,
  config: null,
  sortOrder,
  required: false,
  createdAt: 1000,
  updatedAt: 1000,
});

const capsule = (
  id: string,
  capsuleTypeId: string,
  title: string,
  parentCapsuleId: string | null = null,
): Capsule => ({
  id,
  capsuleTypeId,
  title,
  parentCapsuleId,
  createdAt: 1000,
  updatedAt: 2000,
});

const value = (
  id: string,
  capsuleId: string,
  fieldId: string,
  v: string | null,
) => ({
  id,
  capsuleId,
  fieldId,
  value: v,
  createdAt: 1000,
  updatedAt: 1000,
});

/** A "Book" type with Author (text) + Pages (number) + Related (relation). */
function seedBookType() {
  insertCapsuleType(db, type("t1"));
  insertCapsuleField(db, field("f-author", "t1", "Author", "text", 0));
  insertCapsuleField(db, field("f-pages", "t1", "Pages", "number", 1));
  insertCapsuleField(db, field("f-rel", "t1", "Related", "relation", 2));
}

function valueOf(capsuleId: string, fieldName: string): string | null {
  const c = getAllCapsules(db).find((x) => x.id === capsuleId)!;
  const f = getFieldsByCapsuleType(db, c.capsuleTypeId).find(
    (x) => x.name === fieldName,
  )!;
  return (
    getValuesByCapsule(db, capsuleId).find((v) => v.fieldId === f.id)?.value ??
    null
  );
}

beforeEach(() => {
  _resetDbForTesting();
  db = openDb();
  runMigrations(db, [
    auditMigration,
    capsuleTypesMigration,
    capsuleFieldsMigration,
    capsulesMigration,
    capsuleValuesMigration,
    tagsMigration,
    capsuleTagsMigration,
    linksMigration,
    capsuleLinksFieldIdMigration,
    capsuleParentIdMigration,
    capsuleVersionsMigration,
    remindersMigration,
  ]);
});

describe("exportCapsule / importCapsule — single capsule round trip", () => {
  it("restores title, field values, and the capsule's own type schema under fresh ids", () => {
    seedBookType();
    insertCapsule(db, capsule("c1", "t1", "Dune"));
    upsertCapsuleValue(db, value("v1", "c1", "f-author", "Herbert"));
    upsertCapsuleValue(db, value("v2", "c1", "f-pages", "412"));

    const imported = importCapsule(db, exportCapsule(db, "c1"));

    expect(imported.id).not.toBe("c1");
    expect(imported.title).toBe("Dune");
    expect(imported.capsuleTypeId).not.toBe("t1");

    // The imported capsule carries its own schema — a new type with the
    // same field names, not a pointer back to the original type.
    const fields = getFieldsByCapsuleType(db, imported.capsuleTypeId);
    expect(fields.map((f) => f.name)).toEqual(["Author", "Pages", "Related"]);
    expect(fields.map((f) => f.fieldType)).toEqual([
      "text",
      "number",
      "relation",
    ]);
    expect(fields.every((f) => !f.id.startsWith("f-"))).toBe(true);

    // Values point at the NEW field ids, not the exported ones.
    expect(valueOf(imported.id, "Author")).toBe("Herbert");
    expect(valueOf(imported.id, "Pages")).toBe("412");
    expect(
      getValuesByCapsule(db, imported.id).every((v) =>
        fields.some((f) => f.id === v.fieldId),
      ),
    ).toBe(true);
  });

  it("preserves an explicitly null value as null, not dropped or stringified", () => {
    seedBookType();
    insertCapsule(db, capsule("c1", "t1", "Dune"));
    upsertCapsuleValue(db, value("v1", "c1", "f-author", null));

    const imported = importCapsule(db, exportCapsule(db, "c1"));
    const values = getValuesByCapsule(db, imported.id);
    expect(values).toHaveLength(1);
    expect(values[0].value).toBeNull();
  });

  it("importing the same export twice yields two independent capsules", () => {
    seedBookType();
    insertCapsule(db, capsule("c1", "t1", "Dune"));
    const json = exportCapsule(db, "c1");

    const a = importCapsule(db, json);
    const b = importCapsule(db, json);

    expect(a.id).not.toBe(b.id);
    expect(getAllCapsules(db)).toHaveLength(3);
  });

  it("restores tags by name, reusing an existing tag instead of duplicating it", () => {
    seedBookType();
    insertCapsule(db, capsule("c1", "t1", "Dune"));
    insertTag(db, { id: "tag-sf", name: "sci-fi", createdAt: 1, updatedAt: 1 });
    insertTag(db, {
      id: "tag-fav",
      name: "favorite",
      createdAt: 1,
      updatedAt: 1,
    });
    addTagToCapsule(db, "c1", "tag-sf", 1);
    addTagToCapsule(db, "c1", "tag-fav", 1);

    const imported = importCapsule(db, exportCapsule(db, "c1"));

    expect(
      getTagsByCapsule(db, imported.id)
        .map((t) => t.name)
        .sort(),
    ).toEqual(["favorite", "sci-fi"]);
    // No duplicate "sci-fi"/"favorite" rows were created.
    expect(getAllTags(db)).toHaveLength(2);
  });

  it("creates a tag that doesn't exist locally yet", () => {
    seedBookType();
    insertCapsule(db, capsule("c1", "t1", "Dune"));
    insertTag(db, { id: "tag-sf", name: "sci-fi", createdAt: 1, updatedAt: 1 });
    addTagToCapsule(db, "c1", "tag-sf", 1);
    const json = exportCapsule(db, "c1");

    // Simulate importing on a device that has never seen this tag.
    _resetDbForTesting();
    db = openDb();
    runMigrations(db, [
      auditMigration,
      capsuleTypesMigration,
      capsuleFieldsMigration,
      capsulesMigration,
      capsuleValuesMigration,
      tagsMigration,
      capsuleTagsMigration,
      linksMigration,
      capsuleLinksFieldIdMigration,
      capsuleParentIdMigration,
      capsuleVersionsMigration,
      remindersMigration,
    ]);
    const imported = importCapsule(db, json);

    expect(getTagsByCapsule(db, imported.id).map((t) => t.name)).toEqual([
      "sci-fi",
    ]);
  });

  it("restores version history with capsule id and field-keyed values remapped", () => {
    seedBookType();
    insertCapsule(db, capsule("c1", "t1", "Dune"));
    insertCapsuleVersion(db, {
      id: "ver1",
      capsuleId: "c1",
      title: "Dune (draft)",
      values: { "f-author": "F. Herbert" },
      createdAt: 500,
    });

    const imported = importCapsule(db, exportCapsule(db, "c1"));

    const versions = getVersionsByCapsule(db, imported.id);
    expect(versions).toHaveLength(1);
    expect(versions[0].id).not.toBe("ver1");
    expect(versions[0].title).toBe("Dune (draft)");
    const authorField = getFieldsByCapsuleType(db, imported.capsuleTypeId).find(
      (f) => f.name === "Author",
    )!;
    expect(versions[0].values).toEqual({ [authorField.id]: "F. Herbert" });
  });

  it("restores the capsule's reminders under fresh ids, pointing at the new capsule", () => {
    seedBookType();
    insertCapsule(db, capsule("c1", "t1", "Dune"));
    insertReminder(db, {
      id: "r1",
      capsuleId: "c1",
      remindAt: 9_000,
      message: "Return to library",
      createdAt: 1,
      updatedAt: 1,
    });

    const imported = importCapsule(db, exportCapsule(db, "c1"));

    const reminders = getRemindersByCapsule(db, imported.id);
    expect(reminders).toHaveLength(1);
    expect(reminders[0].id).not.toBe("r1");
    expect(reminders[0].remindAt).toBe(9_000);
    expect(reminders[0].message).toBe("Return to library");
  });

  it("rejects a single-capsule envelope that contains no capsule", () => {
    const empty = JSON.stringify({
      formatVersion: 1,
      kind: "capsule",
      exportedAt: 0,
      data: { types: [], capsules: [], links: [] },
    });
    expect(() => importCapsule(db, empty)).toThrow(PortableFormatError);
  });

  it("drops the parent reference — the parent isn't part of a single-capsule export", () => {
    seedBookType();
    insertCapsule(db, capsule("parent", "t1", "Series"));
    insertCapsule(db, capsule("child", "t1", "Dune", "parent"));

    const imported = importCapsule(db, exportCapsule(db, "child"));
    expect(imported.parentCapsuleId).toBeNull();
  });

  it("drops links to capsules outside the export instead of importing dangling ones", () => {
    seedBookType();
    insertCapsule(db, capsule("c1", "t1", "Dune"));
    insertCapsule(db, capsule("c2", "t1", "Children of Dune"));
    insertLink(db, {
      id: "l1",
      fromCapsuleId: "c1",
      toCapsuleId: "c2",
      fieldId: "f-rel",
      label: null,
      createdAt: 1,
    });

    const imported = importCapsule(db, exportCapsule(db, "c1"));
    expect(getLinksFrom(db, imported.id)).toEqual([]);
  });

  it("keeps a type reference that was already dangling at export time, so the UI's 'Unknown type' fallback still applies", () => {
    insertCapsule(db, capsule("c1", "t-gone", "Orphan"));

    const imported = importCapsule(db, exportCapsule(db, "c1"));
    expect(imported.capsuleTypeId).toBe("t-gone");
    expect(getAllCapsuleTypes(db)).toEqual([]);
  });

  it("throws for an unknown capsule id and writes no audit entry", () => {
    expect(() => exportCapsule(db, "nope")).toThrow(/nope/);
    expect(getAllAuditEntries(db)).toEqual([]);
  });

  it("writes an export audit entry on export, and nothing on import", () => {
    seedBookType();
    insertCapsule(db, capsule("c1", "t1", "Dune"));

    const json = exportCapsule(db, "c1");
    expect(getAllAuditEntries(db)).toHaveLength(1);
    expect(getAllAuditEntries(db)[0].action).toBe("export");
    expect(getAllAuditEntries(db)[0].detail).toContain("Dune");

    importCapsule(db, json);
    expect(getAllAuditEntries(db)).toHaveLength(1);
  });

  it("rejects a conversation export with PortableFormatError and writes nothing", () => {
    const notACapsule = JSON.stringify({
      formatVersion: 1,
      kind: "conversation",
      exportedAt: 0,
      data: {},
    });
    expect(() => importCapsule(db, notACapsule)).toThrow(PortableFormatError);
    expect(getAllCapsules(db)).toEqual([]);
    // exportConversation is still exported alongside — the capsule scope
    // extends this slice, it doesn't replace the conversation scope.
    expect(typeof exportConversation).toBe("function");
  });
});

describe("exportAllCapsules / importAllCapsules — whole collection", () => {
  function seedLibrary() {
    seedBookType();
    insertCapsuleType(db, type("t2", "Note"));
    insertCapsuleField(db, field("f-body", "t2", "Body", "long_text"));

    insertCapsule(db, capsule("series", "t1", "Dune saga"));
    insertCapsule(db, capsule("b1", "t1", "Dune", "series"));
    insertCapsule(db, capsule("b2", "t1", "Messiah", "series"));
    insertCapsule(db, capsule("n1", "t2", "Reading notes"));
    upsertCapsuleValue(db, value("v1", "b1", "f-author", "Herbert"));
    upsertCapsuleValue(db, value("v2", "n1", "f-body", "Loved it"));
    insertLink(db, {
      id: "l1",
      fromCapsuleId: "b1",
      toCapsuleId: "b2",
      fieldId: "f-rel",
      label: "sequel",
      createdAt: 1,
    });
  }

  it("round-trips every capsule, sharing one restored type per exported type", () => {
    seedLibrary();
    const json = exportAllCapsules(db);

    _resetDbForTesting();
    db = openDb();
    runMigrations(db, [
      auditMigration,
      capsuleTypesMigration,
      capsuleFieldsMigration,
      capsulesMigration,
      capsuleValuesMigration,
      tagsMigration,
      capsuleTagsMigration,
      linksMigration,
      capsuleLinksFieldIdMigration,
      capsuleParentIdMigration,
      capsuleVersionsMigration,
      remindersMigration,
    ]);
    const imported = importAllCapsules(db, json);

    expect(imported.map((c) => c.title).sort()).toEqual([
      "Dune",
      "Dune saga",
      "Messiah",
      "Reading notes",
    ]);
    expect(
      getAllCapsuleTypes(db)
        .map((t) => t.name)
        .sort(),
    ).toEqual(["Book", "Note"]);

    const byTitle = (t: string) => imported.find((c) => c.title === t)!;
    // Three books share ONE restored Book type, not three copies.
    expect(byTitle("Dune").capsuleTypeId).toBe(
      byTitle("Messiah").capsuleTypeId,
    );
    expect(byTitle("Dune").capsuleTypeId).toBe(
      byTitle("Dune saga").capsuleTypeId,
    );
    expect(valueOf(byTitle("Dune").id, "Author")).toBe("Herbert");
    expect(valueOf(byTitle("Reading notes").id, "Body")).toBe("Loved it");
  });

  it("remaps nesting so children point at the restored parent", () => {
    seedLibrary();
    const imported = importAllCapsules(db, exportAllCapsules(db));

    const saga = imported.find((c) => c.title === "Dune saga")!;
    const dune = imported.find((c) => c.title === "Dune")!;
    expect(saga.id).not.toBe("series");
    expect(dune.parentCapsuleId).toBe(saga.id);
  });

  it("remaps links between exported capsules, including the relation field id", () => {
    seedLibrary();
    const imported = importAllCapsules(db, exportAllCapsules(db));

    const dune = imported.find((c) => c.title === "Dune")!;
    const messiah = imported.find((c) => c.title === "Messiah")!;
    const links = getLinksFrom(db, dune.id);
    expect(links).toHaveLength(1);
    expect(links[0].toCapsuleId).toBe(messiah.id);
    expect(links[0].label).toBe("sequel");
    const relField = getFieldsByCapsuleType(db, dune.capsuleTypeId).find(
      (f) => f.name === "Related",
    )!;
    expect(links[0].fieldId).toBe(relField.id);
  });

  it("drops a link whose target no longer exists at export time", () => {
    seedLibrary();
    insertLink(db, {
      id: "l-dangling",
      fromCapsuleId: "n1",
      toCapsuleId: "deleted-capsule",
      fieldId: null,
      label: null,
      createdAt: 1,
    });

    const imported = importAllCapsules(db, exportAllCapsules(db));
    const notes = imported.find((c) => c.title === "Reading notes")!;
    expect(getLinksFrom(db, notes.id)).toEqual([]);
  });

  it("exports types that have no capsules yet, so an empty schema survives too", () => {
    insertCapsuleType(db, type("t-empty", "Recipe"));
    insertCapsuleField(db, field("f-x", "t-empty", "Ingredients", "long_text"));
    const json = exportAllCapsules(db);

    _resetDbForTesting();
    db = openDb();
    runMigrations(db, [
      auditMigration,
      capsuleTypesMigration,
      capsuleFieldsMigration,
      capsulesMigration,
      capsuleValuesMigration,
      tagsMigration,
      capsuleTagsMigration,
      linksMigration,
      capsuleLinksFieldIdMigration,
      capsuleParentIdMigration,
      capsuleVersionsMigration,
      remindersMigration,
    ]);
    expect(importAllCapsules(db, json)).toEqual([]);
    const types = getAllCapsuleTypes(db);
    expect(types.map((t) => t.name)).toEqual(["Recipe"]);
    expect(getFieldsByCapsuleType(db, types[0].id).map((f) => f.name)).toEqual([
      "Ingredients",
    ]);
  });

  it("writes one export audit entry with the capsule count", () => {
    seedLibrary();
    exportAllCapsules(db);
    const entries = getAllAuditEntries(db);
    expect(entries).toHaveLength(1);
    expect(entries[0].action).toBe("export");
    expect(entries[0].detail).toContain("4 capsules");
  });

  it("rejects a single-capsule export (wrong kind)", () => {
    seedBookType();
    insertCapsule(db, capsule("c1", "t1", "Dune"));
    expect(() => importAllCapsules(db, exportCapsule(db, "c1"))).toThrow(
      PortableFormatError,
    );
  });
});
