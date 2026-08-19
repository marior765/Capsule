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
import {
  renameCapsule,
  saveCapsuleEdits,
  setCapsuleFieldValue,
} from "../index";

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

describe("saveCapsuleEdits", () => {
  it("renames the capsule when the title changed", () => {
    const capsule = createCapsule(db, { capsuleTypeId: "ct-1", title: "Dune" });
    saveCapsuleEdits(db, capsule.id, {
      title: "Dune Messiah",
      initialTitle: "Dune",
      values: {},
      initialValues: {},
      fieldIds: [],
    });
    expect(getCapsuleById(db, capsule.id)?.title).toBe("Dune Messiah");
  });

  it("does not touch the capsule's updatedAt when the title is unchanged", () => {
    const capsule = createCapsule(db, { capsuleTypeId: "ct-1", title: "Dune" });
    const before = getCapsuleById(db, capsule.id)!.updatedAt;
    saveCapsuleEdits(db, capsule.id, {
      title: "Dune",
      initialTitle: "Dune",
      values: {},
      initialValues: {},
      fieldIds: [],
    });
    expect(getCapsuleById(db, capsule.id)!.updatedAt).toBe(before);
  });

  it("trims the title and falls back to Untitled when emptied", () => {
    const capsule = createCapsule(db, { capsuleTypeId: "ct-1", title: "Dune" });
    saveCapsuleEdits(db, capsule.id, {
      title: "   ",
      initialTitle: "Dune",
      values: {},
      initialValues: {},
      fieldIds: [],
    });
    expect(getCapsuleById(db, capsule.id)?.title).toBe("Untitled");
  });

  it("does not rename when the trimmed title matches the initial title", () => {
    const capsule = createCapsule(db, { capsuleTypeId: "ct-1", title: "Dune" });
    const before = getCapsuleById(db, capsule.id)!.updatedAt;
    saveCapsuleEdits(db, capsule.id, {
      title: "  Dune  ",
      initialTitle: "Dune",
      values: {},
      initialValues: {},
      fieldIds: [],
    });
    expect(getCapsuleById(db, capsule.id)!.updatedAt).toBe(before);
  });

  it("writes only the field whose value changed", () => {
    const capsule = createCapsule(db, {
      capsuleTypeId: "ct-1",
      values: { "f-author": "Frank Herbert", "f-year": "1965" },
    });
    saveCapsuleEdits(db, capsule.id, {
      title: capsule.title,
      initialTitle: capsule.title,
      values: { "f-author": "Frank Herbert", "f-year": "1966" },
      initialValues: { "f-author": "Frank Herbert", "f-year": "1965" },
      fieldIds: ["f-author", "f-year"],
    });
    expect(getValueByCapsuleAndField(db, capsule.id, "f-year")?.value).toBe(
      "1966",
    );
  });

  it("does not re-write a field whose value is unchanged", () => {
    const capsule = createCapsule(db, {
      capsuleTypeId: "ct-1",
      values: { "f-author": "Frank Herbert" },
    });
    const before = getValueByCapsuleAndField(db, capsule.id, "f-author")!;
    saveCapsuleEdits(db, capsule.id, {
      title: capsule.title,
      initialTitle: capsule.title,
      values: { "f-author": "Frank Herbert" },
      initialValues: { "f-author": "Frank Herbert" },
      fieldIds: ["f-author"],
    });
    const after = getValueByCapsuleAndField(db, capsule.id, "f-author")!;
    expect(after.updatedAt).toBe(before.updatedAt);
  });

  it("does not bump the capsule's updatedAt when nothing changed at all", () => {
    const capsule = createCapsule(db, {
      capsuleTypeId: "ct-1",
      title: "Dune",
      values: { "f-author": "Frank Herbert" },
    });
    const before = getCapsuleById(db, capsule.id)!.updatedAt;
    saveCapsuleEdits(db, capsule.id, {
      title: "Dune",
      initialTitle: "Dune",
      values: { "f-author": "Frank Herbert" },
      initialValues: { "f-author": "Frank Herbert" },
      fieldIds: ["f-author"],
    });
    expect(getCapsuleById(db, capsule.id)!.updatedAt).toBe(before);
  });

  it("treats a field absent from initialValues as null (new field added to the type after load)", () => {
    const capsule = createCapsule(db, { capsuleTypeId: "ct-1" });
    saveCapsuleEdits(db, capsule.id, {
      title: capsule.title,
      initialTitle: capsule.title,
      values: { "f-new": "hello" },
      initialValues: {},
      fieldIds: ["f-new"],
    });
    expect(getValueByCapsuleAndField(db, capsule.id, "f-new")?.value).toBe(
      "hello",
    );
  });
});
