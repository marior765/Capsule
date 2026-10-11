// Tests for 5.5 (capsule export/import as a zip bundle with attachment
// files) — written before implementation (TDD).
import type { SQLiteDatabase } from "expo-sqlite";
import { openDb, runMigrations, _resetDbForTesting } from "@/shared/db";
import {
  capsuleTypesMigration,
  insertCapsuleType,
} from "@/entities/capsule-type";
import { capsuleFieldsMigration, insertCapsuleField } from "@/entities/field";
import {
  capsuleParentIdMigration,
  capsuleValuesMigration,
  capsuleVersionsMigration,
  capsulesMigration,
  getAllCapsules,
  insertCapsule,
} from "@/entities/capsule";
import { capsuleTagsMigration, tagsMigration } from "@/entities/tag";
import { capsuleLinksFieldIdMigration, linksMigration } from "@/entities/link";
import { auditMigration, getAllAuditEntries } from "@/entities/audit";
import {
  remindersMigration,
  remindersNotificationIdMigration,
} from "@/entities/reminder";
import {
  attachmentsMigration,
  getAttachmentsByCapsule,
  insertAttachment,
} from "@/entities/attachment";
import { readAppFileBytes, writeAppFileBytes } from "@/shared/fs";
import { textFromBytes, textToBytes, unzipFiles, zipFiles } from "@/shared/zip";
import { PortableFormatError } from "@/shared/format";
import {
  __resetFsMock,
  __fileContents,
  __deletedDirectoryUris,
} from "@/__mocks__/expo-file-system";
import { exportCapsulesBundle, importCapsulesBundle } from "../index";

let db: SQLiteDatabase;

beforeEach(() => {
  __resetFsMock();
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
    remindersNotificationIdMigration,
    attachmentsMigration,
  ]);
  insertCapsuleType(db, {
    id: "t1",
    name: "Receipt",
    description: null,
    createdAt: 1,
    updatedAt: 1,
  });
  insertCapsuleField(db, {
    id: "f-file",
    capsuleTypeId: "t1",
    name: "Scan",
    fieldType: "attachment",
    config: null,
    sortOrder: 0,
    required: false,
    createdAt: 1,
    updatedAt: 1,
  });
  insertCapsule(db, {
    id: "c1",
    capsuleTypeId: "t1",
    title: "Dentist",
    parentCapsuleId: null,
    createdAt: 1,
    updatedAt: 1,
  });
});

function attach(id: string, filename: string, bytes: Uint8Array | null) {
  const storagePath =
    bytes === null
      ? `attachments/c1/${id}-${filename}`
      : writeAppFileBytes(["attachments", "c1"], `${id}-${filename}`, bytes);
  insertAttachment(db, {
    id,
    capsuleId: "c1",
    fieldId: "f-file",
    filename,
    storagePath,
    mimeType: "image/jpeg",
    size: bytes?.length ?? null,
    createdAt: 1,
  });
}

describe("exportCapsulesBundle", () => {
  it("bundles the capsules JSON plus each attachment's bytes", async () => {
    attach("a1", "scan.jpg", new Uint8Array([1, 2, 3]));

    const entries = unzipFiles(await exportCapsulesBundle(db));

    const json = JSON.parse(textFromBytes(entries["capsules.json"])) as {
      kind: string;
      data: { capsules: { attachments: { file: string | null }[] }[] };
    };
    expect(json.kind).toBe("capsule-collection");
    const file = json.data.capsules[0].attachments[0].file!;
    expect(Array.from(entries[file])).toEqual([1, 2, 3]);
  });

  it("exports only the chosen capsules when ids are given", async () => {
    insertCapsule(db, {
      id: "c2",
      capsuleTypeId: "t1",
      title: "Other",
      parentCapsuleId: null,
      createdAt: 1,
      updatedAt: 1,
    });
    const entries = unzipFiles(await exportCapsulesBundle(db, ["c1"]));
    const json = JSON.parse(textFromBytes(entries["capsules.json"])) as {
      data: { capsules: { capsule: { title: string } }[] };
    };
    expect(json.data.capsules.map((c) => c.capsule.title)).toEqual(["Dentist"]);
  });

  it("records an attachment whose file is missing as file: null instead of failing", async () => {
    attach("a1", "gone.jpg", null);
    const entries = unzipFiles(await exportCapsulesBundle(db));
    const json = JSON.parse(textFromBytes(entries["capsules.json"])) as {
      data: { capsules: { attachments: { file: string | null }[] }[] };
    };
    expect(json.data.capsules[0].attachments[0].file).toBeNull();
  });

  it("writes an export audit entry", async () => {
    await exportCapsulesBundle(db);
    expect(getAllAuditEntries(db)).toContainEqual(
      expect.objectContaining({ action: "export" }),
    );
  });
});

