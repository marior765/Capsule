import type { SQLiteDatabase } from "expo-sqlite";
import { openDb } from "@/shared/db";

/** Returns the app's singleton SQLite handle. */
export function useDb(): SQLiteDatabase {
  return openDb();
}
