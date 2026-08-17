// Tests for step 4.1 — written before implementation (TDD)
// "hard" depth per CLAUDE.md's create-tests guidance for crypto.
import { __resetSecureStoreMock } from "@/__mocks__/expo-secure-store";
import * as dbModule from "@/shared/db";
import { _resetDbForTesting, openDb, runMigrations } from "@/shared/db";
import { getAllAuditEntries, auditMigration } from "@/entities/audit";
import {
  isVaultConfigured,
  setUpVault,
  unlockVault,
  resetVault,
  VaultUnlockError,
} from "../index";

beforeEach(() => {
  __resetSecureStoreMock();
  _resetDbForTesting();
  // Mirrors production reality: Providers always runs auditMigration before
  // anything else touches the db (src/app/providers/index.tsx) — resetVault
  // relies on that table already existing by the time it can plausibly run.
  runMigrations(openDb(), [auditMigration]);
});

describe("isVaultConfigured", () => {
  it("is false before any vault has been set up", async () => {
    await expect(isVaultConfigured()).resolves.toBe(false);
  });

  it("is true after setUpVault succeeds", async () => {
    await setUpVault("correct horse battery staple");
    await expect(isVaultConfigured()).resolves.toBe(true);
  });
});

describe("setUpVault", () => {
  it("rejects an empty passphrase", async () => {
    await expect(setUpVault("")).rejects.toThrow();
  });

  it("rejects a whitespace-only passphrase", async () => {
    await expect(setUpVault("   ")).rejects.toThrow();
  });

  it("returns a 32-byte (AES-256) master key, hex-encoded", async () => {
    const masterKeyHex = await setUpVault("correct horse battery staple");
    expect(masterKeyHex).toHaveLength(64);
    expect(masterKeyHex).toMatch(/^[0-9a-f]{64}$/);
  });

  it("refuses to overwrite an already-configured vault", async () => {
    await setUpVault("correct horse battery staple");
    await expect(setUpVault("a different passphrase")).rejects.toThrow();
  });
});

describe("unlockVault", () => {
  it("returns the exact same master key setUpVault produced, given the correct passphrase", async () => {
    const masterKeyHex = await setUpVault("correct horse battery staple");
    await expect(unlockVault("correct horse battery staple")).resolves.toBe(
      masterKeyHex,
    );
  });

  it("throws VaultUnlockError given the wrong passphrase", async () => {
    await setUpVault("correct horse battery staple");
    await expect(unlockVault("wrong passphrase")).rejects.toBeInstanceOf(
      VaultUnlockError,
    );
  });

  it("throws VaultUnlockError when no vault has been set up yet", async () => {
    await expect(unlockVault("anything")).rejects.toBeInstanceOf(
      VaultUnlockError,
    );
  });
});

describe("resetVault", () => {
  it("clears vault configuration — isVaultConfigured is false afterward", async () => {
    await setUpVault("correct horse battery staple");
    await resetVault();
    await expect(isVaultConfigured()).resolves.toBe(false);
  });

  it("deletes the underlying database so a fresh, unencrypted-or-differently-keyed one can be opened", async () => {
    const db1 = openDb();
    await resetVault();
    const db2 = openDb();
    expect(db2).not.toBe(db1);
  });

  it("allows setting up a brand new vault afterward, with a different master key than before", async () => {
    const firstKey = await setUpVault("correct horse battery staple");
    await resetVault();
    const secondKey = await setUpVault("a completely different passphrase");
    expect(secondKey).not.toBe(firstKey);
  });
});

describe("resetVault — audit logging", () => {
  // deleteDb() destroys the very database the audit entry was just written
  // into (see the module doc comment on resetVault for why), so the entry
  // can't be read back *after* resetVault returns — by then the connection
  // is closed. Stubbing deleteDb for just this test lets the entry be
  // observed while it still exists, which is the only way to prove the
  // write actually happened rather than trusting resetVault's own claim.
  it("writes a 'wipe' entry to the audit log before deleting the database", async () => {
    const deleteDbSpy = jest
      .spyOn(dbModule, "deleteDb")
      .mockImplementation(() => {});

    await setUpVault("correct horse battery staple");
    await resetVault();

    const entries = getAllAuditEntries(openDb());
    expect(entries).toContainEqual(expect.objectContaining({ action: "wipe" }));
    expect(deleteDbSpy).toHaveBeenCalled();

    deleteDbSpy.mockRestore();
  });

  it("has written the audit entry by the time deleteDb is called (ordering, not just eventually)", async () => {
    let entriesAtDeleteTime: unknown[] | null = null;
    const deleteDbSpy = jest
      .spyOn(dbModule, "deleteDb")
      .mockImplementation(() => {
        entriesAtDeleteTime = getAllAuditEntries(openDb());
      });

    await setUpVault("correct horse battery staple");
    await resetVault();

    expect(entriesAtDeleteTime).toContainEqual(
      expect.objectContaining({ action: "wipe" }),
    );

    deleteDbSpy.mockRestore();
  });
});
