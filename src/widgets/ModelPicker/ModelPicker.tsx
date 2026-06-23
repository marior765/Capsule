import { totalMemory } from "expo-device";
import { FlatList, Pressable, Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import type { Model } from "@/entities/model";
import { createComponentTestIDs } from "@/shared/testing";
import { recommendModels, type RecommendedModel } from "./recommend";

type ModelPickerProps = {
  models: Model[];
  ramBytes?: number | null;
  activeModelId?: string;
  onSelect: (model: Model) => void;
};

function formatGB(bytes: number): string {
  return `${(bytes / 1_000_000_000).toFixed(1)} GB`;
}

export function ModelPicker({
  models,
  ramBytes = totalMemory,
  activeModelId,
  onSelect,
}: ModelPickerProps) {
  const recommended = recommendModels(ramBytes, models);

  const renderItem = ({ item }: { item: RecommendedModel }) => {
    const isActive = item.id === activeModelId;
    return (
      <Pressable
        testID={`${testIDs.pressables.row}_${item.id}`}
        style={[styles.row, isActive && styles.rowActive]}
        onPress={() => onSelect(item)}
      >
        <View style={styles.rowText}>
          <Text testID={testIDs.texts.name} style={styles.name}>
            {item.name}
          </Text>
          <Text testID={testIDs.texts.meta} style={styles.meta}>
            {item.parameters} · {item.quantization} · {formatGB(item.size)}
          </Text>
        </View>
        {item.fits && (
          <Text testID={testIDs.labels.recommended} style={styles.badge}>
            Recommended
          </Text>
        )}
      </Pressable>
    );
  };

  return (
    <View testID={testIDs.containers.root} style={styles.root}>
      <FlatList
        data={recommended}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
      />
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: theme.spacing.three,
    paddingHorizontal: theme.spacing.three,
    backgroundColor: theme.colors.backgroundElement,
    marginBottom: theme.spacing.two,
    borderRadius: theme.spacing.two,
  },
  rowActive: {
    backgroundColor: theme.colors.backgroundSelected,
  },
  rowText: {
    flexShrink: 1,
  },
  name: {
    color: theme.colors.text,
    fontFamily: theme.fonts.sans,
  },
  meta: {
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.sans,
  },
  badge: {
    color: theme.colors.text,
    fontFamily: theme.fonts.rounded,
  },
}));

const testIDs = createComponentTestIDs("ModelPicker", {
  containers: ["root"] as const,
  pressables: ["row"] as const,
  texts: ["name", "meta"] as const,
  labels: ["recommended"] as const,
});

ModelPicker.testIDs = testIDs;
