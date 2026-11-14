import { useMemo } from "react";
import type { SQLiteDatabase } from "expo-sqlite";
import { getValuesByField, type Capsule } from "@/entities/capsule";
import type { CapsuleType } from "@/entities/capsule-type";
import {
  getFieldsByCapsuleType,
  parseSelectOptions,
  type CapsuleField,
} from "@/entities/field";
import {
  boardableTypeIds,
  filterCapsulesByType,
  findBoardField,
  groupCapsulesBySelectField,
  sortCapsules,
  type BoardColumn,
  type CapsuleSortKey,
  type SortDirection,
} from "@/features/filter-sort-capsules";
import { searchCapsules } from "@/features/search-capsules";

export type CapsuleListQueryInputs = {
  db: SQLiteDatabase;
  /** As loaded on focus; a new array means "re-read" (edits made elsewhere). */
  capsules: Capsule[];
  capsuleTypes: CapsuleType[];
  query: string;
  selectedTypeId: string | null;
  sortKey: CapsuleSortKey;
  sortDirection: SortDirection;
  viewMode: "list" | "card" | "board";
};

export type CapsuleListQueries = {
  visibleCapsules: Capsule[];
  /** The board's grouping field (8.7), or null when no board can be shown. */
  boardField: CapsuleField | null;
  /** Types the board could show, offered when the current choice can't. */
  boardTypes: CapsuleType[];
  boardColumns: BoardColumn[];
};

/**
 * The board's reads take the capsules as loaded on focus as an argument
 * they don't otherwise need: the React Compiler infers a memo's inputs from
 * the values its code actually uses, so this is what makes a reload (an
 * edit made on another screen) re-read the board. A dependency that is only
 * listed is dropped by the compiler.
 */
function readFieldsByType(
  db: SQLiteDatabase,
  capsuleTypes: readonly CapsuleType[],
  _reloadedWith: readonly Capsule[],
): Record<string, CapsuleField[]> {
  return Object.fromEntries(
    capsuleTypes.map((type) => [type.id, getFieldsByCapsuleType(db, type.id)]),
  );
}

function readBoardValues(
  db: SQLiteDatabase,
  fieldId: string,
  _reloadedWith: readonly Capsule[],
): Record<string, string | null> {
  return Object.fromEntries(
    getValuesByField(db, fieldId).map((v) => [v.capsuleId, v.value]),
  );
}

/**
 * The capsules screen's database reads (10.56), each memoized on its real
 * inputs. The React Compiler memoizes the screen's render as one block keyed
 * on all of its state, so these synchronous reads (a scan of every value for
 * search, the board's fields and values) used to re-run on every tap —
 * selecting a capsule, opening a sheet — on the JS thread. Here they re-run
 * only when the query, the capsules (reloaded on focus), the types or the
 * board choice change.
 */
export function useCapsuleListQueries({
  db,
  capsules,
  capsuleTypes,
  query,
  selectedTypeId,
  sortKey,
  sortDirection,
  viewMode,
}: CapsuleListQueryInputs): CapsuleListQueries {
  const searched = useMemo(
    () => (query.trim() ? searchCapsules(db, query) : capsules),
    [db, query, capsules],
  );
  const visibleCapsules = useMemo(
    () =>
      sortCapsules(
        filterCapsulesByType(searched, selectedTypeId),
        sortKey,
        sortDirection,
      ),
    [searched, selectedTypeId, sortKey, sortDirection],
  );

  // Board view (8.7) groups ONE type by its first single_select field.
  // `capsules` (reloaded on focus) is passed into the reads, so a field or
  // value edited on another screen shows here — see readFieldsByType.
  const fieldsByType = useMemo(
    (): Record<string, CapsuleField[]> | null =>
      viewMode === "board"
        ? readFieldsByType(db, capsuleTypes, capsules)
        : null,
    [db, viewMode, capsuleTypes, capsules],
  );

  const boardField = useMemo(
    () =>
      fieldsByType && selectedTypeId
        ? findBoardField(
            fieldsByType[selectedTypeId] ??
              getFieldsByCapsuleType(db, selectedTypeId),
          )
        : null,
    [db, fieldsByType, selectedTypeId],
  );

  const boardTypes = useMemo(() => {
    if (fieldsByType === null || boardField !== null) return [];
    const byId = new Map(capsuleTypes.map((type) => [type.id, type]));
    return boardableTypeIds(
      capsuleTypes.map((type) => type.id),
      fieldsByType,
    ).flatMap((id) => {
      const type = byId.get(id);
      return type ? [type] : [];
    });
  }, [fieldsByType, boardField, capsuleTypes]);

  const boardValues = useMemo(
    (): Record<string, string | null> =>
      boardField === null ? {} : readBoardValues(db, boardField.id, capsules),
    [db, boardField, capsules],
  );

  const boardColumns = useMemo(
    () =>
      boardField
        ? groupCapsulesBySelectField(
            visibleCapsules,
            parseSelectOptions(boardField.config),
            boardValues,
          )
        : [],
    [boardField, visibleCapsules, boardValues],
  );

  return { visibleCapsules, boardField, boardTypes, boardColumns };
}
