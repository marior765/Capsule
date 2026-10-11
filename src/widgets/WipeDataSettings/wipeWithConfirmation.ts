export type ConfirmFn = () => Promise<boolean>;
export type EraseFn = () => Promise<void>;

/**
 * Orchestrates "confirm, then erase" — kept separate from the widget so it's
 * testable without a real `Alert.alert` dialog. Both `confirm` (the actual
 * confirmation mechanism — `Alert.alert` wrapped in a promise, in
 * production) and `erase` (the app's one erase-everything, 4.7) are
 * injected, so this proves only what it's responsible for: never erase
 * without confirmation, and never swallow an erase failure.
 */
export async function wipeWithConfirmation(
  confirm: ConfirmFn,
  erase: EraseFn,
): Promise<boolean> {
  const confirmed = await confirm();
  if (!confirmed) {
    return false;
  }
  await erase();
  return true;
}
