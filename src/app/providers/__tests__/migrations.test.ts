// Regression test for a bug self-caught while starting step 6.6: `Providers`'
// own migrations list never registered the capsule-domain migrations
// (`capsuleTypesMigration`/`capsuleFieldsMigration`/`capsulesMigration`/
// `capsuleValuesMigration`) — a real app boot would leave those tables
// missing entirely. Every capsule test up to now passed anyway because each
// one calls `runMigrations` with its own explicit list, never this one.
//
// Imports from `../migrations`, not `../index` — `../index.tsx` pulls in
// `react-native-unistyles`, which requires a real native NitroModules
// binary and crashes under jest. That's *why* this gap was untestable and
// slipped through; the fix pulled the migrations list into its own module
// specifically so this can be tested at all.
import { openDb, runMigrations, _resetDbForTesting } from "@/shared/db";
import { migrations } from "../migrations";
import { getAllCapsules } from "@/entities/capsule";
import { getAllCapsuleTypes } from "@/entities/capsule-type";
import { getFieldsByCapsuleType } from "@/entities/field";
import { getTagsByCapsule } from "@/entities/tag";
import { getLinksFrom, getLinksFromByField } from "@/entities/link";
import {
  getAttachmentsByCapsuleField,
  insertAttachment,
} from "@/entities/attachment";
import { createCapsuleType } from "@/features/manage-schema";
import { createCapsule } from "@/features/create-capsule";
import { tagCapsule } from "@/features/tag-capsule";
import { linkCapsules } from "@/features/link-capsules";

beforeEach(() => {
  _resetDbForTesting();
});

describe("Providers' registered migrations", () => {
  it("creates the capsule-domain tables on boot", () => {
    runMigrations(openDb(), migrations);
    const db = openDb();
    expect(() => getAllCapsules(db)).not.toThrow();
    expect(() => getAllCapsuleTypes(db)).not.toThrow();
  });

  it("lets a capsule type and a capsule with a field value actually be created through the real migration set", () => {
    runMigrations(openDb(), migrations);
    const db = openDb();
    const capsuleType = createCapsuleType(db, {
      name: "Book",
      fields: [{ name: "Author", fieldType: "text" }],
    });
    const capsule = createCapsule(db, {
      capsuleTypeId: capsuleType.id,
      title: "Dune",
    });
    expect(getAllCapsules(db).map((c) => c.id)).toContain(capsule.id);
    expect(getFieldsByCapsuleType(db, capsuleType.id)).toHaveLength(1);
  });

  it("lets a capsule actually be tagged through the real migration set (6.6)", () => {
    runMigrations(openDb(), migrations);
    const db = openDb();
    const capsuleType = createCapsuleType(db, { name: "Book" });
    const capsule = createCapsule(db, {
      capsuleTypeId: capsuleType.id,
      title: "Dune",
    });
    tagCapsule(db, capsule.id, "sci-fi");
    expect(getTagsByCapsule(db, capsule.id).map((t) => t.name)).toEqual([
      "sci-fi",
    ]);
  });

  it("lets two capsules actually be linked through the real migration set (6.9)", () => {
    runMigrations(openDb(), migrations);
    const db = openDb();
    const capsuleType = createCapsuleType(db, { name: "Book" });
    const a = createCapsule(db, {
      capsuleTypeId: capsuleType.id,
      title: "Dune",
    });
    const b = createCapsule(db, {
      capsuleTypeId: capsuleType.id,
      title: "Dune Messiah",
    });
    linkCapsules(db, a.id, b.id, { label: "sequel" });
    expect(getLinksFrom(db, a.id).map((l) => l.toCapsuleId)).toEqual([b.id]);
  });

  it("lets a relation-field-backed link actually be created and queried through the real migration set (6.8)", () => {
    runMigrations(openDb(), migrations);
    const db = openDb();
    const capsuleType = createCapsuleType(db, { name: "Book" });
    const a = createCapsule(db, {
      capsuleTypeId: capsuleType.id,
      title: "Dune",
    });
    const b = createCapsule(db, {
      capsuleTypeId: capsuleType.id,
      title: "Dune Messiah",
    });
    linkCapsules(db, a.id, b.id, { fieldId: "f-sequel" });
    expect(
      getLinksFromByField(db, a.id, "f-sequel").map((l) => l.toCapsuleId),
    ).toEqual([b.id]);
  });

  it("lets an attachment record actually be created and queried through the real migration set (6.8)", () => {
    runMigrations(openDb(), migrations);
    const db = openDb();
    const capsuleType = createCapsuleType(db, { name: "Book" });
    const capsule = createCapsule(db, {
      capsuleTypeId: capsuleType.id,
      title: "Dune",
    });
    insertAttachment(db, {
      id: "att-1",
      capsuleId: capsule.id,
      fieldId: "f-cover",
      filename: "cover.jpg",
      localUri: "file:///docs/cover.jpg",
      mimeType: "image/jpeg",
      size: 2048,
      createdAt: Date.now(),
    });
    expect(
      getAttachmentsByCapsuleField(db, capsule.id, "f-cover").map(
        (a) => a.filename,
      ),
    ).toEqual(["cover.jpg"]);
  });
});
