import type { SQLiteDatabase } from "expo-sqlite";
import { deleteDb } from "@/shared/db";
import { insertAuditEntry } from "@/entities/audit";
import { clearAllSettings } from "@/shared/storage";
import { generateId } from "@/shared/lib";
import {
  deleteAppDirectoryIfExists,
  deleteCacheDirectoryIfExists,
  EXPORTS_CACHE_DIRECTORY,
} from "@/shared/fs";
import { PICKER_CACHE_DIRECTORIES } from "@/shared/picker";
import { cancelAllLocalNotifications } from "@/shared/notifications";
import { ATTACHMENTS_DIRECTORY } from "@/entities/attachment";

/**
 * "features/wipe-data — secure full wipe (models, chats, capsules,
 * settings)" (docs/DEVELOPMENT_PLAN.md 4.5).
 *
 * Chats, capsules, and model records are all rows in the same SQLite
 * database, so a single `deleteDb()` covers them at once — no per-table
 * deletes needed. Files on disk are separate from their rows and need
 * their own deletion: chat models (`models/`), speech-to-text models
 * (`stt-models/`), the embedding model (`embedding-models/`), chat images (`chat-images/`), capsule attachments (`attachments/`), and the pickers'
 * temporary copies in the cache directory, all through `shared/fs`.
 * Scheduled reminder notifications are cancelled too. One
 * known exception it can't reach: the iOS document picker's own
 * `tmp/<bundle-id>-Inbox/` copy (see `shared/fs`'s cache-section note).
 *
 * Order: delete files first (a failure here — permissions, an odd native
 * error — leaves the db and audit trail completely untouched, so the
 * caller can safely surface an error and let the user retry, rather than
 * having already destroyed data the wipe never actually finished). Then log
 * the audit entry while the db is still open and writable. Then
 * `deleteDb()` (both database files), and clear MMKV settings last.
 * Caveat: the audit entry does not survive the wipe it records, since
 * `deleteDb()` removes the audit table along with everything else — whether
 * a wipe audit entry needs a home outside the store being wiped is an open
 * question.
 *
 * Doesn't touch the app-lock keys — `features/encrypt-vault` owns those,
 * and features can't import each other. The app layer's `eraseEverything`
 * (4.7) runs this and then `forgetVaultKeys`, so there is one erase path.
 */
export async function wipeAllData(db: SQLiteDatabase | null): Promise<void> {
  // Scheduled reminder notifications first (8.8): a failure here leaves
  // everything else untouched, and after a wipe no reminder may still fire.
  await cancelAllLocalNotifications();

  // Every app-managed folder of files: chat models, speech-to-text
  // models, and capsule attachments.
  deleteAppDirectoryIfExists("models");
  deleteAppDirectoryIfExists("stt-models");
  deleteAppDirectoryIfExists("embedding-models");
  deleteAppDirectoryIfExists(ATTACHMENTS_DIRECTORY);
  deleteAppDirectoryIfExists("chat-images");
  // Pickers' temporary copies of files the user picked (shared/picker).
  PICKER_CACHE_DIRECTORIES.forEach(deleteCacheDirectoryIfExists);
  // Exports waiting for (or left after) the share sheet — plaintext copies.
  deleteCacheDirectoryIfExists(EXPORTS_CACHE_DIRECTORY);

  // `db` is null when erasing from the lock screen: nothing is open, and
  // opening a database just to log would create one.
  if (db !== null) {
    insertAuditEntry(db, {
      id: generateId(),
      action: "wipe",
      detail: "Full data wipe (models, chats, capsules, attachments, settings)",
      createdAt: Date.now(),
    });
  }

  // Database files before settings: if deleting them fails, settings — and
  // with them app lock's "stale plain copy" marker — must still be there,
  // or a leftover unencrypted copy could never be cleaned up.
  deleteDb();
  clearAllSettings();
}
