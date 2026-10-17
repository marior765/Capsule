import type { SQLiteDatabase } from "expo-sqlite";
import { getAllCapsules, type Capsule } from "@/entities/capsule";
import {
  getAllConversations,
  type Conversation,
} from "@/entities/conversation";

export type RecentActivity = {
  capsules: Capsule[];
  conversations: Conversation[];
};

/**
 * What Home shows: the capsules and conversations touched most recently,
 * newest first, at most `limit` of each.
 */
export function getRecentActivity(
  db: SQLiteDatabase,
  limit = 5,
): RecentActivity {
  const n = Math.max(0, limit);
  return {
    capsules: getAllCapsules(db).slice(0, n),
    conversations: getAllConversations(db).slice(0, n),
  };
}
