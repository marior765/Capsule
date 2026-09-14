import { FlatList, Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { createComponentTestIDs } from "@/shared/testing";
import type { Capsule } from "@/entities/capsule";
import type { CapsuleType } from "@/entities/capsule-type";
import { CapsuleCard } from "@/widgets/CapsuleCard";
import { toggleSelection } from "./toggleSelection";

type CapsuleListProps = {
  capsules: Capsule[];
  /**
   * Keyed by `CapsuleType.id`, fetched once by the caller and resolved
   * per capsule here — avoids every `CapsuleCard` doing its own db lookup
   * for the same handful of types. A capsule whose `capsuleTypeId` isn't
   * in this map (deleted type) still renders — `CapsuleCard`'s own
   * fallback handles that gracefully.
   */
  capsuleTypesById: Record<string, CapsuleType>;
  onPressCapsule?: (capsule: Capsule) => void;
  /**
   * Bulk-select mode (8.5). Like `FilterSheet`'s own `sortKey`/
   * `sortDirection`, this is fully controlled — the caller
   * (`capsules/index.tsx`) owns `selectedIds` — but the tap-to-toggle
   * transition itself is computed HERE via `toggleSelection` (mirroring
   * `FilterSheet`'s own `toggleSort` usage) and handed up whole via
   * `onSelectionChange`, so the caller never has to know the toggle rule.
   */
  selectionMode?: boolean;
  selectedIds?: Set<string>;
  onSelectionChange?: (nextSelectedIds: Set<string>) => void;
  /**
   * "list" (default, one column) or "card" (8.7 — a 2-column grid).
   * Drives `FlatList`'s own `numColumns` here rather than in the caller —
   * `numColumns` can't change on a live `FlatList` without remounting it
   * (a real React Native constraint, not a stylistic choice), so `key`
   * is set from `viewMode` too, forcing exactly that remount when it
   * changes and never otherwise.
   */
  viewMode?: "list" | "card";
};

/** Renders every capsule as a `CapsuleCard`, or an empty-state message. */
export function CapsuleList({
  capsules,
  capsuleTypesById,
  onPressCapsule,
  selectionMode = false,
  selectedIds,
  onSelectionChange,
  viewMode = "list",
}: CapsuleListProps) {
  if (capsules.length === 0) {
    return (
      <View testID={testIDs.containers.root} style={styles.empty}>
        <Text testID={testIDs.texts.empty} style={styles.emptyLabel}>
          No capsules yet.
        </Text>
      </View>
    );
  }

  const handlePress = (capsule: Capsule) => {
    if (selectionMode) {
      onSelectionChange?.(
        toggleSelection(selectedIds ?? new Set(), capsule.id),
      );
    } else {
      onPressCapsule?.(capsule);
    }
  };

  const numColumns = viewMode === "card" ? 2 : 1;

  return (
    <FlatList
      // Forces a remount on a numColumns change — FlatList doesn't
      // support changing it on a live instance.
      key={viewMode}
      testID={testIDs.containers.root}
      data={capsules}
      numColumns={numColumns}
      columnWrapperStyle={numColumns > 1 ? styles.row : undefined}
      keyExtractor={(capsule) => capsule.id}
      renderItem={({ item }) => (
        <CapsuleCard
          capsule={item}
          capsuleTypeName={capsuleTypesById[item.capsuleTypeId]?.name ?? null}
          onPress={() => handlePress(item)}
          selectionMode={selectionMode}
          selected={selectedIds?.has(item.id) ?? false}
          viewMode={viewMode}
        />
      )}
      contentContainerStyle={styles.content}
    />
  );
}

const styles = StyleSheet.create((theme) => ({
  content: {
    padding: theme.spacing.three,
  },
  row: {
    gap: theme.spacing.two,
  },
  empty: {
    flex: 1,
    padding: theme.spacing.three,
    alignItems: "center",
  },
  emptyLabel: {
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.sans,
    fontSize: 14,
    textAlign: "center",
  },
}));

const testIDs = createComponentTestIDs("CapsuleList", {
  containers: ["root"] as const,
  texts: ["empty"] as const,
});

CapsuleList.testIDs = testIDs;