describe("importCapsulesBundle", () => {
  it("restores capsules under new ids, with each attachment's file copied in", async () => {
    attach("a1", "scan.jpg", new Uint8Array([7, 8, 9]));
    const bundle = await exportCapsulesBundle(db);

    const [imported] = await importCapsulesBundle(db, bundle);

    expect(imported.id).not.toBe("c1");
    const [att] = getAttachmentsByCapsule(db, imported.id);
    expect(att.id).not.toBe("a1");
    expect(att.filename).toBe("scan.jpg");
    expect(att.storagePath.startsWith(`attachments/${imported.id}/`)).toBe(
      true,
    );
    expect(Array.from(await readAppFileBytes(att.storagePath))).toEqual([
      7, 8, 9,
    ]);
  });

  it("skips an attachment whose file wasn't in the bundle", async () => {
    attach("a1", "gone.jpg", null);
    const [imported] = await importCapsulesBundle(
      db,
      await exportCapsulesBundle(db),
    );
    expect(getAttachmentsByCapsule(db, imported.id)).toEqual([]);
  });

  it("never writes outside the capsule's folder, whatever the bundle says", async () => {
    const json = {
      formatVersion: 1,
      kind: "capsule-collection",
      exportedAt: 1,
      data: {
        types: [
          {
            type: {
              id: "t1",
              name: "Receipt",
              description: null,
              createdAt: 1,
              updatedAt: 1,
            },
            fields: [
              {
                id: "f-file",
                capsuleTypeId: "t1",
                name: "Scan",
                fieldType: "attachment",
                config: null,
                sortOrder: 0,
                required: false,
                createdAt: 1,
                updatedAt: 1,
              },
            ],
          },
        ],
        capsules: [
          {
            capsule: {
              id: "x",
              capsuleTypeId: "t1",
              title: "Evil",
              parentCapsuleId: null,
              createdAt: 1,
              updatedAt: 1,
            },
            values: [],
            tags: [],
            versions: [],
            reminders: [],
            attachments: [
              {
                attachment: {
                  id: "a1",
                  capsuleId: "x",
                  fieldId: "f-file",
                  filename: "../../evil.sh",
                  storagePath: "../../evil.sh",
                  mimeType: null,
                  size: 1,
                  createdAt: 1,
                },
                file: "files/a1",
              },
            ],
          },
        ],
        links: [],
      },
    };
    const bundle = zipFiles({
      "capsules.json": textToBytes(JSON.stringify(json)),
      "files/a1": new Uint8Array([1]),
    });

    const [imported] = await importCapsulesBundle(db, bundle);

    const [att] = getAttachmentsByCapsule(db, imported.id);
    expect(att.storagePath.startsWith(`attachments/${imported.id}/`)).toBe(
      true,
    );
    // exactly attachments/<new capsule>/<one file name> — no extra levels
    expect(att.storagePath.split("/")).toHaveLength(3);
    for (const uri of __fileContents.keys()) {
      expect(uri.startsWith("file:///document/attachments/")).toBe(true);
    }
  });

  it("rejects a bundle without capsules.json, changing nothing", async () => {
    const before = getAllCapsules(db).length;
    await expect(
      importCapsulesBundle(db, zipFiles({ "x.txt": textToBytes("x") })),
    ).rejects.toThrow(PortableFormatError);
    expect(getAllCapsules(db)).toHaveLength(before);
  });

  it("is all-or-nothing: if a row fails after a file was written, the file and its folder are removed too", async () => {
    attach("a1", "scan.jpg", new Uint8Array([1]));
    const bundle = await exportCapsulesBundle(db);
    const filesBefore = new Set(__fileContents.keys());
    const capsulesBefore = getAllCapsules(db).length;
    db.execSync("DROP TABLE attachments;"); // the file is written, then its row fails
    __deletedDirectoryUris.length = 0;

    await expect(importCapsulesBundle(db, bundle)).rejects.toThrow();

    expect(getAllCapsules(db)).toHaveLength(capsulesBefore);
    expect(new Set(__fileContents.keys())).toEqual(filesBefore);
    expect(
      __deletedDirectoryUris.some((uri) =>
        uri.startsWith("file:///document/attachments/"),
      ),
    ).toBe(true);
  });
});

