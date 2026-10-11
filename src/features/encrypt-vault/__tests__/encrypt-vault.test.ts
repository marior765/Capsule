// Tests for step 4.1 — written before implementation (TDD)
// "hard" depth per CLAUDE.md's create-tests guidance for crypto.
import { __resetSecureStoreMock } from "@/__mocks__/expo-secure-store";
import { _resetDbForTesting, openDb, runMigrations } from "@/shared/db";
import { auditMigration } from "@/entities/audit";
import {
  isVaultConfigured,
  setUpVault,
  unlockVault,
  forgetVaultKeys,
  VaultUnlockError,
} from "../index";

beforeEach(() => {
  __resetSecureStoreMock();
  _resetDbForTesting();
  // Mirrors production reality: Providers always runs auditMigration before
  // anything else touches the db (src/app/providers/index.tsx) — the vault
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

// 4.7: erasing everything (data, files, both database files, with an audit
// entry) is the app layer's eraseEverything, tested there and in wipe-data;
// the vault's own part is only forgetting its keys.
describe("forgetVaultKeys", () => {
  it("clears vault configuration — isVaultConfigured is false afterward", async () => {
    await setUpVault("correct horse battery staple");
    await forgetVaultKeys();
    await expect(isVaultConfigured()).resolves.toBe(false);
  });

  it("allows setting up a brand new vault afterward, with a different master key than before", async () => {
    const firstKey = await setUpVault("correct horse battery staple");
    await forgetVaultKeys();
    const secondKey = await setUpVault("a completely different passphrase");
    expect(secondKey).not.toBe(firstKey);
  });
});
