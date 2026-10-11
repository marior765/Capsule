import { getItemAsync, setItemAsync, deleteItemAsync } from "expo-secure-store";
import {
  closeDb,
  copyDatabaseTo,
  deleteDatabaseFile,
  deleteDb,
  openDatabaseFile,
  openDb,
} from "@/shared/db";
import type { SQLiteDatabase } from "expo-sqlite";
import { insertAuditEntry } from "@/entities/audit";
import { generateId } from "@/shared/lib";
import {
  randomHex,
  deriveKeyHex,
  encryptHex,
  decryptHex,
  type EncryptedPayload,
} from "@/shared/crypto";

/**
 * Envelope encryption for the app's at-rest master key (design decided
 * 2026-08-13 — see .claude/loop/BLOCKED.md's 4.1 history): a random master
 * vault key is generated once and never derived from anything the user
 * knows. It's wrapped (encrypted) by a key derived, via scrypt, from the
 * user's app-lock passphrase, and only the wrapped form is ever persisted —
 * in expo-secure-store, which is itself backed by Keychain/Keystore.
 * Neither the stored blob nor the passphrase alone unlocks the vault.
 *
 * `turnOnAppLock` / `turnOffAppLock` (4.6) move the whole database between
 * `shared/db`'s plain and encrypted files; `setUpVault` / `unlockVault`
 * only manage the key. Opening the encrypted database at launch with the
 * unlocked key is the app layer's job (the lock gate), not this module's.
 *
 * Audit logging: CLAUDE.md requires privacy-sensitive actions (export,
 * decrypt, wipe, model download) to write to entities/audit.
 *
 * `setUpVault`/`unlockVault` genuinely can't do this themselves — they run
 * *before* the caller has derived the key needed to open the (eventually)
 * encrypted database, so there is no db handle available yet at the point
 * they execute. That part of the reasoning holds. Logging those two events
 * is the responsibility of whatever wires this module to the app, once it
 * has an open `db` handle (see BLOCKED.md).
 *
 * `resetVault` is different: as things stand *today*, `Providers` (see
 * src/app/providers/index.tsx) calls `openDb()` unconditionally and
 * unkeyed at app start, before any vault gate exists — so a writable,
 * audit-capable db handle is always available by the time `resetVault`
 * could run. It uses that handle to log the wipe. **This does not make the
 * entry durable**: `resetVault` immediately calls `deleteDb()` afterward,
 * which deletes the entire database file — including the audit table the
 * entry was just written into. The write still has value (it survives a
 * crash or failure between the insert and the delete, and it is the
 * accurate record if `deleteDb` is ever changed to not drop the audit
 * table), but a *successful* reset leaves no durable trace of itself
 * anywhere. Whether wipe-adjacent audit entries need a home outside the
 * store being wiped (e.g. shared/storage/MMKV) is a real open question that
 * also applies to 4.5's future full wipe-data feature — flagged to
 * BLOCKED.md rather than decided unilaterally here.
 */

const VAULT_STORAGE_KEY = "encryptVault.wrappedMasterKey";
/** A second copy of the master key that the OS releases only after Face ID / Touch ID / fingerprint. */
const BIOMETRIC_KEY = "encryptVault.biometricMasterKey";
/** Plain marker that the biometric copy exists — checking it must not trigger a prompt. */
const BIOMETRIC_FLAG = "encryptVault.biometricUnlock";
const BIOMETRIC_PROMPT = "Unlock Capsule";
const MASTER_KEY_LENGTH_BYTES = 32;
const SALT_LENGTH_BYTES = 16;

type VaultRecord = EncryptedPayload & {
  saltHex: string;
};

/**
 * The change itself succeeded (lock on, or lock off) but the old copy of the
 * database couldn't be removed. Thrown so it is never mistaken for success
 * — a plaintext copy left behind matters — nor for a failed change.
 */
export class LeftoverCopyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LeftoverCopyError";
  }
}

export class VaultUnlockError extends Error {
  constructor(message = "Incorrect passphrase or corrupted vault") {
    super(message);
    this.name = "VaultUnlockError";
  }
}

export async function isVaultConfigured(): Promise<boolean> {
  const raw = await getItemAsync(VAULT_STORAGE_KEY);
  return raw !== null;
}

/**
 * Creates a brand-new vault: generates a random master key, wraps it under
 * a key derived from `passphrase`, and persists only the wrapped form.
 * Returns the raw master key, hex-encoded, ready to pass to
 * `openDb({ key })`. Refuses to run if a vault is already configured —
 * callers must `resetVault()` first, an explicit, separate action.
 */
export async function setUpVault(passphrase: string): Promise<string> {
  await assertCanSetUp(passphrase);
  const masterKeyHex = randomHex(MASTER_KEY_LENGTH_BYTES);
  await storeWrappedKey(passphrase, masterKeyHex);
  return masterKeyHex;
}

