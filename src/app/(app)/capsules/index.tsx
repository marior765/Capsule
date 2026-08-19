import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { useDb } from "@/app/providers";
import { getAllCapsules, type Capsule } from "@/entities/capsule";
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

export default function CapsuleListScreen() {
  const db = useDb();
  const [capsules, setCapsules] = useState<Capsule[]>([]);
  const [capsuleTypes, setCapsuleTypes] = useState<CapsuleType[]>([]);
  const [query, setQuery] = useState("");
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<CapsuleSortKey>("updatedAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [filterVisible, setFilterVisible] = useState(false);

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
      <Pressable
        testID={testIDs.pressables.toggleFilter}
        style={styles.filterToggle}
        onPress={() => setFilterVisible((visible) => !visible)}
      >
        <Text style={styles.filterToggleLabel}>
          {filterVisible ? "Hide filters" : "Filter & sort"}
        </Text>
      </Pressable>
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
      <CapsuleList
        capsules={visibleCapsules}
        capsuleTypesById={capsuleTypesById}
        onPressCapsule={(capsule) => router.push(`/capsules/${capsule.id}`)}
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
  pressables: ["createType", "toggleFilter"] as const,
});
