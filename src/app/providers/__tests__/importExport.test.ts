// Tests for 5.5 part D (what the Import & Export screen does) — written
// before implementation (TDD). The screen only adds buttons and confirms.
import type { SQLiteDatabase } from "expo-sqlite";
import { openDb, runMigrations, _resetDbForTesting } from "@/shared/db";
import { migrations } from "../migrations";
import { getAllCapsules, insertCapsule } from "@/entities/capsule";
import { insertCapsuleType } from "@/entities/capsule-type";
import { getAllConversations } from "@/entities/conversation";
import { getReminderById, insertReminder } from "@/entities/reminder";
import { readFileUriBytes, writeCacheFileBytes } from "@/shared/fs";
import { textFromBytes, textToBytes, unzipFiles } from "@/shared/zip";
import {
  __resetFsMock,
  __deletedUris,
  __deletedDirectoryUris,
} from "@/__mocks__/expo-file-system";
import { __resetSqliteMock } from "@/__mocks__/expo-sqlite";
import {
  __resetNotificationsMock,
  getPermissionsAsync,
} from "@/__mocks__/expo-notifications";
import { createBackupBundle } from "@/features/backup-restore";
import { exportFileName, exportForSharing, importFile } from "../importExport";

let db: SQLiteDatabase;

beforeEach(() => {
  __resetFsMock();
  __resetSqliteMock();
  __resetNotificationsMock();
  _resetDbForTesting();
  db = openDb();
  runMigrations(db, migrations);
  insertCapsuleType(db, {
    id: "t1",
    name: "Book",
    description: null,
    createdAt: 1,
    updatedAt: 1,
  });
  insertCapsule(db, {
    id: "c1",
    capsuleTypeId: "t1",
    title: "Dune",
    parentCapsuleId: null,
    createdAt: 1,
    updatedAt: 1,
  });
});

const picked = (name: string, bytes: Uint8Array) => ({
  uri: writeCacheFileBytes(name, bytes),
  name,
  mimeType: null,
  size: bytes.length,
});

describe("exportFileName", () => {
  it("names files plainly, with the date", () => {
    const now = new Date(2026, 9, 11, 14, 0);
    expect(exportFileName("backup", now)).toBe("Capsule backup 2026-10-11.zip");
    expect(exportFileName("capsules", now)).toBe(
      "Capsule capsules 2026-10-11.zip",
    );
    expect(exportFileName("conversations", now)).toBe(
      "Capsule conversations 2026-10-11.json",
    );
  });
});

describe("exportForSharing", () => {
  it("writes the full backup to a temporary file and says what it is", async () => {
    const { uri, mimeType } = await exportForSharing(db, "backup");
    expect(mimeType).toBe("application/zip");
    const entries = unzipFiles(await readFileUriBytes(uri));
    expect(textFromBytes(entries["backup.json"])).toContain('"Dune"');
  });

  it("exports conversations as JSON", async () => {
    const { uri, mimeType } = await exportForSharing(db, "conversations");
    expect(mimeType).toBe("application/json");
    expect(textFromBytes(await readFileUriBytes(uri))).toContain('"kind"');
  });
});