async function assertCanSetUp(passphrase: string): Promise<void> {
  if (!passphrase.trim()) {
    throw new Error("Passphrase must not be empty");
  }
  if (await isVaultConfigured()) {
    throw new Error(
      "Vault is already set up — call resetVault() first to replace it",
    );
  }
}

async function storeWrappedKey(
  passphrase: string,
  masterKeyHex: string,
): Promise<void> {
  const saltHex = randomHex(SALT_LENGTH_BYTES);
  const wrappingKeyHex = deriveKeyHex(passphrase, saltHex);
  const wrapped = encryptHex(masterKeyHex, wrappingKeyHex);
  const record: VaultRecord = { saltHex, ...wrapped };
  await setItemAsync(VAULT_STORAGE_KEY, JSON.stringify(record));
}

// The wrapped key goes last: if this stops partway, the vault still opens
// with the passphrase rather than leaving a biometric flag with no vault.
async function forgetKeys(): Promise<void> {
  for (const key of [BIOMETRIC_FLAG, BIOMETRIC_KEY, VAULT_STORAGE_KEY]) {
    await deleteItemAsync(key);
  }
}

type Shape = { tables: number; version: number | null };

/** A cheap fingerprint of a database: table count and newest migration. */
function shapeOf(db: SQLiteDatabase): Shape {
  const tables = db.getFirstSync(
    "SELECT count(*) AS n FROM sqlite_master WHERE type = 'table';",
  ) as { n: number };
  const version = db.getFirstSync(
    "SELECT max(version) AS v FROM _migrations;",
  ) as { v: number | null };
  return { tables: tables.n, version: version.v };
}

/** The copy must open with its key and look like the original. */
function assertSameShape(copy: SQLiteDatabase, expected: Shape): void {
  const actual = shapeOf(copy);
  if (
    actual.tables !== expected.tables ||
    actual.version !== expected.version
  ) {
    throw new Error("The copied database is incomplete");
  }
}

function tryDeleteDatabaseFile(file: "plain" | "vault"): void {
  try {
    deleteDatabaseFile(file);
  } catch {
    // best effort while undoing; the original error is what matters
  }
}

/**
 * Turns app lock on (4.6). The plain database is copied into the encrypted
 * file under a new random master key and closed straight away (so no write
 * can land in it after the copy); the key is saved wrapped by the
 * passphrase; the encrypted copy is opened and checked against the
 * original; then the plain file is deleted, and only after that is a
 * biometric copy of the key stored (the OS prompt can take a while — the
 * plaintext must not wait on it).
 *
 * Any failure before the plain file is deleted undoes the change: the plain
 * database is reopened as it was and the encrypted copy removed. One
 * exception: if the saved key can't be forgotten, the encrypted copy is
 * kept too — it is the file that key opens — and both files stay.
 */
export async function turnOnAppLock(
  passphrase: string,
  options: { biometrics: boolean },
): Promise<void> {
  await assertCanSetUp(passphrase);
  if (openDatabaseFile() === "vault") {
    throw new Error("The encrypted database is already open");
  }
  const expected = shapeOf(openDb());
  const masterKeyHex = randomHex(MASTER_KEY_LENGTH_BYTES);
  try {
    copyDatabaseTo("vault", masterKeyHex);
  } catch (error) {
    tryDeleteDatabaseFile("vault");
    throw error;
  }
  closeDb();

  let keySaved = false;
  try {
    await storeWrappedKey(passphrase, masterKeyHex);
    keySaved = true;
    const vault = openDb({ key: masterKeyHex });
    assertSameShape(vault, expected);
    insertAuditEntry(vault, {
      id: generateId(),
      action: "vault_setup",
      detail: "App lock turned on",
      createdAt: Date.now(),
    });
  } catch (error) {
    closeDb();
    let keysForgotten = !keySaved;
    if (keySaved) {
      try {
        await forgetKeys();
        keysForgotten = true;
      } catch {
        // the key stays — so must the file it opens
      }
    }
    if (keysForgotten) {
      tryDeleteDatabaseFile("vault");
      openDb();
    } else {
      // The saved key opens the vault at next launch, so this session
      // must write there too. Plain is the fallback if even that fails.
      try {
        openDb({ key: masterKeyHex });
      } catch {
        closeDb();
        openDb();
      }
    }
    throw error;
  }

  try {
    deleteDatabaseFile("plain");
  } catch {
    throw new LeftoverCopyError(
      "App lock is on, but the unencrypted copy couldn't be removed yet.",
    );
  }
  if (options.biometrics) {
    try {
      await storeBiometricKey(masterKeyHex);
    } catch {
      // No biometrics enrolled (or refused): the passphrase still unlocks.
    }
  }
}

