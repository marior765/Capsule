import type { SQLiteDatabase } from "expo-sqlite";
import {
  getAllCapsules,
  getAllCapsuleValues,
  type Capsule,
} from "@/entities/capsule";

/**
 * Matches on a capsule's title OR any of its field values — capsules are
 * structured data, so unlike `manage-conversations`' `searchConversations`
 * (title only), most of what a capsule "is" often lives in its field
 * values rather than its title (a capsule can be left at the default
 * "Untitled" and still be fully identified by its fields). A capsule
 * matching on both never appears twice: title and values are checked with
 * an early-return `some`, not two separate passes merged together.
 */
export function searchCapsules(db: SQLiteDatabase, query: string): Capsule[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return getAllCapsules(db);

  // Runs on every keystroke, on the JS thread: one query for all values
  // (10.56), not one per capsule. Matching stays in JS: SQLite's lower()
  // only folds ASCII, which would break non-Latin searches.
  const matchingByValue = new Set<string>();
  for (const value of getAllCapsuleValues(db)) {
    if (value.value?.toLowerCase().includes(needle)) {
      matchingByValue.add(value.capsuleId);
    }
  }
  return getAllCapsules(db).filter(
    (capsule) =>
      capsule.title.toLowerCase().includes(needle) ||
      matchingByValue.has(capsule.id),
  );
}