describe("importFile", () => {
  it("restores a full backup, schedules its future reminders, and asks for a restart", async () => {
    insertReminder(db, {
      id: "r1",
      capsuleId: "c1",
      remindAt: Date.now() + 3_600_000,
      message: null,
      notificationId: null,
      createdAt: 1,
      updatedAt: 1,
    });
    const bundle = await createBackupBundle(db);

    const outcome = await importFile(db, "backup", picked("b.zip", bundle));

    expect(outcome?.restartNeeded).toBe(true);
    expect(getReminderById(db, "r1")!.notificationId).not.toBeNull();
  });

  it("imports CSV rows as capsules of a type named after the file, and reports the count", async () => {
    const outcome = await importFile(
      db,
      "csv",
      picked(
        "Books.csv",
        textToBytes("Title,Author\nDune,Herbert\nEmma,Austen\n"),
      ),
    );
    expect(outcome?.message).toBe("Imported 2 capsules.");
    expect(outcome?.capsuleIds).toHaveLength(2);
    expect(getAllCapsules(db)).toHaveLength(3);
  });

  it("imports Markdown as a note capsule", async () => {
    const outcome = await importFile(
      db,
      "markdown",
      picked("Ideas.md", textToBytes("# Ideas\nfly")),
    );
    expect(outcome?.message).toBe("Imported 1 capsule.");
  });

  it("imports a Capsule conversations export", async () => {
    const { uri } = await exportForSharing(db, "conversations");
    const bytes = await readFileUriBytes(uri);
    const outcome = await importFile(
      db,
      "conversations",
      picked("c.json", bytes),
    );
    expect(outcome?.message).toBe("Imported 0 conversations.");
    expect(getAllConversations(db)).toHaveLength(0);
  });

  it("always deletes the picker's temporary copy — after success and after failure", async () => {
    const good = picked("Books.csv", textToBytes("Title\nDune\n"));
    await importFile(db, "csv", good);
    expect(__deletedUris).toContain(good.uri);

    const bad = picked("broken.zip", textToBytes("not a zip"));
    await expect(importFile(db, "capsules", bad)).rejects.toThrow();
    expect(__deletedUris).toContain(bad.uri);
  });
});

// Checker round 1 (5.5 part D)
describe("importFile — cancel, errors, reminders (checker)", () => {
  it("deletes the picked backup's temporary copy when the restore is cancelled", async () => {
    const bundle = await createBackupBundle(db);
    const file = picked("b.zip", bundle);
    const outcome = await importFile(db, "backup", file, {
      confirm: async () => false,
    });
    expect(outcome).toBeNull();
    expect(__deletedUris).toContain(file.uri);
    expect(getAllCapsules(db)).toHaveLength(1);
  });

  it("explains a file of the wrong kind in plain words", async () => {
    await expect(
      importFile(db, "csv", picked("x.csv", new Uint8Array([]))),
    ).rejects.toThrow("This doesn't look like a CSV file.");
    await expect(
      importFile(db, "capsules", picked("x.zip", textToBytes("nope"))),
    ).rejects.toThrow("This doesn't look like a Capsule capsules export.");
  });

  it("doesn't touch reminders (or ask for notifications) on a CSV import", async () => {
    insertReminder(db, {
      id: "r1",
      capsuleId: "c1",
      remindAt: Date.now() + 3_600_000,
      message: null,
      notificationId: null,
      createdAt: 1,
      updatedAt: 1,
    });
    await importFile(
      db,
      "csv",
      picked("Books.csv", textToBytes("Title\nDune\n")),
    );
    expect(getReminderById(db, "r1")!.notificationId).toBeNull();
  });

  it("still reports a restore as done (and asks for the restart) if rescheduling reminders fails", async () => {
    const bundle = await createBackupBundle(db);
    (getPermissionsAsync as jest.Mock).mockRejectedValueOnce(new Error("boom"));
    insertReminder(db, {
      id: "r1",
      capsuleId: "c1",
      remindAt: Date.now() + 3_600_000,
      message: null,
      notificationId: null,
      createdAt: 1,
      updatedAt: 1,
    });
    const again = await createBackupBundle(db);
    void bundle;
    const outcome = await importFile(db, "backup", picked("b.zip", again));
    expect(outcome?.restartNeeded).toBe(true);
  });
});

describe("exports don't linger (checker)", () => {
  it("writes exports into their own cache folder, clearing older exports first", async () => {
    const first = await exportForSharing(db, "conversations");
    expect(first.uri.startsWith("file:///cache/Exports/")).toBe(true);
    await exportForSharing(db, "conversations", new Date(2030, 0, 1));
    expect(__deletedDirectoryUris).toContain("file:///cache/Exports");
  });
});