/**
 * Turns app lock off without losing data (4.6): checks the passphrase,
 * copies the open encrypted database into the plain file, opens it and
 * checks it against the original, then forgets the keys and deletes the
 * encrypted file. Refuses unless the encrypted database is the open one. A
 * wrong passphrase, or any failure before the keys are forgotten, leaves
 * the lock on and the encrypted database open, unchanged.
 */
export async function turnOffAppLock(passphrase: string): Promise<void> {
  const masterKeyHex = await unlockVault(passphrase);
  if (openDatabaseFile() === null) openDb({ key: masterKeyHex });
  if (openDatabaseFile() !== "vault") {
    throw new Error("App lock can only be turned off while it's unlocked");
  }
  const expected = shapeOf(openDb());
  try {
    copyDatabaseTo("plain", null);
  } catch (error) {
    tryDeleteDatabaseFile("plain");
    throw error;
  }
  closeDb();

  try {
    const plain = openDb();
    assertSameShape(plain, expected);
    insertAuditEntry(plain, {
      id: generateId(),
      action: "vault_setup",
      detail: "App lock turned off",
      createdAt: Date.now(),
    });
    await forgetKeys();
  } catch (error) {
    closeDb();
    tryDeleteDatabaseFile("plain");
    openDb({ key: masterKeyHex });
    throw error;
  }
  try {
    deleteDatabaseFile("vault");
  } catch {
    throw new LeftoverCopyError(
      "App lock is off, but the encrypted copy couldn't be removed yet.",
    );
  }
}

async function storeBiometricKey(masterKeyHex: string): Promise<void> {
  await setItemAsync(BIOMETRIC_KEY, masterKeyHex, {
    requireAuthentication: true,
    authenticationPrompt: BIOMETRIC_PROMPT,
  });
  await setItemAsync(BIOMETRIC_FLAG, "1");
}

/** Whether the vault can be unlocked with biometrics. Never prompts. */
export async function hasBiometricUnlock(): Promise<boolean> {
  return (await getItemAsync(BIOMETRIC_FLAG)) === "1";
}

/**
 * Releases the master key through the OS biometric prompt (the key's
 * biometric-protected copy). Throws `VaultUnlockError` if biometric unlock
 * isn't set up, the prompt is cancelled or fails, or the OS invalidated the
 * copy (e.g. a new face/fingerprint was enrolled) — the passphrase still
 * works in every case.
 */
export async function unlockVaultWithBiometrics(): Promise<string> {
  let enabled: boolean;
  try {
    enabled = await hasBiometricUnlock();
  } catch {
    enabled = false;
  }
  if (!enabled) {
    throw new VaultUnlockError("Biometric unlock isn't set up");
  }
  let masterKeyHex: string | null;
  try {
    masterKeyHex = await getItemAsync(BIOMETRIC_KEY, {
      requireAuthentication: true,
      authenticationPrompt: BIOMETRIC_PROMPT,
    });
  } catch {
    throw new VaultUnlockError("Biometric unlock failed or was cancelled");
  }
  if (masterKeyHex === null) {
    throw new VaultUnlockError("Biometric unlock is no longer valid");
  }
  return masterKeyHex;
}

/**
 * Unwraps the stored master key using a key derived from `passphrase`.
 * Throws `VaultUnlockError` — never a raw crypto error — whether the
 * passphrase is wrong, the stored record is corrupted, or no vault exists
 * yet at all; callers shouldn't need to distinguish those to offer
 * wipe-and-restart.
 */
export async function unlockVault(passphrase: string): Promise<string> {
  const raw = await getItemAsync(VAULT_STORAGE_KEY);
  if (raw === null) {
    throw new VaultUnlockError("No vault has been set up yet");
  }

  let record: VaultRecord;
  try {
    record = JSON.parse(raw) as VaultRecord;
  } catch {
    throw new VaultUnlockError("Vault record is corrupted");
  }

  const wrappingKeyHex = deriveKeyHex(passphrase, record.saltHex);
  try {
    return decryptHex(record, wrappingKeyHex);
  } catch {
    throw new VaultUnlockError();
  }
}

/**
 * Wipe-and-restart recovery path: clears the wrapped master key and deletes
 * the (now permanently unreadable, whether from a lost passphrase or
 * corruption) database file, so `setUpVault` can create a fresh vault
 * afterward. This is scoped to the vault only — it does not touch models,
 * MMKV settings, or anything else 4.5's full wipe-data feature owns.
 *
 * Logs to entities/audit *before* deleting — see the module doc comment
 * above for why this entry does not actually survive the wipe it records.
 */
export async function resetVault(): Promise<void> {
  insertAuditEntry(openDb(), {
    id: generateId(),
    action: "wipe",
    detail: "encrypt-vault reset (wipe-and-restart)",
    createdAt: Date.now(),
  });
  await forgetKeys();
  deleteDb();
}
