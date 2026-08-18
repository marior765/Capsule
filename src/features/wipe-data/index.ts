import { Directory, Paths } from "expo-file-system";
import type { SQLiteDatabase } from "expo-sqlite";
import { deleteDb } from "@/shared/db";
import { insertAuditEntry } from "@/entities/audit";
import { clearAllSettings } from "@/shared/storage";
import { generateId } from "@/shared/lib";

/**
 * "features/wipe-data — secure full wipe (models, chats, capsules,
 * settings)" (docs/DEVELOPMENT_PLAN.md 4.5).
 *
 * Chats and models are both rows in the same SQLite database, so a single
 * `deleteDb()` covers both at once — no per-table deletes needed. Model
 * *files* on disk are separate from their db rows and need their own
 * deletion. Capsules (entities/capsule) don't exist yet — Phase 6 hasn't
 * been built — so there's nothing to wipe there today; this module doesn't
 * pretend otherwise, it simply has nothing to do for that category yet.
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
  const modelsDir = new Directory(Paths.document, "models");
  if (modelsDir.exists) {
    modelsDir.delete();
  }

  insertAuditEntry(db, {
    id: generateId(),
    action: "wipe",
    detail: "Full data wipe (models, chats, settings)",
    createdAt: Date.now(),
  });

  clearAllSettings();
  deleteDb();
}
