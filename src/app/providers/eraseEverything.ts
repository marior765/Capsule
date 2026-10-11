import { openDatabaseFile, openDb } from "@/shared/db";
import { wipeAllData } from "@/features/wipe-data";
import { forgetVaultKeys } from "@/features/encrypt-vault";

/**
 * The one "erase everything" (4.7), used by Privacy → Wipe all data and by
 * the lock screen's "Forgot your passphrase?". Features can't import each
 * other, so the two halves are composed here:
 *
 * 1. `wipeAllData` — reminders, every file folder, settings and both
 *    database files (with an audit entry, if a database is open; from the
 *    lock screen none is, and none is created).
 * 2. `forgetVaultKeys` — the app-lock keys, LAST: if step 1 fails, the
 *    lock stays on, and erasing again simply retries.
 *
 * Callers restart the app afterwards (`reloadAppAsync`) so nothing keeps
 * a handle to the deleted database.
 */
export async function eraseEverything(): Promise<void> {
  await wipeAllData(openDatabaseFile() !== null ? openDb() : null);
  await forgetVaultKeys();
}
