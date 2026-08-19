import { Pressable, Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import type { CapsuleType } from "@/entities/capsule-type";
import type {
  CapsuleSortKey,
  SortDirection,
} from "@/features/filter-sort-capsules";
import { createComponentTestIDs } from "@/shared/testing";
import { toggleSort } from "./toggleSort";

const SORT_OPTIONS: { key: CapsuleSortKey; label: string }[] = [
  { key: "updatedAt", label: "Last updated" },
  { key: "createdAt", label: "Date created" },
  { key: "title", label: "Title" },
];

type FilterSheetProps = {
  /** Already fetched by the caller, same as `CapsuleListScreen`'s existing `capsuleTypes` state. */
  capsuleTypes: CapsuleType[];
  /** `null` means "all types". */
  selectedTypeId: string | null;
  onSelectType: (capsuleTypeId: string | null) => void;
  sortKey: CapsuleSortKey;
  sortDirection: SortDirection;
  onChangeSort: (key: CapsuleSortKey, direction: SortDirection) => void;
};

/**
 * Purely controlled, like `CapsuleEditor`/`SchemaBuilder` — owns no state,
 * does no fetching, has no opinion on whether/how the caller presents it
 * (inline, a real bottom sheet later). The only local logic is the
 * tap-to-toggle-direction behavior, extracted to `toggleSort` and tested
 * there rather than here, matching this repo's convention for widgets
 * (no `@testing-library/react-native` — real logic goes in its own pure,
 * tested module; see `SchemaBuilder`'s `moveField.ts`).
 */
export function FilterSheet({
  capsuleTypes,
  selectedTypeId,
  onSelectType,
  sortKey,
  sortDirection,
  onChangeSort,
}: FilterSheetProps) {
  const handlePressSort = (pressedKey: CapsuleSortKey) => {
    const next = toggleSort(sortKey, sortDirection, pressedKey);
    onChangeSort(next.key, next.direction);
  };

  return (
    <View testID={testIDs.containers.root} style={styles.root}>
      <Text style={styles.heading}>Type</Text>
      <View style={styles.row}>
        <Pressable
          testID={testIDs.pressables.allTypes}
          style={[styles.chip, selectedTypeId === null && styles.chipSelected]}
          onPress={() => onSelectType(null)}
        >
          <Text style={styles.chipLabel}>All</Text>
        </Pressable>
        {capsuleTypes.map((capsuleType) => (
          <Pressable
            key={capsuleType.id}
            testID={`${testIDs.pressables.typeOption}_${capsuleType.id}`}
            style={[
              styles.chip,
              selectedTypeId === capsuleType.id && styles.chipSelected,
            ]}
            onPress={() => onSelectType(capsuleType.id)}
          >
            <Text style={styles.chipLabel}>{capsuleType.name}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.heading}>Sort by</Text>
      <View style={styles.row}>
        {SORT_OPTIONS.map((option) => {
          const isActive = option.key === sortKey;
          return (
            <Pressable
              key={option.key}
              testID={`${testIDs.pressables.sortOption}_${option.key}`}
              style={[styles.chip, isActive && styles.chipSelected]}
              onPress={() => handlePressSort(option.key)}
            >
              <Text style={styles.chipLabel}>
                {option.label}
                {isActive ? (sortDirection === "asc" ? " ↑" : " ↓") : ""}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: {
    padding: theme.spacing.three,
  },
  heading: {
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.sans,
    fontSize: 12,
    marginBottom: theme.spacing.one,
    marginTop: theme.spacing.two,
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.one,
  },
  chip: {
    backgroundColor: theme.colors.backgroundElement,
    paddingHorizontal: theme.spacing.two,
    paddingVertical: theme.spacing.one,
    borderRadius: theme.spacing.two,
  },
  chipSelected: {
    backgroundColor: theme.colors.backgroundSelected,
  },
  chipLabel: {
    color: theme.colors.text,
    fontFamily: theme.fonts.sans,
    fontSize: 13,
  },
}));

const testIDs = createComponentTestIDs("FilterSheet", {
  containers: ["root"] as const,
  pressables: ["allTypes", "typeOption", "sortOption"] as const,
});

FilterSheet.testIDs = testIDs;
