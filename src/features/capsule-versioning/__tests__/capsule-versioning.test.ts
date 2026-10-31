// Tests for step 8.5 "version history" — written before implementation (TDD)
import type { SQLiteDatabase } from "expo-sqlite";
import { openDb, runMigrations, _resetDbForTesting } from "@/shared/db";
import {
  capsuleParentIdMigration,
  capsulesMigration,
  capsuleValuesMigration,
  capsuleVersionsMigration,
  getCapsuleById,
  getValueByCapsuleAndField,
  getVersionsByCapsule,
} from "@/entities/capsule";
import { capsuleFieldsMigration, insertCapsuleField } from "@/entities/field";
import { createCapsule } from "@/features/create-capsule";
import { renameCapsule, setCapsuleFieldValue } from "@/features/edit-capsule";
import {
  getCapsuleHistory,
  getVersionChanges,
  restoreCapsuleVersion,
  snapshotCapsule,
} from "../index";

let db: SQLiteDatabase;

beforeEach(() => {
  _resetDbForTesting();
  db = openDb();
  runMigrations(db, [
    capsulesMigration,
    capsuleValuesMigration,
    capsuleVersionsMigration,
    capsuleParentIdMigration,
    capsuleFieldsMigration,
  ]);
});

describe("snapshotCapsule", () => {
  it("captures the capsule's current title and field values", () => {
    const capsule = createCapsule(db, {
      capsuleTypeId: "ct-1",
      title: "Dune",
      values: { "f-author": "Frank Herbert" },
    });
    const version = snapshotCapsule(db, capsule.id);
    expect(version?.title).toBe("Dune");
    expect(version?.values).toEqual({ "f-author": "Frank Herbert" });
  });

  it("persists the snapshot — it shows up in getCapsuleHistory", () => {
    const capsule = createCapsule(db, { capsuleTypeId: "ct-1", title: "Dune" });
    snapshotCapsule(db, capsule.id);
    expect(getVersionsByCapsule(db, capsule.id)).toHaveLength(1);
  });

  it("returns null for an unknown capsule id, without throwing", () => {
    expect(() => snapshotCapsule(db, "missing")).not.toThrow();
    expect(snapshotCapsule(db, "missing")).toBeNull();
  });

  it("captures a capsule with no field values as an empty values map", () => {
    const capsule = createCapsule(db, { capsuleTypeId: "ct-1" });
    const version = snapshotCapsule(db, capsule.id);
    expect(version?.values).toEqual({});
  });

  it("taking two snapshots produces two distinct history entries", () => {
    const capsule = createCapsule(db, { capsuleTypeId: "ct-1", title: "Dune" });
    snapshotCapsule(db, capsule.id);
    snapshotCapsule(db, capsule.id);
    expect(getVersionsByCapsule(db, capsule.id)).toHaveLength(2);
  });
});

describe("getCapsuleHistory", () => {
  it("returns every snapshot for a capsule, most recent first", () => {
    const capsule = createCapsule(db, { capsuleTypeId: "ct-1", title: "v1" });
    snapshotCapsule(db, capsule.id);
    const first = getCapsuleHistory(db, capsule.id)[0];
    expect(first.title).toBe("v1");
  });

  it("returns an empty array for a capsule with no history yet", () => {
    const capsule = createCapsule(db, { capsuleTypeId: "ct-1" });
    expect(getCapsuleHistory(db, capsule.id)).toEqual([]);
  });
});

