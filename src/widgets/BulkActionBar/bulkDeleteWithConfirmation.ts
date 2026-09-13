import { runBulkOperation, type BulkOperationResult } from "@/shared/lib";

export type ConfirmFn = () => Promise<boolean>;

/**
 * Orchestrates "confirm, then bulk-delete" — mirrors `WipeDataSettings`'
 * own `wipeWithConfirmation` shape exactly (`confirm` injected so this is
 * testable without a real `Alert.alert`, `deleteOne` injected so this is
 * testable without a real `deleteCapsule`/db). A multi-select delete is
 * exactly as destructive as a full wipe, just smaller in scope — it earns
 * the same "never without confirmation" discipline.
 *
 * Returns `null` when nothing was attempted (either the user declined, or
 * there was nothing to delete in the first place) — distinguishable from
 * an actually-empty `BulkOperationResult` (which can't occur here anyway,
 * since an empty `ids` short-circuits before ever calling `confirm`).
 */
export async function bulkDeleteWithConfirmation(
  ids: string[],
  confirm: ConfirmFn,
  deleteOne: (id: string) => void,
): Promise<BulkOperationResult<void> | null> {
  if (ids.length === 0) return null;

  const confirmed = await confirm();
  if (!confirmed) return null;

  return runBulkOperation(ids, deleteOne);
}