// Checker round 1 (5.5b): hostile bundles.
function hostileBundle(attachments: { file: unknown; fieldId?: string }[]) {
  const json = {
    formatVersion: 1,
    kind: "capsule-collection",
    exportedAt: 1,
    data: {
      types: [
        {
          type: {
            id: "t9",
            name: "T",
            description: null,
            createdAt: 1,
            updatedAt: 1,
          },
          fields: [
            {
              id: "f9",
              capsuleTypeId: "t9",
              name: "File",
              fieldType: "attachment",
              config: null,
              sortOrder: 0,
              required: false,
              createdAt: 1,
              updatedAt: 1,
            },
          ],
        },
      ],
      capsules: [
        {
          capsule: {
            id: "x",
            capsuleTypeId: "t9",
            title: "X",
            parentCapsuleId: null,
            createdAt: 1,
            updatedAt: 1,
          },
          values: [],
          tags: [],
          versions: [],
          reminders: [],
          attachments: attachments.map((a, i) => ({
            attachment: {
              id: `a${i}`,
              capsuleId: "x",
              fieldId: a.fieldId ?? "f9",
              filename: "f.bin",
              storagePath: "x",
              mimeType: null,
              size: 1,
              createdAt: 1,
            },
            file: a.file,
          })),
        },
      ],
      links: [],
    },
  };
  return zipFiles({
    "capsules.json": textToBytes(JSON.stringify(json)),
    "files/1": new Uint8Array([1, 2, 3]),
  });
}

describe("importCapsulesBundle — hostile bundles (5.5b checker)", () => {
  it("lets each file entry be used by one attachment only (no multiplying a big file)", async () => {
    const [imported] = await importCapsulesBundle(
      db,
      hostileBundle([
        { file: "files/1" },
        { file: "files/1" },
        { file: "files/1" },
      ]),
    );
    expect(getAttachmentsByCapsule(db, imported.id)).toHaveLength(1);
  });

  it("ignores file references that aren't real entries (e.g. object built-ins) or aren't strings", async () => {
    const [imported] = await importCapsulesBundle(
      db,
      hostileBundle([
        { file: "constructor" },
        { file: "toString" },
        { file: 42 },
      ]),
    );
    expect(getAttachmentsByCapsule(db, imported.id)).toEqual([]);
  });

  it("skips an attachment for a field that isn't in the bundle", async () => {
    const [imported] = await importCapsulesBundle(
      db,
      hostileBundle([{ file: "files/1", fieldId: "not-a-field" }]),
    );
    expect(getAttachmentsByCapsule(db, imported.id)).toEqual([]);
  });
});

describe("exportCapsulesBundle — size (5.5b checker)", () => {
  it("refuses to build a bundle larger than the app could import back", async () => {
    attach("a1", "big.bin", new Uint8Array(2_000));
    await expect(
      exportCapsulesBundle(db, undefined, { maxTotalBytes: 1_000 }),
    ).rejects.toThrow("too large");
  });
});

it("counts the capsules JSON toward the size cap too (the importer does)", async () => {
  await expect(
    exportCapsulesBundle(db, undefined, { maxTotalBytes: 50 }),
  ).rejects.toThrow("too large");
});
