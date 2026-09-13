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
import { createCapsule } from "@/features/create-capsule";
import { renameCapsule, setCapsuleFieldValue } from "@/features/edit-capsule";
import {
  getCapsuleHistory,
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

  it("leaves a field's current value untouched when that field is absent from the restored version's snapshot", () => {
    const capsule = createCapsule(db, {
      capsuleTypeId: "ct-1",
      title: "Dune",
      values: { "f-author": "Frank Herbert" },
    });
    const version = snapshotCapsule(db, capsule.id)!;

    // A field added to the capsule's type AFTER this snapshot was taken —
    // the version genuinely has no opinion about it.
    setCapsuleFieldValue(db, capsule.id, "f-genre", "Sci-Fi");

    restoreCapsuleVersion(db, version.id);

    expect(getValueByCapsuleAndField(db, capsule.id, "f-genre")?.value).toBe(
      "Sci-Fi",
    );
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
