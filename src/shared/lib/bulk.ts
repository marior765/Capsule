/**
 * Applies `operation` to every id, continuing past a failure rather than
 * aborting the whole batch — the shape "bulk operations" (8.5) needs for
 * a multi-select UI ("3 of 5 deleted, 2 failed") rather than an
 * all-or-nothing transaction. Deliberately domain-agnostic: this module
 * knows nothing about capsules, SQLite, or any specific feature — it only
 * knows how to run one function per id and collect what happened. A
 * caller composes it with an already-tested single-item feature function
 * (e.g. `runBulkOperation(selectedIds, (id) => deleteCapsule(db, id))`)
 * from the app/widget layer, which is the one place allowed to reach
 * across multiple `features/*` slices — `shared/*` itself can only ever
 * depend on nothing, per this codebase's FSD boundaries.
 *
 * Each id is attempted exactly once, in input order, whether or not an
 * earlier id failed. The actual thrown value is preserved as-is in
 * `failed[].error` (not coerced to a string or wrapped) so a caller can
 * still inspect a specific error type if it needs to.
 */
export type BulkOperationResult<T> = {
  succeeded: { id: string; result: T }[];
  failed: { id: string; error: unknown }[];
};

export function runBulkOperation<T>(
  ids: string[],
  operation: (id: string) => T,
): BulkOperationResult<T> {
  const succeeded: { id: string; result: T }[] = [];
  const failed: { id: string; error: unknown }[] = [];

  for (const id of ids) {
    try {
      succeeded.push({ id, result: operation(id) });
    } catch (error) {
      failed.push({ id, error });
    }
  }

  return { succeeded, failed };
}
