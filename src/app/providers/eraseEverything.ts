import { openDatabaseFile, openDb, runMigrations } from "@/shared/db";
import { insertAuditEntry } from "@/entities/audit";
import { generateId } from "@/shared/lib";
import { wipeAllData } from "@/features/wipe-data";
import { forgetVaultKeys } from "@/features/encrypt-vault";
import { migrations } from "./migrations";

/**
 * The detail of the wipe record. The activity log already labels a "wipe"
 * entry "Data wiped", so this says what it means for the log itself.
 */
export const WIPE_RECORD_DETAIL =
  "Everything was erased; the activity log starts again here.";

/**
 * The one "erase everything" (4.7), used by Privacy → Wipe all data and by
 * the lock screen's "Forgot your passphrase?". Features can't import each
 * other, so the parts are composed here:
 *
 * 1. `wipeAllData` — reminders, every file folder, settings and both
 *    database files.
 * 2. `forgetVaultKeys` — the app-lock keys, LAST: if step 1 fails, the
 *    lock stays on, and erasing again simply retries.
 * 3. One record that the wipe happened (10.52): the fresh, unlocked
 *    database the app starts with gets a single "wipe" audit entry, shown
 *    as "Data wiped" (the wipe's own entry is deleted with the database it
 *    was written to). Opening it here creates the database the restart
 *    would create anyway.
 *
 * Callers restart the app afterwards (`reloadAppAsync`) so nothing keeps
 * a handle to the deleted database.
 */
export async function eraseEverything(): Promise<void> {
  await wipeAllData(openDatabaseFile() !== null ? openDb() : null);
  await forgetVaultKeys();
  recordWipe();
}

/**
 * Best effort: the erase itself has succeeded by now, and a failed log line
 * mustn't make it look failed (the screen would offer to erase again).
 */
function recordWipe(): void {
  try {
    const db = openDb();
    runMigrations(db, migrations);
    insertAuditEntry(db, {
      id: generateId(),
      action: "wipe",
      detail: WIPE_RECORD_DETAIL,
      createdAt: Date.now(),
    });
  } catch (e) {
    console.warn("Couldn't record the wipe in the activity log", e);
  }
}
