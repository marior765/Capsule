import { getItemAsync, setItemAsync, deleteItemAsync } from "expo-secure-store";
import { deleteDb, openDb } from "@/shared/db";
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
 * This module does not open or touch the sqlite database directly except
 * to delete it on `resetVault` — callers are responsible for passing the
 * returned master key into `shared/db`'s `openDb({ key })` themselves. That
 * wiring (an unlock screen gating the app's db/llm/stt providers) is a
 * separate, later integration step, not part of this module's own scope.
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
const MASTER_KEY_LENGTH_BYTES = 32;
const SALT_LENGTH_BYTES = 16;

type VaultRecord = EncryptedPayload & {
  saltHex: string;
};

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
  if (!passphrase.trim()) {
    throw new Error("Passphrase must not be empty");
  }
  if (await isVaultConfigured()) {
    throw new Error(
      "Vault is already set up — call resetVault() first to replace it",
    );
  }

  const masterKeyHex = randomHex(MASTER_KEY_LENGTH_BYTES);
  const saltHex = randomHex(SALT_LENGTH_BYTES);
  const wrappingKeyHex = deriveKeyHex(passphrase, saltHex);
  const wrapped = encryptHex(masterKeyHex, wrappingKeyHex);

  const record: VaultRecord = { saltHex, ...wrapped };
  await setItemAsync(VAULT_STORAGE_KEY, JSON.stringify(record));

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
  await deleteItemAsync(VAULT_STORAGE_KEY);
  deleteDb();
}
