// Tests for 6.8 (attachment files) — written before implementation (TDD)
import type { SQLiteDatabase } from "expo-sqlite";
import { openDb, runMigrations, _resetDbForTesting } from "@/shared/db";
import {
  attachmentsMigration,
  getAttachmentById,
  getAttachmentsByCapsuleField,
} from "@/entities/attachment";
import {
  File,
  __copiedFiles,
  __deletedUris,
  __missingUris,
  __resetFsMock,
} from "@/__mocks__/expo-file-system";
import { addAttachment, attachmentFileUri, removeAttachment } from "../index";

let db: SQLiteDatabase;

beforeEach(() => {
  _resetDbForTesting();
  __resetFsMock();
  db = openDb();
  runMigrations(db, [attachmentsMigration]);
});

const picked = {
  capsuleId: "c1",
  fieldId: "f-photo",
  sourceUri: "file:///cache/DocumentPicker/IMG_001.jpg",
  filename: "IMG 001.jpg",
  mimeType: "image/jpeg",
  size: 2048,
};

describe("addAttachment", () => {
  it("copies the picked file into app storage under the capsule's folder and records it", async () => {
    const attachment = await addAttachment(db, picked);

    expect(__copiedFiles).toHaveLength(1);
    expect(__copiedFiles[0].from).toBe(picked.sourceUri);
    // Stored RELATIVE to the document directory — iOS can move the app's
    // container on update/restore, so an absolute file:// URI would go stale.
    expect(attachment.storagePath.startsWith("attachments/c1/")).toBe(true);
    expect(attachment.storagePath).not.toContain("file://");
    expect(attachmentFileUri(attachment)).toBe(__copiedFiles[0].to);

    expect(getAttachmentById(db, attachment.id)).toEqual(attachment);
    expect(attachment).toMatchObject({
      capsuleId: "c1",
      fieldId: "f-photo",
      filename: "IMG 001.jpg",
      mimeType: "image/jpeg",
      size: 2048,
    });
  });

  it("makes the on-disk name unique and filesystem-safe while keeping the original name for display", async () => {
    const a = await addAttachment(db, {
      ...picked,
      filename: "../../etc/passwd",
    });
    const b = await addAttachment(db, {
      ...picked,
      filename: "../../etc/passwd",
    });

    expect(a.storagePath).not.toBe(b.storagePath);
    const onDisk = a.storagePath.slice("attachments/c1/".length);
    expect(onDisk).not.toContain("/");
    expect(onDisk).toMatch(/^[A-Za-z0-9._-]+$/);
    expect(a.filename).toBe("../../etc/passwd");
  });

  it("writes no row if the copy fails", async () => {
    const spy = jest
      .spyOn(File.prototype, "copy")
      .mockRejectedValueOnce(new Error("disk full"));

    await expect(addAttachment(db, picked)).rejects.toThrow("disk full");
    expect(getAttachmentsByCapsuleField(db, "c1", "f-photo")).toEqual([]);
    spy.mockRestore();
  });

  it("deletes the copied file again if recording it fails — no orphaned bytes", async () => {
    // A real insert failure: a database without the attachments table.
    _resetDbForTesting();
    const brokenDb = openDb();

    await expect(addAttachment(brokenDb, picked)).rejects.toThrow(
      /no such table/,
    );
    expect(__copiedFiles).toHaveLength(1);
    expect(__deletedUris).toEqual([__copiedFiles[0].to]);
  });
});

describe("addAttachment — picker temporary copy", () => {
  it("deletes the picker's temporary cache copy after a successful add", async () => {
    await addAttachment(db, { ...picked, sourceIsTemporaryCopy: true });
    expect(__deletedUris).toEqual([picked.sourceUri]);
  });

  it("leaves the source alone when it isn't a temporary copy", async () => {
    await addAttachment(db, picked);
    expect(__deletedUris).toEqual([]);
  });

  it("deletes the temporary copy even when the add fails — nothing reuses it, so keeping it would only orphan it", async () => {
    _resetDbForTesting();
    const brokenDb = openDb();
    await expect(
      addAttachment(brokenDb, { ...picked, sourceIsTemporaryCopy: true }),
    ).rejects.toThrow();
    expect(__deletedUris).toContain(picked.sourceUri);
  });

  it("deletes the temporary copy when the copy itself fails", async () => {
    const spy = jest
      .spyOn(File.prototype, "copy")
      .mockRejectedValueOnce(new Error("disk full"));
    await expect(
      addAttachment(db, { ...picked, sourceIsTemporaryCopy: true }),
    ).rejects.toThrow("disk full");
    expect(__deletedUris).toEqual([picked.sourceUri]);
    spy.mockRestore();
  });

  it("still succeeds if deleting the temporary copy fails (the OS clears its cache eventually)", async () => {
    const spy = jest
      .spyOn(File.prototype, "delete")
      .mockImplementationOnce(() => {
        throw new Error("busy");
      });
    const attachment = await addAttachment(db, {
      ...picked,
      sourceIsTemporaryCopy: true,
    });
    expect(getAttachmentById(db, attachment.id)).not.toBeNull();
    spy.mockRestore();
  });
});

describe("removeAttachment", () => {
  it("deletes the stored file and then the record", async () => {
    const attachment = await addAttachment(db, picked);
    removeAttachment(db, attachment.id);

    expect(__deletedUris).toEqual([attachmentFileUri(attachment)]);
    expect(getAttachmentById(db, attachment.id)).toBeNull();
  });

  it("still removes the record when the file is already gone", async () => {
    const attachment = await addAttachment(db, picked);
    __missingUris.add(attachmentFileUri(attachment));
    removeAttachment(db, attachment.id);
    expect(getAttachmentById(db, attachment.id)).toBeNull();
  });

  it("is a no-op for an unknown id", () => {
    expect(() => removeAttachment(db, "nope")).not.toThrow();
    expect(__deletedUris).toEqual([]);
  });
});
