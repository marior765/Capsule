// Tests for step 4.5 — written before implementation (TDD)
// "hard" depth per CLAUDE.md's create-tests guidance for anything touching
// wipe.
import * as dbModule from "@/shared/db";
import { _resetDbForTesting, openDb, runMigrations } from "@/shared/db";
import { getAllAuditEntries, auditMigration } from "@/entities/audit";
import { setString, getString, clearAllSettings } from "@/shared/storage";
import {
  __deletedDirectoryUris,
  __missingUris,
  __resetFsMock,
} from "@/__mocks__/expo-file-system";
import { wipeAllData } from "../index";
import {
  __resetNotificationsMock,
  cancelAllScheduledNotificationsAsync,
} from "@/__mocks__/expo-notifications";

beforeEach(() => {
  _resetDbForTesting();
  __resetFsMock();
  clearAllSettings();
  // Mirrors production reality (see encrypt-vault's resetVault tests): the
  // audit table already exists by the time a wipe could plausibly run.
  runMigrations(openDb(), [auditMigration]);
});

describe("wipeAllData — happy path", () => {
  it("deletes the models directory", async () => {
    await wipeAllData(openDb());
    expect(__deletedDirectoryUris).toContain("file:///document/models");
  });

  it("deletes the attachments directory (every capsule's attached files)", async () => {
    await wipeAllData(openDb());
    expect(__deletedDirectoryUris).toContain("file:///document/attachments");
  });

  it("deletes the speech-to-text models directory too", async () => {
    await wipeAllData(openDb());
    expect(__deletedDirectoryUris).toContain("file:///document/stt-models");
  });

  it("deletes the pickers' temporary cache folders", async () => {
    await wipeAllData(openDb());
    expect(__deletedDirectoryUris).toEqual(
      expect.arrayContaining([
        "file:///cache/DocumentPicker",
        "file:///cache/ImagePicker",
      ]),
    );
  });

  it("deletes the downloaded embedding model folder", async () => {
    await wipeAllData(openDb());
    expect(__deletedDirectoryUris).toContain(
      "file:///document/embedding-models",
    );
  });

  it("deletes the chat images folder", async () => {
    await wipeAllData(openDb());
    expect(__deletedDirectoryUris).toContain("file:///document/chat-images");
  });

  it("cancels every scheduled reminder notification", async () => {
    __resetNotificationsMock();
    await wipeAllData(openDb());
    expect(cancelAllScheduledNotificationsAsync).toHaveBeenCalled();
  });

  it("clears all MMKV settings", async () => {
    setString("some.setting", "value");
    await wipeAllData(openDb());
    expect(getString("some.setting")).toBeUndefined();
  });

  it("deletes the underlying database so a fresh one can be opened", async () => {
    const db1 = openDb();
    await wipeAllData(db1);
    const db2 = openDb();
    expect(db2).not.toBe(db1);
  });
});

describe("wipeAllData — audit logging", () => {
  // Same idiom as encrypt-vault's resetVault tests: deleteDb() destroys the
  // very database the audit entry was just written into, so the entry has
  // to be observed while it still exists — stub deleteDb for just this.
  it("writes a 'wipe' entry to the audit log before deleting the database", async () => {
    const deleteDbSpy = jest
      .spyOn(dbModule, "deleteDb")
      .mockImplementation(() => {});

    await wipeAllData(openDb());

    const entries = getAllAuditEntries(openDb());
    expect(entries).toContainEqual(expect.objectContaining({ action: "wipe" }));
    expect(deleteDbSpy).toHaveBeenCalled();

    deleteDbSpy.mockRestore();
  });

  it("has written the audit entry before deleteDb is called (ordering, not just eventually)", async () => {
    let entriesAtDeleteTime: unknown[] | null = null;
    const deleteDbSpy = jest
      .spyOn(dbModule, "deleteDb")
      .mockImplementation(() => {
        entriesAtDeleteTime = getAllAuditEntries(openDb());
      });

    await wipeAllData(openDb());

    expect(entriesAtDeleteTime).toContainEqual(
      expect.objectContaining({ action: "wipe" }),
    );

    deleteDbSpy.mockRestore();
  });
});

describe("wipeAllData — edge cases", () => {
  it("does not throw, and deletes nothing, when none of the file folders exist yet", async () => {
    __missingUris.add("file:///document/models");
    __missingUris.add("file:///document/stt-models");
    __missingUris.add("file:///document/attachments");
    __missingUris.add("file:///document/embedding-models");
    __missingUris.add("file:///document/chat-images");
    __missingUris.add("file:///cache/DocumentPicker");
    __missingUris.add("file:///cache/ImagePicker");
    await expect(wipeAllData(openDb())).resolves.not.toThrow();
    expect(__deletedDirectoryUris).toEqual([]);
  });
});
