// Tests for 5.5 part C (full backup/restore as a zip bundle: conversations +
// chat images + capsules + attachments, ids preserved) — written before
// implementation (TDD). "hard" depth: restore is destructive.
import type { SQLiteDatabase } from "expo-sqlite";
import { openDb, runMigrations, _resetDbForTesting } from "@/shared/db";
import { migrations } from "@/app/providers/migrations";
import {
  getAllConversations,
  insertConversation,
} from "@/entities/conversation";
import {
  getImageByMessage,
  getMessagesByConversation,
  insertMessage,
  insertMessageImage,
} from "@/entities/message";
import { insertCapsuleType, getAllCapsuleTypes } from "@/entities/capsule-type";
import { insertCapsuleField, getFieldsByCapsuleType } from "@/entities/field";
import {
  getAllCapsules,
  getValuesByCapsule,
  insertCapsule,
  upsertCapsuleValue,
} from "@/entities/capsule";
import { addTagToCapsule, getTagsByCapsule, insertTag } from "@/entities/tag";
import { getLinksFrom, insertLink } from "@/entities/link";
import { getRemindersByCapsule, insertReminder } from "@/entities/reminder";
import {
  getAttachmentsByCapsule,
  insertAttachment,
} from "@/entities/attachment";
import { getAllAuditEntries } from "@/entities/audit";
import { readAppFileBytes, writeAppFileBytes } from "@/shared/fs";
import { textFromBytes, textToBytes, unzipFiles, zipFiles } from "@/shared/zip";
import { PortableFormatError } from "@/shared/format";
import { __resetFsMock, __fileContents } from "@/__mocks__/expo-file-system";
import { __resetSqliteMock } from "@/__mocks__/expo-sqlite";
import { cancelScheduledNotificationAsync } from "@/__mocks__/expo-notifications";
import { createBackupBundle, restoreBackupBundle } from "../index";

let db: SQLiteDatabase;

function seed() {
  insertConversation(db, {
    id: "conv1",
    title: "Trip",
    modelId: null,
    personaId: null,
    activeLeafId: "m1",
    createdAt: 1,
    updatedAt: 1,
  });
  insertMessage(db, {
    id: "m1",
    conversationId: "conv1",
    parentId: null,
    role: "user",
    content: "look",
    tokenCount: 0,
    createdAt: 1,
  });
  insertMessageImage(db, {
    messageId: "m1",
    conversationId: "conv1",
    path: writeAppFileBytes(
      ["chat-images", "conv1"],
      "m1-photo.jpg",
      new Uint8Array([5, 6]),
    ),
  });

  insertCapsuleType(db, {
    id: "t1",
    name: "Receipt",
    description: null,
    createdAt: 1,
    updatedAt: 1,
  });
  insertCapsuleField(db, {
    id: "f1",
    capsuleTypeId: "t1",
    name: "Scan",
    fieldType: "attachment",
    config: null,
    sortOrder: 0,
    required: false,
    createdAt: 1,
    updatedAt: 1,
  });
  insertCapsuleField(db, {
    id: "f2",
    capsuleTypeId: "t1",
    name: "Shop",
    fieldType: "text",
    config: null,
    sortOrder: 1,
    required: false,
    createdAt: 1,
    updatedAt: 1,
  });
  for (const id of ["c1", "c2"]) {
    insertCapsule(db, {
      id,
      capsuleTypeId: "t1",
      title: id,
      parentCapsuleId: null,
      createdAt: 1,
      updatedAt: 1,
    });
  }
  upsertCapsuleValue(db, {
    id: "v1",
    capsuleId: "c1",
    fieldId: "f2",
    value: "Ikea",
    createdAt: 1,
    updatedAt: 1,
  });
  insertTag(db, { id: "tag1", name: "home", createdAt: 1, updatedAt: 1 });
  addTagToCapsule(db, "c1", "tag1", 1);
  insertLink(db, {
    id: "l1",
    fromCapsuleId: "c1",
    toCapsuleId: "c2",
    fieldId: null,
    label: null,
    createdAt: 1,
  });
  insertReminder(db, {
    id: "r1",
    capsuleId: "c1",
    remindAt: 5_000,
    message: null,
    notificationId: "os-1",
    createdAt: 1,
    updatedAt: 1,
  });
  insertAttachment(db, {
    id: "a1",
    capsuleId: "c1",
    fieldId: "f1",
    filename: "scan.pdf",
    storagePath: writeAppFileBytes(
      ["attachments", "c1"],
      "a1-scan.pdf",
      new Uint8Array([1, 2, 3]),
    ),
    mimeType: "application/pdf",
    size: 3,
    createdAt: 1,
  });
}

