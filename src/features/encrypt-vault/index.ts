import { getItemAsync, setItemAsync, deleteItemAsync } from "expo-secure-store";
import {
  closeDb,
  copyDatabaseTo,
  deleteDatabaseFile,
  openDatabaseFile,
  openDb,
} from "@/shared/db";
import type { SQLiteDatabase } from "expo-sqlite";
import { insertAuditEntry } from "@/entities/audit";
import { generateId } from "@/shared/lib";
import { getBoolean, remove, setBoolean } from "@/shared/storage";
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
 * Erasing everything (4.7) is the app layer's `eraseEverything`: it runs
 * `features/wipe-data` and then this module's `forgetVaultKeys`. Its audit
 * entry is erased along with the data it records — whether wipe audit
 * entries need a home outside the store being wiped is an open question
 * (see BLOCKED.md).
 */

const VAULT_STORAGE_KEY = "encryptVault.wrappedMasterKey";
/** A second copy of the master key that the OS releases only after Face ID / Touch ID / fingerprint. */
const BIOMETRIC_KEY = "encryptVault.biometricMasterKey";
/** Plain marker that the biometric copy exists — checking it must not trigger a prompt. */
const BIOMETRIC_FLAG = "encryptVault.biometricUnlock";
const BIOMETRIC_PROMPT = "Unlock Capsule";
/**
 * Set only while the plain file, if it still exists, holds nothing newer
 * than the encrypted one — i.e. it's a closed copy that turning the lock on
 * (or a failed turn-off) couldn't delete. Launch cleanup deletes the plain
 * file only when this is set; otherwise it may hold data and is kept.
 */
const STALE_PLAIN_KEY = "appLock.plainCopyIsStale";
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
 * the lock must be turned off (or everything erased) first.
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
    throw new Error("App lock is already on");
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

/** Best effort while undoing; returns whether the file is gone. */
function tryDeleteDatabaseFile(file: "plain" | "vault"): boolean {
  try {
    deleteDatabaseFile(file);
    return true;
  } catch {
    return false; // the original error is what matters
  }
}

function markPlainCopyStale(stale: boolean): void {
  if (stale) setBoolean(STALE_PLAIN_KEY, true);
  else remove(STALE_PLAIN_KEY);
}

/** Whether a leftover plain file is a stale copy, safe to delete once the encrypted one is open. */
export function isPlainCopyStale(): boolean {
  return getBoolean(STALE_PLAIN_KEY) === true;
}

/** Call after the stale plain copy was deleted. */
export function forgetStalePlainCopy(): void {
  markPlainCopyStale(false);
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
  // Closed right after the copy: nothing in it is newer than the vault.
  markPlainCopyStale(true);

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
      markPlainCopyStale(false);
    } else {
      // The saved key opens the vault at next launch, so this session
      // must write there too. Plain is the fallback if even that fails —
      // and then plain is the live copy, not a stale one.
      try {
        openDb({ key: masterKeyHex });
      } catch {
        closeDb();
        openDb();
        markPlainCopyStale(false);
      }
    }
    throw error;
  }

  let leftover = false;
  try {
    deleteDatabaseFile("plain");
    markPlainCopyStale(false);
  } catch {
    leftover = true; // stays marked stale: removed at the next unlock
  }
  if (options.biometrics) {
    try {
      await storeBiometricKey(masterKeyHex);
    } catch {
      // No biometrics enrolled (or refused): the passphrase still unlocks.
    }
  }
  if (leftover) {
    throw new LeftoverCopyError(
      "App lock is on, but the unencrypted copy couldn't be removed yet. It will be removed the next time you unlock Capsule.",
    );
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
    // The plain file is only a copy of the vault being kept — if it can't
    // be deleted now, launch cleanup may delete it later.
    if (!tryDeleteDatabaseFile("plain")) markPlainCopyStale(true);
    openDb({ key: masterKeyHex });
    throw error;
  }
  markPlainCopyStale(false);
  try {
    deleteDatabaseFile("vault");
  } catch {
    throw new LeftoverCopyError(
      "App lock is off, but the encrypted copy couldn't be removed yet. It will be removed the next time Capsule starts.",
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
 * The vault's part of erasing everything (4.7): forgets the wrapped key,
 * the biometric copy and the stale-copy marker. Touches no database file —
 * the app layer's `eraseEverything` deletes those (with all other data)
 * first, and calls this last, so a failed erase leaves the lock guarding
 * whatever is left.
 */
export async function forgetVaultKeys(): Promise<void> {
  await forgetKeys();
  markPlainCopyStale(false);
}
