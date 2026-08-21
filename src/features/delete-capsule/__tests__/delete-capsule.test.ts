// Tests for step 6.4 — written before implementation (TDD)
import type { SQLiteDatabase } from "expo-sqlite";
import { openDb, runMigrations, _resetDbForTesting } from "@/shared/db";
import {
  capsulesMigration,
  capsuleValuesMigration,
  getCapsuleById,
  getValuesByCapsule,
} from "@/entities/capsule";
import {
  capsuleTagsMigration,
  getTagsByCapsule,
  tagsMigration,
} from "@/entities/tag";
import {
  capsuleLinksFieldIdMigration,
  getLinksFrom,
  getLinksTo,
  linksMigration,
} from "@/entities/link";
import {
  attachmentsMigration,
  getAttachmentsByCapsuleField,
  insertAttachment,
} from "@/entities/attachment";
import { createCapsule } from "@/features/create-capsule";
import { tagCapsule } from "@/features/tag-capsule";
import { linkCapsules } from "@/features/link-capsules";
import { deleteCapsule } from "../index";

let db: SQLiteDatabase;

beforeEach(() => {
  _resetDbForTesting();
  db = openDb();
  runMigrations(db, [
    capsulesMigration,
    capsuleValuesMigration,
    tagsMigration,
    capsuleTagsMigration,
    linksMigration,
    capsuleLinksFieldIdMigration,
    attachmentsMigration,
  ]);
});

describe("deleteCapsule", () => {
  it("removes the capsule itself", () => {
    const capsule = createCapsule(db, { capsuleTypeId: "ct-1" });
    deleteCapsule(db, capsule.id);
    expect(getCapsuleById(db, capsule.id)).toBeNull();
  });

  it("removes every one of the capsule's field values too — cross-entity cleanup", () => {
    const capsule = createCapsule(db, {
      capsuleTypeId: "ct-1",
      values: { "f-a": "1", "f-b": "2" },
    });
    deleteCapsule(db, capsule.id);
    expect(getValuesByCapsule(db, capsule.id)).toEqual([]);
  });

  it("leaves other capsules' values intact", () => {
    const a = createCapsule(db, { capsuleTypeId: "ct-1", values: { f: "a" } });
    const b = createCapsule(db, { capsuleTypeId: "ct-1", values: { f: "b" } });
    deleteCapsule(db, a.id);
    expect(getCapsuleById(db, b.id)).not.toBeNull();
    expect(getValuesByCapsule(db, b.id)).toHaveLength(1);
  });

  it("deleting an unknown id does not throw", () => {
    expect(() => deleteCapsule(db, "missing")).not.toThrow();
  });

  it("removes the capsule's tag attachments too, without deleting the tag records themselves (6.6 cascade)", () => {
    const capsule = createCapsule(db, { capsuleTypeId: "ct-1" });
    tagCapsule(db, capsule.id, "urgent");
    deleteCapsule(db, capsule.id);
    expect(getTagsByCapsule(db, capsule.id)).toEqual([]);
  });

  it("leaves another capsule's tag attachments intact", () => {
    const a = createCapsule(db, { capsuleTypeId: "ct-1" });
    const b = createCapsule(db, { capsuleTypeId: "ct-1" });
    const tag = tagCapsule(db, a.id, "shared-tag");
    tagCapsule(db, b.id, "shared-tag");
    deleteCapsule(db, a.id);
    expect(getTagsByCapsule(db, b.id).map((t) => t.id)).toEqual([tag.id]);
  });

  it("removes links where the deleted capsule is the source (6.9 cascade)", () => {
    const a = createCapsule(db, { capsuleTypeId: "ct-1" });
    const b = createCapsule(db, { capsuleTypeId: "ct-1" });
    linkCapsules(db, a.id, b.id);
    deleteCapsule(db, a.id);
    expect(getLinksFrom(db, a.id)).toEqual([]);
  });

  it("removes links where the deleted capsule is the target", () => {
    const a = createCapsule(db, { capsuleTypeId: "ct-1" });
    const b = createCapsule(db, { capsuleTypeId: "ct-1" });
    linkCapsules(db, a.id, b.id);
    deleteCapsule(db, b.id);
    expect(getLinksTo(db, b.id)).toEqual([]);
  });

  it("leaves another capsule pair's link intact", () => {
    const a = createCapsule(db, { capsuleTypeId: "ct-1" });
    const b = createCapsule(db, { capsuleTypeId: "ct-1" });
    const c = createCapsule(db, { capsuleTypeId: "ct-1" });
    const d = createCapsule(db, { capsuleTypeId: "ct-1" });
    linkCapsules(db, a.id, b.id);
    const untouched = linkCapsules(db, c.id, d.id);
    deleteCapsule(db, a.id);
    expect(getLinksFrom(db, c.id).map((l) => l.id)).toEqual([untouched.id]);
  });

  it("removes the capsule's attachment records too (6.8 cascade)", () => {
    const capsule = createCapsule(db, { capsuleTypeId: "ct-1" });
    insertAttachment(db, {
      id: "att-1",
      capsuleId: capsule.id,
      fieldId: "f-photo",
      filename: "photo.jpg",
      localUri: "file:///docs/photo.jpg",
      mimeType: "image/jpeg",
      size: 1024,
      createdAt: Date.now(),
    });
    deleteCapsule(db, capsule.id);
    expect(getAttachmentsByCapsuleField(db, capsule.id, "f-photo")).toEqual([]);
  });

  it("leaves another capsule's attachment records intact", () => {
    const a = createCapsule(db, { capsuleTypeId: "ct-1" });
    const b = createCapsule(db, { capsuleTypeId: "ct-1" });
    insertAttachment(db, {
      id: "att-a",
      capsuleId: a.id,
      fieldId: "f-photo",
      filename: "a.jpg",
      localUri: "file:///docs/a.jpg",
      mimeType: null,
      size: null,
      createdAt: Date.now(),
    });
    insertAttachment(db, {
      id: "att-b",
      capsuleId: b.id,
      fieldId: "f-photo",
      filename: "b.jpg",
      localUri: "file:///docs/b.jpg",
      mimeType: null,
      size: null,
      createdAt: Date.now(),
    });
    deleteCapsule(db, a.id);
    expect(
      getAttachmentsByCapsuleField(db, b.id, "f-photo").map((att) => att.id),
    ).toEqual(["att-b"]);
  });
});
