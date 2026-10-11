import {
  closeDb,
  deleteDatabaseFile,
  openDb,
  runMigrations,
  type DatabaseFile,
} from "@/shared/db";
import {
  forgetStalePlainCopy,
  isPlainCopyStale,
  isVaultConfigured,
} from "@/features/encrypt-vault";
import { migrations } from "./migrations";

/**
 * The non-React core of the launch gate (4.6), kept separate so it's
 * testable without rendering. With app lock off, the plain database opens
 * straight away. With it on, nothing opens until the vault key is unlocked —
 * `openUnlocked` then opens the encrypted file.
 *
 * Turning the lock on or off copies the database into the other file and
 * removes the old one last, so an interruption can leave a stale copy. It is
 * removed here only after the file actually in use has opened and migrated
 * — and a plain file only when it's known to be stale (see `openUnlocked`).
 */
export type LaunchState = { kind: "ready" } | { kind: "locked" };

export async function openAtLaunch(): Promise<LaunchState> {
  if (await isVaultConfigured()) return { kind: "locked" };
  runMigrations(openDb(), migrations);
  removeStaleCopy("vault");
  return { kind: "ready" };
}

/**
 * Opens the encrypted database with an unlocked key. Throws (closing it
 * again) if the key doesn't open it. A leftover plain file is deleted only
 * when it's marked as a stale copy AND the encrypted file really held data
 * — a missing encrypted file opens as a new, empty one, and then the plain
 * file may be the only copy left.
 */
export function openUnlocked(masterKeyHex: string): void {
  let hadData: boolean;
  try {
    const db = openDb({ key: masterKeyHex });
    const tables = db.getFirstSync(
      "SELECT count(*) AS n FROM sqlite_master WHERE type = 'table' AND name != '_migrations';",
    ) as { n: number };
    hadData = tables.n > 0;
    runMigrations(db, migrations);
  } catch (error) {
    closeDb();
    throw error;
  }
  if (!hadData) {
    // The encrypted file was missing: a plain file, if any, may be the only
    // real copy now — never treat it as stale again.
    forgetStalePlainCopy();
  } else if (isPlainCopyStale()) {
    try {
      deleteDatabaseFile("plain");
      forgetStalePlainCopy();
    } catch {
      // Retried at the next unlock.
    }
  }
}

function removeStaleCopy(file: DatabaseFile): void {
  try {
    deleteDatabaseFile(file);
  } catch {
    // Retried at the next launch; never blocks opening the app.
  }
}
