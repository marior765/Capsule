import { FlatList, Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { createComponentTestIDs } from "@/shared/testing";
import type { Capsule } from "@/entities/capsule";
import type { CapsuleType } from "@/entities/capsule-type";
import { CapsuleCard } from "@/widgets/CapsuleCard";

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
};

/** Renders every capsule as a `CapsuleCard`, or an empty-state message. */
export function CapsuleList({
  capsules,
  capsuleTypesById,
  onPressCapsule,
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

  return (
    <FlatList
      testID={testIDs.containers.root}
      data={capsules}
      keyExtractor={(capsule) => capsule.id}
      renderItem={({ item }) => (
        <CapsuleCard
          capsule={item}
          capsuleTypeName={capsuleTypesById[item.capsuleTypeId]?.name ?? null}
          onPress={() => onPressCapsule?.(item)}
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
