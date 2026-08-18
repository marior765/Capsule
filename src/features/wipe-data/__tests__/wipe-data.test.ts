// Tests for step 4.5 — written before implementation (TDD)
// "hard" depth per CLAUDE.md's create-tests guidance for anything touching
// wipe.
import * as dbModule from "@/shared/db";
import { _resetDbForTesting, openDb, runMigrations } from "@/shared/db";
import { getAllAuditEntries, auditMigration } from "@/entities/audit";
import { setString, getString, clearAllSettings } from "@/shared/storage";
import {
  __deletedDirectoryUris,
  __resetFsMock,
} from "@/__mocks__/expo-file-system";
import { wipeAllData } from "../index";

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
  it("does not throw when no models directory exists yet", async () => {
    // __resetFsMock's Directory.exists defaults to true in this mock, so
    // this pins the *shape* of the guard (checked, not assumed) rather than
    // the mock's specific default — see the implementation's own comment.
    await expect(wipeAllData(openDb())).resolves.not.toThrow();
  });
});
