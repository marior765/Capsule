import type { SQLiteDatabase } from "expo-sqlite";
import { deleteDb } from "@/shared/db";
import { insertAuditEntry } from "@/entities/audit";
import { clearAllSettings } from "@/shared/storage";
import { generateId } from "@/shared/lib";
import { deleteAppDirectoryIfExists } from "@/shared/fs";
import { ATTACHMENTS_DIRECTORY } from "@/entities/attachment";

/**
 * "features/wipe-data — secure full wipe (models, chats, capsules,
 * settings)" (docs/DEVELOPMENT_PLAN.md 4.5).
 *
 * Chats, capsules, and model records are all rows in the same SQLite
 * database, so a single `deleteDb()` covers them at once — no per-table
 * deletes needed. Files on disk are separate from their rows and need
 * their own deletion: chat models (`models/`), speech-to-text models
 * (`stt-models/`), and capsule attachments (`attachments/`), all through
 * `shared/fs`.
 *
 * Order: delete files first (a failure here — permissions, an odd native
 * error — leaves the db and audit trail completely untouched, so the
 * caller can safely surface an error and let the user retry, rather than
 * having already destroyed data the wipe never actually finished). Then log
 * the audit entry while the db is still open and writable. Then clear MMKV
 * settings. `deleteDb()` runs last, since it invalidates the db handle —
 * same ordering discipline as encrypt-vault's `resetVault`, including the
 * same caveat: the audit entry does not survive the wipe it records, since
 * `deleteDb()` removes the audit table along with everything else. See
 * that module's doc comment for the fuller reasoning; the same open
 * question (does a wipe-adjacent audit entry need a home outside the store
 * being wiped?) applies here too.
 *
 * Deliberately does NOT touch the vault key in expo-secure-store —
 * `features/encrypt-vault` owns that exclusively via its own `resetVault`,
 * and this module can't import encrypt-vault directly (FSD forbids
 * same-layer cross-slice imports; verified via
 * `grep -rn "from ['\"]@/features/" src/features` — empty repo-wide).
 * Whether these two "wipe everything" paths should someday be unified
 * behind one entry point is a real open question, not decided here — see
 * .claude/loop/BLOCKED.md.
 */
export async function wipeAllData(db: SQLiteDatabase): Promise<void> {
  // Every app-managed folder of files: chat models, speech-to-text
  // models, and capsule attachments.
  deleteAppDirectoryIfExists("models");
  deleteAppDirectoryIfExists("stt-models");
  deleteAppDirectoryIfExists(ATTACHMENTS_DIRECTORY);

  insertAuditEntry(db, {
    id: generateId(),
    action: "wipe",
    detail: "Full data wipe (models, chats, capsules, attachments, settings)",
    createdAt: Date.now(),
  });

  clearAllSettings();
  deleteDb();
}
