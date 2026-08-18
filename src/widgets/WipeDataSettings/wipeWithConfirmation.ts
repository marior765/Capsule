import type { SQLiteDatabase } from "expo-sqlite";

export type ConfirmFn = () => Promise<boolean>;
export type WipeFn = (db: SQLiteDatabase) => Promise<void>;

/**
 * Orchestrates "confirm, then wipe" — kept separate from the widget so it's
 * testable without a real `Alert.alert` dialog or a real `wipeAllData` call.
 * Both `confirm` (the actual confirmation mechanism — `Alert.alert` wrapped
 * in a promise, in production) and `wipe` (`features/wipe-data`'s
 * `wipeAllData`, already its own thoroughly-tested module) are injected, so
 * this function proves only what it's actually responsible for: never wipe
 * without confirmation, and never swallow a wipe failure.
 */
export async function wipeWithConfirmation(
  db: SQLiteDatabase,
  confirm: ConfirmFn,
  wipe: WipeFn,
): Promise<boolean> {
  const confirmed = await confirm();
  if (!confirmed) {
    return false;
  }
  await wipe(db);
  return true;
}
