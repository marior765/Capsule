// Tests for 6.9 (open a non-image attachment via the system share sheet) —
// written before implementation (TDD).
import type { SQLiteDatabase } from "expo-sqlite";
import { openDb, runMigrations, _resetDbForTesting } from "@/shared/db";
import { attachmentsMigration, insertAttachment } from "@/entities/attachment";
import { auditMigration, getAllAuditEntries } from "@/entities/audit";
import { writeAppFileBytes } from "@/shared/fs";
import { __resetFsMock, __missingUris } from "@/__mocks__/expo-file-system";
import {
  __resetSharingMock,
  __shareState,
  shareAsync,
} from "@/__mocks__/expo-sharing";
import { shareAttachment } from "../index";

let db: SQLiteDatabase;

beforeEach(() => {
  __resetFsMock();
  __resetSharingMock();
  _resetDbForTesting();
  db = openDb();
  runMigrations(db, [attachmentsMigration, auditMigration]);
  insertAttachment(db, {
    id: "a1",
    capsuleId: "c1",
    fieldId: "f1",
    filename: "Lease.pdf",
    storagePath: writeAppFileBytes(
      ["attachments", "c1"],
      "a1-Lease.pdf",
      new Uint8Array([1]),
    ),
    mimeType: "application/pdf",
    size: 1,
    createdAt: 1,
  });
});

describe("shareAttachment", () => {
  it("hands the stored file to the share sheet with its type and name", async () => {
    await shareAttachment(db, "a1");
    expect(shareAsync).toHaveBeenCalledWith(
      "file:///document/attachments/c1/a1-Lease.pdf",
      { mimeType: "application/pdf", dialogTitle: "Lease.pdf" },
    );
  });

  it("records it in the activity log — the file leaves Capsule", async () => {
    await shareAttachment(db, "a1");
    expect(getAllAuditEntries(db)).toContainEqual(
      expect.objectContaining({
        action: "export",
        detail: 'Opened attachment "Lease.pdf" in another app',
      }),
    );
  });

  it("says plainly when the file is gone, and logs nothing", async () => {
    __missingUris.add("file:///document/attachments/c1/a1-Lease.pdf");
    await expect(shareAttachment(db, "a1")).rejects.toThrow(
      "This file isn't on this device any more.",
    );
    expect(shareAsync).not.toHaveBeenCalled();
    expect(getAllAuditEntries(db)).toEqual([]);
  });

  it("rejects an unknown attachment", async () => {
    await expect(shareAttachment(db, "nope")).rejects.toThrow();
  });
});

it("logs nothing when sharing isn't available on the device (nothing left Capsule)", async () => {
  __shareState.available = false;
  await expect(shareAttachment(db, "a1")).rejects.toThrow(
    "Sharing isn't available on this device.",
  );
  expect(shareAsync).not.toHaveBeenCalled();
  expect(getAllAuditEntries(db)).toEqual([]);
});
