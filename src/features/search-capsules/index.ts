import type { SQLiteDatabase } from "expo-sqlite";
import {
  getAllCapsules,
  getValuesByCapsule,
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

  return getAllCapsules(db).filter((capsule) => {
    if (capsule.title.toLowerCase().includes(needle)) return true;
    return getValuesByCapsule(db, capsule.id).some((value) =>
      value.value?.toLowerCase().includes(needle),
    );
  });
}
