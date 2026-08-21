// Tests for step 6.8 (attachment field type — metadata layer only) —
// written before implementation (TDD)
import type { SQLiteDatabase } from "expo-sqlite";
import { openDb, runMigrations, _resetDbForTesting } from "@/shared/db";
import {
  attachmentsMigration,
  deleteAttachment,
  deleteAttachmentsByCapsule,
  getAttachmentById,
  getAttachmentsByCapsuleField,
  insertAttachment,
  type Attachment,
} from "../index";

const makeAttachment = (overrides: Partial<Attachment> = {}): Attachment => ({
  id: `att-${Math.random().toString(36).slice(2)}`,
  capsuleId: "c-1",
  fieldId: "f-photo",
  filename: "photo.jpg",
  localUri: "file:///docs/photo.jpg",
  mimeType: "image/jpeg",
  size: 1024,
  createdAt: 1000,
  ...overrides,
});

let db: SQLiteDatabase;

beforeEach(() => {
  _resetDbForTesting();
  db = openDb();
  runMigrations(db, [attachmentsMigration]);
});

describe("entities/attachment — CRUD", () => {
  it("inserts and retrieves an attachment by id", () => {
    const attachment = makeAttachment();
    insertAttachment(db, attachment);
    const found = getAttachmentById(db, attachment.id);
    expect(found?.filename).toBe("photo.jpg");
    expect(found?.localUri).toBe("file:///docs/photo.jpg");
    expect(found?.mimeType).toBe("image/jpeg");
    expect(found?.size).toBe(1024);
  });

  it("getAttachmentById returns null for an unknown id", () => {
    expect(getAttachmentById(db, "missing")).toBeNull();
  });

  it("stores a null mimeType and null size as null, not the string 'null'", () => {
    const attachment = makeAttachment({ mimeType: null, size: null });
    insertAttachment(db, attachment);
    const found = getAttachmentById(db, attachment.id);
    expect(found?.mimeType).toBeNull();
    expect(found?.size).toBeNull();
  });

  it("deleteAttachment removes the record", () => {
    const attachment = makeAttachment();
    insertAttachment(db, attachment);
    deleteAttachment(db, attachment.id);
    expect(getAttachmentById(db, attachment.id)).toBeNull();
  });

  it("deleting an unknown attachment id does not throw", () => {
    expect(() => deleteAttachment(db, "missing")).not.toThrow();
  });
});

describe("entities/attachment — getAttachmentsByCapsuleField", () => {
  it("scopes to one specific attachment field, ignoring a different field on the same capsule", () => {
    insertAttachment(
      db,
      makeAttachment({ id: "a-1", capsuleId: "c-1", fieldId: "f-photo" }),
    );
    insertAttachment(
      db,
      makeAttachment({ id: "a-2", capsuleId: "c-1", fieldId: "f-receipt" }),
    );
    expect(
      getAttachmentsByCapsuleField(db, "c-1", "f-photo").map((a) => a.id),
    ).toEqual(["a-1"]);
  });

  it("returns multiple attachments on the same field in insertion order", () => {
    insertAttachment(
      db,
      makeAttachment({
        id: "a-1",
        fieldId: "f-photo",
        createdAt: 1000,
        filename: "first.jpg",
      }),
    );
    insertAttachment(
      db,
      makeAttachment({
        id: "a-2",
        fieldId: "f-photo",
        createdAt: 2000,
        filename: "second.jpg",
      }),
    );
    expect(
      getAttachmentsByCapsuleField(db, "c-1", "f-photo").map((a) => a.id),
    ).toEqual(["a-1", "a-2"]);
  });

  it("a field with no attachments yet returns an empty array, not an error", () => {
    expect(getAttachmentsByCapsuleField(db, "c-1", "f-photo")).toEqual([]);
  });
});

describe("entities/attachment — deleteAttachmentsByCapsule cascade helper", () => {
  it("removes every attachment belonging to one capsule, across all its fields", () => {
    insertAttachment(
      db,
      makeAttachment({ id: "a-1", capsuleId: "c-1", fieldId: "f-photo" }),
    );
    insertAttachment(
      db,
      makeAttachment({ id: "a-2", capsuleId: "c-1", fieldId: "f-receipt" }),
    );
    deleteAttachmentsByCapsule(db, "c-1");
    expect(getAttachmentsByCapsuleField(db, "c-1", "f-photo")).toEqual([]);
    expect(getAttachmentsByCapsuleField(db, "c-1", "f-receipt")).toEqual([]);
  });

  it("leaves another capsule's attachments intact", () => {
    insertAttachment(
      db,
      makeAttachment({ id: "a-1", capsuleId: "c-1", fieldId: "f-photo" }),
    );
    insertAttachment(
      db,
      makeAttachment({ id: "a-2", capsuleId: "c-2", fieldId: "f-photo" }),
    );
    deleteAttachmentsByCapsule(db, "c-1");
    expect(
      getAttachmentsByCapsuleField(db, "c-2", "f-photo").map((a) => a.id),
    ).toEqual(["a-2"]);
  });
});
