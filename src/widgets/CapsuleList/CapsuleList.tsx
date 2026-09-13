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
};

/** Renders every capsule as a `CapsuleCard`, or an empty-state message. */
export function CapsuleList({
  capsules,
  capsuleTypesById,
  onPressCapsule,
  selectionMode = false,
  selectedIds,
  onSelectionChange,
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

  return (
    <FlatList
      testID={testIDs.containers.root}
      data={capsules}
      keyExtractor={(capsule) => capsule.id}
      renderItem={({ item }) => (
        <CapsuleCard
          capsule={item}
          capsuleTypeName={capsuleTypesById[item.capsuleTypeId]?.name ?? null}
          onPress={() => handlePress(item)}
          selectionMode={selectionMode}
          selected={selectedIds?.has(item.id) ?? false}
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