beforeEach(() => {
  __resetFsMock();
  __resetSqliteMock();
  _resetDbForTesting();
  db = openDb();
  runMigrations(db, migrations);
});

/** Start over on an empty device, as if restoring onto a new phone. */
function freshDevice() {
  _resetDbForTesting();
  __resetSqliteMock();
  db = openDb();
  runMigrations(db, migrations);
}

describe("createBackupBundle / restoreBackupBundle — round trip", () => {
  it("restores conversations, chat images, capsules, values, tags, links, reminders and attachments under their original ids", async () => {
    seed();
    const bundle = await createBackupBundle(db);
    const files = new Map(__fileContents);
    freshDevice();
    __resetFsMock();

    await restoreBackupBundle(db, bundle);

    expect(getAllConversations(db).map((c) => c.id)).toEqual(["conv1"]);
    expect(getMessagesByConversation(db, "conv1").map((m) => m.id)).toEqual([
      "m1",
    ]);
    const image = getImageByMessage(db, "m1")!;
    expect(Array.from(await readAppFileBytes(image.path))).toEqual([5, 6]);

    expect(getAllCapsuleTypes(db).map((t) => t.id)).toEqual(["t1"]);
    expect(
      getFieldsByCapsuleType(db, "t1")
        .map((f) => f.id)
        .sort(),
    ).toEqual(["f1", "f2"]);
    expect(
      getAllCapsules(db)
        .map((c) => c.id)
        .sort(),
    ).toEqual(["c1", "c2"]);
    expect(getValuesByCapsule(db, "c1")[0].value).toBe("Ikea");
    expect(getTagsByCapsule(db, "c1").map((t) => t.id)).toEqual(["tag1"]);
    expect(getLinksFrom(db, "c1").map((l) => l.toCapsuleId)).toEqual(["c2"]);
    const [reminder] = getRemindersByCapsule(db, "c1");
    expect(reminder.id).toBe("r1");
    expect(reminder.notificationId).toBeNull(); // OS ids don't travel
    const [att] = getAttachmentsByCapsule(db, "c1");
    expect(att.id).toBe("a1");
    expect(att.storagePath.startsWith("attachments/c1/")).toBe(true);
    expect(Array.from(await readAppFileBytes(att.storagePath))).toEqual([
      1, 2, 3,
    ]);
    expect(files.size).toBeGreaterThan(0);
  });

  it("replaces what was there: data not in the backup is gone, and so are its files", async () => {
    seed();
    const bundle = await createBackupBundle(db);
    insertCapsule(db, {
      id: "stray",
      capsuleTypeId: "t1",
      title: "stray",
      parentCapsuleId: null,
      createdAt: 1,
      updatedAt: 1,
    });
    const strayFile = writeAppFileBytes(
      ["attachments", "stray"],
      "x.bin",
      new Uint8Array([9]),
    );
    insertAttachment(db, {
      id: "ax",
      capsuleId: "stray",
      fieldId: "f1",
      filename: "x.bin",
      storagePath: strayFile,
      mimeType: null,
      size: 1,
      createdAt: 1,
    });

    await restoreBackupBundle(db, bundle);

    expect(
      getAllCapsules(db)
        .map((c) => c.id)
        .sort(),
    ).toEqual(["c1", "c2"]);
    expect(
      [...__fileContents.keys()].some((uri) => uri.includes("/stray/")),
    ).toBe(false);
  });

  it("restoring the same bundle twice leaves exactly one copy of everything", async () => {
    seed();
    const bundle = await createBackupBundle(db);
    await restoreBackupBundle(db, bundle);
    await restoreBackupBundle(db, bundle);
    expect(getAllCapsules(db)).toHaveLength(2);
    expect(getAttachmentsByCapsule(db, "c1")).toHaveLength(1);
    const attachmentFiles = [...__fileContents.keys()].filter((u) =>
      u.includes("/attachments/"),
    );
    expect(attachmentFiles).toHaveLength(1);
  });

  it("writes an export entry on backup and a wipe entry on restore", async () => {
    seed();
    const bundle = await createBackupBundle(db);
    await restoreBackupBundle(db, bundle);
    const actions = getAllAuditEntries(db).map((e) => e.action);
    expect(actions).toContain("export");
    expect(actions).toContain("wipe");
  });
});

