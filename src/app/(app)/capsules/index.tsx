import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { useDb } from "@/app/providers";
import { getAllCapsules, type Capsule } from "@/entities/capsule";
import type { BulkOperationResult } from "@/shared/lib";
import { getAllCapsuleTypes, type CapsuleType } from "@/entities/capsule-type";
import {
  filterCapsulesByType,
  sortCapsules,
  type CapsuleSortKey,
  type SortDirection,
} from "@/features/filter-sort-capsules";
import { searchCapsules } from "@/features/search-capsules";
import { createComponentTestIDs } from "@/shared/testing";
import { CapsuleList } from "@/widgets/CapsuleList";
import { FilterSheet } from "@/widgets/FilterSheet";
import { SearchBar } from "@/widgets/SearchBar";
import { BulkActionBar } from "@/widgets/BulkActionBar";

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
        >
          <Text style={styles.filterToggleLabel}>
            {filterVisible ? "Hide filters" : "Filter & sort"}
          </Text>
        </Pressable>
        <Pressable
          testID={testIDs.pressables.toggleSelectionMode}
          style={styles.filterToggle}
          onPress={handleToggleSelectionMode}
        >
          <Text style={styles.filterToggleLabel}>
            {selectionMode ? "Cancel" : "Select"}
          </Text>
        </Pressable>
      </View>
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
      <CapsuleList
        capsules={visibleCapsules}
        capsuleTypesById={capsuleTypesById}
        onPressCapsule={(capsule) => router.push(`/capsules/${capsule.id}`)}
        selectionMode={selectionMode}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
      />
    </View>
  );
}

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
}));

const testIDs = createComponentTestIDs("CapsuleListScreen", {
  pressables: ["createType", "toggleFilter", "toggleSelectionMode"] as const,
});