describe("restoreCapsuleVersion", () => {
  it("restores the capsule's title and field values from a past version", () => {
    const capsule = createCapsule(db, {
      capsuleTypeId: "ct-1",
      title: "Dune",
      values: { "f-author": "Frank Herbert" },
    });
    const version = snapshotCapsule(db, capsule.id)!;

    // Simulate an edit after the snapshot.
    renameCapsule(db, capsule.id, "Dune Messiah");
    setCapsuleFieldValue(db, capsule.id, "f-author", "Someone Else");

    restoreCapsuleVersion(db, version.id);

    expect(getCapsuleById(db, capsule.id)?.title).toBe("Dune");
    expect(getValueByCapsuleAndField(db, capsule.id, "f-author")?.value).toBe(
      "Frank Herbert",
    );
  });

  it("returns false for an unknown version id, without throwing", () => {
    expect(() => restoreCapsuleVersion(db, "missing")).not.toThrow();
    expect(restoreCapsuleVersion(db, "missing")).toBe(false);
  });

  it("returns true when the restore actually applies", () => {
    const capsule = createCapsule(db, { capsuleTypeId: "ct-1", title: "Dune" });
    const version = snapshotCapsule(db, capsule.id)!;
    expect(restoreCapsuleVersion(db, version.id)).toBe(true);
  });

  // 10.33: a snapshot records only fields that had a value row, so a field
  // missing from it was empty then — whether the field existed and was left
  // blank, or was added to the type later. Restore clears it, the same way
  // getVersionChanges reads a missing field as empty.
  it("clears a field that was filled after the snapshot was taken", () => {
    const capsule = createCapsule(db, { capsuleTypeId: "ct-1", title: "Dune" });
    const version = snapshotCapsule(db, capsule.id)!;
    expect(version.values).toEqual({});

    setCapsuleFieldValue(db, capsule.id, "f-author", "Frank Herbert");
    restoreCapsuleVersion(db, version.id);

    expect(
      getValueByCapsuleAndField(db, capsule.id, "f-author")?.value ?? null,
    ).toBeNull();
  });

  it("also clears a field added to the type after the snapshot (it had no value then)", () => {
    const capsule = createCapsule(db, {
      capsuleTypeId: "ct-1",
      title: "Dune",
      values: { "f-author": "Frank Herbert" },
    });
    const version = snapshotCapsule(db, capsule.id)!;

    // The type gains "Genre" only now, after the snapshot.
    insertCapsuleField(db, {
      id: "f-genre",
      capsuleTypeId: "ct-1",
      name: "Genre",
      fieldType: "text",
      config: null,
      sortOrder: 1,
      required: false,
      createdAt: version.createdAt + 1,
      updatedAt: version.createdAt + 1,
    });
    setCapsuleFieldValue(db, capsule.id, "f-genre", "Sci-Fi");
    restoreCapsuleVersion(db, version.id);

    expect(
      getValueByCapsuleAndField(db, capsule.id, "f-genre")?.value ?? null,
    ).toBeNull();
    expect(getValueByCapsuleAndField(db, capsule.id, "f-author")?.value).toBe(
      "Frank Herbert",
    );
  });

  it("a cleared value is kept in the safety snapshot, so restoring that brings it back", () => {
    const capsule = createCapsule(db, { capsuleTypeId: "ct-1", title: "Dune" });
    const version = snapshotCapsule(db, capsule.id)!;
    setCapsuleFieldValue(db, capsule.id, "f-genre", "Sci-Fi");

    restoreCapsuleVersion(db, version.id);
    const safety = getCapsuleHistory(db, capsule.id).find(
      (v) => v.id !== version.id,
    )!;
    expect(safety.values).toEqual({ "f-genre": "Sci-Fi" });

    restoreCapsuleVersion(db, safety.id);
    expect(getValueByCapsuleAndField(db, capsule.id, "f-genre")?.value).toBe(
      "Sci-Fi",
    );
  });

  it("after a restore the capsule matches the version the way getVersionChanges compares them", () => {
    const capsule = createCapsule(db, {
      capsuleTypeId: "ct-1",
      title: "Dune",
      values: { "f-author": "Frank Herbert", "f-notes": "" },
    });
    const version = snapshotCapsule(db, capsule.id)!;
    renameCapsule(db, capsule.id, "Dune Messiah");
    setCapsuleFieldValue(db, capsule.id, "f-notes", "Reread");
    setCapsuleFieldValue(db, capsule.id, "f-genre", "Sci-Fi");

    restoreCapsuleVersion(db, version.id);

    // Diffing the restored version against "now" must find nothing left over.
    const changes = getVersionChanges(db, capsule.id, [version]);
    expect(changes[version.id]).toEqual([]);
  });

  it("takes a safety snapshot of the CURRENT state before restoring, so the restore itself is undoable", () => {
    const capsule = createCapsule(db, { capsuleTypeId: "ct-1", title: "v1" });
    const v1 = snapshotCapsule(db, capsule.id)!;

    renameCapsule(db, capsule.id, "v2");

    restoreCapsuleVersion(db, v1.id);

    // History should now contain: v1 (original snapshot) + a safety
    // snapshot of "v2" taken automatically right before the restore.
    const history = getCapsuleHistory(db, capsule.id);
    expect(history.map((v) => v.title).sort()).toEqual(["v1", "v2"]);
  });

  it("does not affect another capsule's fields or history", () => {
    const a = createCapsule(db, { capsuleTypeId: "ct-1", title: "A" });
    const b = createCapsule(db, { capsuleTypeId: "ct-1", title: "B" });
    const versionA = snapshotCapsule(db, a.id)!;

    renameCapsule(db, a.id, "A2");

    restoreCapsuleVersion(db, versionA.id);

    expect(getCapsuleById(db, b.id)?.title).toBe("B");
    expect(getVersionsByCapsule(db, b.id)).toEqual([]);
  });
});
