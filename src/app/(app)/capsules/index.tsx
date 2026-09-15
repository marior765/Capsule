import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { useDb } from "@/app/providers";
import {
  getAllCapsules,
  getValuesByField,
  type Capsule,
} from "@/entities/capsule";
import type { BulkOperationResult } from "@/shared/lib";
import { getAllCapsuleTypes, type CapsuleType } from "@/entities/capsule-type";
import { getFieldsByCapsuleType, parseSelectOptions } from "@/entities/field";
import {
  filterCapsulesByType,
  groupCapsulesBySelectField,
  sortCapsules,
  type CapsuleSortKey,
  type SortDirection,
} from "@/features/filter-sort-capsules";
import { searchCapsules } from "@/features/search-capsules";
import { createCapsule } from "@/features/create-capsule";
import { createComponentTestIDs } from "@/shared/testing";
import { CapsuleList } from "@/widgets/CapsuleList";
import { CapsuleBoard } from "@/widgets/CapsuleBoard";
import { FilterSheet } from "@/widgets/FilterSheet";
import { SearchBar } from "@/widgets/SearchBar";
import { BulkActionBar } from "@/widgets/BulkActionBar";
import { QuickCapture } from "@/widgets/QuickCapture";

export default function CapsuleListScreen() {
  const db = useDb();
  const [capsules, setCapsules] = useState<Capsule[]>([]);
  const [capsuleTypes, setCapsuleTypes] = useState<CapsuleType[]>([]);
  const [query, setQuery] = useState("");
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<CapsuleSortKey>("updatedAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [filterVisible, setFilterVisible] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [captureVisible, setCaptureVisible] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "card" | "board">("list");

  useFocusEffect(
    useCallback(() => {
      setCapsules(getAllCapsules(db));
      setCapsuleTypes(getAllCapsuleTypes(db));
    }, [db]),
  );

  const capsuleTypesById = Object.fromEntries(
    capsuleTypes.map((type) => [type.id, type]),
  );

  // Only re-query the db (searchCapsules' own field-value scan) once there's
  // an actual query — otherwise reuse the already-fetched `capsules` state,
  // matching the rest of this route's "refresh on focus" convention rather
  // than re-hitting the db on every render.
  const searched = query.trim() ? searchCapsules(db, query) : capsules;
  const filtered = filterCapsulesByType(searched, selectedTypeId);
  const visibleCapsules = sortCapsules(filtered, sortKey, sortDirection);

  // Board view (8.7) only makes sense scoped to ONE capsule type — a
  // single_select field's options are defined per-type, so grouping
  // across types would mix unrelated option sets. Groups by the type's
  // FIRST single_select field; a type with none, or no type selected at
  // all, has nothing to group by (handled in the render below, not here).
  const boardField =
    viewMode === "board" && selectedTypeId
      ? (getFieldsByCapsuleType(db, selectedTypeId).find(
          (field) => field.fieldType === "single_select",
        ) ?? null)
      : null;
  const boardColumns = boardField
    ? groupCapsulesBySelectField(
        visibleCapsules,
        parseSelectOptions(boardField.config),
        Object.fromEntries(
          getValuesByField(db, boardField.id).map((v) => [
            v.capsuleId,
            v.value,
          ]),
        ),
      )
    : [];

  // Toggling selection mode off also clears the selection — re-entering
  // select mode later should never resurrect a stale, possibly-deleted
  // set of ids from a previous session.
  const handleToggleSelectionMode = () => {
    setSelectionMode((mode) => !mode);
    setSelectedIds(new Set());
  };

  // A partial failure must stay visible: narrowing selection to just the
  // failed ids (rather than always clearing it) keeps BulkActionBar
  // mounted with its own error message shown, instead of unmounting it in
  // the same commit and silently discarding the message it just computed.
  // Selection mode only exits, and selection only fully clears, once
  // nothing is left to retry.
  const handleDeleted = (result: BulkOperationResult<void>) => {
    setCapsules(getAllCapsules(db));
    const failedIds = new Set(result.failed.map((f) => f.id));
    setSelectedIds(failedIds);
    if (failedIds.size === 0) {
      setSelectionMode(false);
    }
  };

  // Deliberately does NOT navigate away or close the capture panel — a
  // quick capture is meant to cost one tap per capsule, not a full
  // round trip through the detail screen each time (that's still one tap
  // away via the freshly captured card itself, whenever more detail is
  // actually wanted). Re-fetching puts the new capsule at the top of the
  // (default updatedAt-desc-sorted) list immediately.
  const handleCapture = (input: { capsuleTypeId: string; title: string }) => {
    createCapsule(db, input);
    setCapsules(getAllCapsules(db));
  };

  return (
    <View style={styles.root}>
      {capsuleTypes.length === 0 && (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>
            No capsule types exist yet — creating a capsule needs at least one
            type to hold it.
          </Text>
          <Pressable
            testID={testIDs.pressables.createType}
            onPress={() => router.push("/types/new")}
            accessibilityRole="button"
          >
            <Text style={styles.noticeLink}>Create a type</Text>
          </Pressable>
        </View>
      )}
      <SearchBar value={query} onChangeText={setQuery} />
      <View style={styles.toggleRow}>
        <Pressable
          testID={testIDs.pressables.toggleFilter}
          style={styles.filterToggle}
          onPress={() => setFilterVisible((visible) => !visible)}
          accessibilityRole="button"
          accessibilityState={{ expanded: filterVisible }}
        >
          <Text style={styles.filterToggleLabel}>
            {filterVisible ? "Hide filters" : "Filter & sort"}
          </Text>
        </Pressable>
        <Pressable
          testID={testIDs.pressables.toggleSelectionMode}
          style={styles.filterToggle}
          onPress={handleToggleSelectionMode}
          accessibilityRole="button"
          accessibilityState={{ selected: selectionMode }}
        >
          <Text style={styles.filterToggleLabel}>
            {selectionMode ? "Cancel" : "Select"}
          </Text>
        </Pressable>
        {capsuleTypes.length > 0 && (
          <Pressable
            testID={testIDs.pressables.toggleCapture}
            style={styles.filterToggle}
            onPress={() => setCaptureVisible((visible) => !visible)}
            accessibilityRole="button"
            accessibilityState={{ expanded: captureVisible }}
          >
            <Text style={styles.filterToggleLabel}>
              {captureVisible ? "Hide capture" : "Capture"}
            </Text>
          </Pressable>
        )}
        <Pressable
          testID={testIDs.pressables.toggleViewMode}
          style={styles.filterToggle}
          onPress={() => setViewMode((mode) => NEXT_VIEW_MODE[mode])}
          accessibilityRole="button"
        >
          <Text style={styles.filterToggleLabel}>
            {VIEW_MODE_LABEL[viewMode]}
          </Text>
        </Pressable>
      </View>
      {captureVisible && (
        <QuickCapture capsuleTypes={capsuleTypes} onCapture={handleCapture} />
      )}
      {filterVisible && (
        <FilterSheet
          capsuleTypes={capsuleTypes}
          selectedTypeId={selectedTypeId}
          onSelectType={setSelectedTypeId}
          sortKey={sortKey}
          sortDirection={sortDirection}
          onChangeSort={(key, direction) => {
            setSortKey(key);
            setSortDirection(direction);
          }}
        />
      )}
      {selectionMode && selectedIds.size > 0 && (
        <BulkActionBar
          db={db}
          selectedIds={Array.from(selectedIds)}
          onDeleted={handleDeleted}
        />
      )}
      {viewMode === "board" ? (
        !selectedTypeId ? (
          <Text testID={testIDs.texts.boardHint} style={styles.boardHint}>
            Select a capsule type above (Filter & sort) to use board view.
          </Text>
        ) : !boardField ? (
          <Text testID={testIDs.texts.boardHint} style={styles.boardHint}>
            {capsuleTypesById[selectedTypeId]?.name ?? "This type"} has no
            single-select field to group by.
          </Text>
        ) : (
          <CapsuleBoard
            columns={boardColumns}
            capsuleTypeName={capsuleTypesById[selectedTypeId]?.name ?? null}
            onPressCapsule={(capsule) => router.push(`/capsules/${capsule.id}`)}
          />
        )
      ) : (
        <CapsuleList
          capsules={visibleCapsules}
          capsuleTypesById={capsuleTypesById}
          onPressCapsule={(capsule) => router.push(`/capsules/${capsule.id}`)}
          selectionMode={selectionMode}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          viewMode={viewMode}
        />
      )}
    </View>
  );
}

const NEXT_VIEW_MODE = {
  list: "card",
  card: "board",
  board: "list",
} as const;

const VIEW_MODE_LABEL = {
  list: "List view",
  card: "Card view",
  board: "Board view",
} as const;

const styles = StyleSheet.create((theme) => ({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  notice: {
    padding: theme.spacing.three,
  },
  noticeText: {
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.sans,
    fontSize: 12,
    marginBottom: theme.spacing.two,
  },
  noticeLink: {
    color: theme.colors.accent,
    fontFamily: theme.fonts.rounded,
    fontSize: 13,
  },
  toggleRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  filterToggle: {
    alignSelf: "flex-start",
    paddingHorizontal: theme.spacing.three,
    paddingVertical: theme.spacing.one,
  },
  filterToggleLabel: {
    color: theme.colors.accent,
    fontFamily: theme.fonts.sans,
    fontSize: 13,
  },
  boardHint: {
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.sans,
    fontSize: 13,
    textAlign: "center",
    padding: theme.spacing.four,
  },
}));

const testIDs = createComponentTestIDs("CapsuleListScreen", {
  pressables: [
    "createType",
    "toggleFilter",
    "toggleSelectionMode",
    "toggleCapture",
    "toggleViewMode",
  ] as const,
  texts: ["boardHint"] as const,
});
