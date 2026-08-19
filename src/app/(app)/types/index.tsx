import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { useDb } from "@/app/providers";
import { getAllCapsuleTypes, type CapsuleType } from "@/entities/capsule-type";
import { deleteCapsuleType } from "@/features/manage-schema";
import { createComponentTestIDs } from "@/shared/testing";

export default function TypesListScreen() {
  const db = useDb();
  const [capsuleTypes, setCapsuleTypes] = useState<CapsuleType[]>([]);

  const refresh = useCallback(
    () => setCapsuleTypes(getAllCapsuleTypes(db)),
    [db],
  );
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const handleDelete = (capsuleType: CapsuleType) => {
    // Cascades to the type's own fields but not to any capsule of this
    // type -- see manage-schema's deleteCapsuleType doc comment. Existing
    // capsules degrade gracefully (CapsuleCard's "Unknown type" fallback,
    // 6.3), same as any other dangling capsuleTypeId.
    deleteCapsuleType(db, capsuleType.id);
    refresh();
  };

  return (
    <ScrollView
      testID={testIDs.containers.root}
      style={styles.root}
      contentContainerStyle={styles.content}
    >
      <Pressable
        testID={testIDs.buttons.newType}
        style={styles.primary}
        onPress={() => router.push("/types/new")}
      >
        <Text style={styles.primaryLabel}>New type</Text>
      </Pressable>

      {capsuleTypes.length === 0 && (
        <Text testID={testIDs.texts.empty} style={styles.meta}>
          No capsule types yet — create one to start adding capsules.
        </Text>
      )}
      {capsuleTypes.map((capsuleType) => (
        <View
          key={capsuleType.id}
          testID={`${testIDs.containers.row}_${capsuleType.id}`}
          style={styles.row}
        >
          <Pressable
            testID={`${testIDs.pressables.row}_${capsuleType.id}`}
            style={styles.rowMain}
            onPress={() => router.push(`/types/${capsuleType.id}`)}
          >
            <Text style={styles.name}>{capsuleType.name}</Text>
            {capsuleType.description && (
              <Text style={styles.meta} numberOfLines={2}>
                {capsuleType.description}
              </Text>
            )}
          </Pressable>
          <Pressable
            testID={`${testIDs.buttons.delete}_${capsuleType.id}`}
            onPress={() => handleDelete(capsuleType)}
          >
            <Text style={styles.delete}>Delete</Text>
          </Pressable>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    padding: theme.spacing.three,
  },
  primary: {
    alignItems: "center",
    paddingVertical: theme.spacing.three,
    borderRadius: theme.spacing.two,
    backgroundColor: theme.colors.backgroundSelected,
    marginBottom: theme.spacing.three,
  },
  primaryLabel: {
    color: theme.colors.text,
    fontFamily: theme.fonts.rounded,
  },
  meta: {
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.sans,
    fontSize: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: theme.colors.backgroundElement,
    padding: theme.spacing.three,
    borderRadius: theme.spacing.two,
    marginBottom: theme.spacing.two,
  },
  rowMain: {
    flex: 1,
  },
  name: {
    color: theme.colors.text,
    fontFamily: theme.fonts.sans,
  },
  delete: {
    color: theme.colors.danger,
    fontFamily: theme.fonts.rounded,
    fontSize: 12,
    paddingLeft: theme.spacing.three,
  },
}));

const testIDs = createComponentTestIDs("TypesListScreen", {
  containers: ["root", "row"] as const,
  buttons: ["newType", "delete"] as const,
  pressables: ["row"] as const,
  texts: ["empty"] as const,
});