describe("restoreBackupBundle — refuses before changing anything", () => {
  it("rejects something that isn't a backup bundle", async () => {
    seed();
    await expect(
      restoreBackupBundle(db, zipFiles({ "x.txt": textToBytes("x") })),
    ).rejects.toThrow(PortableFormatError);
    expect(getAllCapsules(db)).toHaveLength(2);
  });

  it("rejects a backup whose ids aren't safe to use as folder names", async () => {
    seed();
    const entries = unzipFiles(await createBackupBundle(db));
    const json = JSON.parse(textFromBytes(entries["backup.json"])) as {
      data: { capsules: { capsules: { capsule: { id: string } }[] } };
    };
    json.data.capsules.capsules[0].capsule.id = "../../evil";
    entries["backup.json"] = textToBytes(JSON.stringify(json));
    const before = new Set(__fileContents.keys());

    await expect(restoreBackupBundle(db, zipFiles(entries))).rejects.toThrow(
      PortableFormatError,
    );

    expect(
      getAllCapsules(db)
        .map((c) => c.id)
        .sort(),
    ).toEqual(["c1", "c2"]);
    expect(new Set(__fileContents.keys())).toEqual(before);
  });

  it("if the database part fails, the current data and files are untouched and the new files are removed", async () => {
    seed();
    const bundle = await createBackupBundle(db);
    const before = new Set(__fileContents.keys());
    db.execSync("DROP TABLE reminders;"); // the transaction fails part-way (clearing reminders)

    await expect(restoreBackupBundle(db, bundle)).rejects.toThrow();

    expect(
      getAllCapsules(db)
        .map((c) => c.id)
        .sort(),
    ).toEqual(["c1", "c2"]);
    expect(getAllConversations(db).map((c) => c.id)).toEqual(["conv1"]);
    expect(new Set(__fileContents.keys())).toEqual(before);
  });
});

describe("restoreBackupBundle — checker round 1", () => {
  it("cancels the OS notifications of the reminders it replaces", async () => {
    seed(); // reminder r1 has OS notification "os-1"
    const bundle = await createBackupBundle(db);
    (cancelScheduledNotificationAsync as jest.Mock).mockClear();

    await restoreBackupBundle(db, bundle);

    expect(cancelScheduledNotificationAsync).toHaveBeenCalledWith("os-1");
  });

  it("gives every restored file its own name, even when two would sanitize alike", async () => {
    seed();
    insertAttachment(db, {
      id: "a2",
      capsuleId: "c1",
      fieldId: "f1",
      filename: "scan.pdf",
      storagePath: writeAppFileBytes(
        ["attachments", "c1"],
        "a2-scan.pdf",
        new Uint8Array([4]),
      ),
      mimeType: null,
      size: 1,
      createdAt: 1,
    });
    const entries = unzipFiles(await createBackupBundle(db));
    const json = JSON.parse(textFromBytes(entries["backup.json"])) as {
      data: {
        capsules: {
          capsules: { attachments: { attachment: { id: string } }[] }[];
        };
      };
    };
    // ids that sanitize to the same file name
    json.data.capsules.capsules[0].attachments[0].attachment.id = "x\u00e9";
    json.data.capsules.capsules[0].attachments[1].attachment.id = "x_";
    entries["backup.json"] = textToBytes(JSON.stringify(json));

    await restoreBackupBundle(db, zipFiles(entries));

    const paths = getAttachmentsByCapsule(db, "c1").map((a) => a.storagePath);
    expect(new Set(paths).size).toBe(2);
  });

  it("skips an image that claims a message from another conversation", async () => {
    seed();
    const entries = unzipFiles(await createBackupBundle(db));
    const json = JSON.parse(textFromBytes(entries["backup.json"])) as {
      data: { conversations: { images: { messageId: string }[] }[] };
    };
    json.data.conversations[0].images[0].messageId = "m-elsewhere";
    entries["backup.json"] = textToBytes(JSON.stringify(json));

    await restoreBackupBundle(db, zipFiles(entries));

    expect(getImageByMessage(db, "m-elsewhere")).toBeNull();
  });
});
