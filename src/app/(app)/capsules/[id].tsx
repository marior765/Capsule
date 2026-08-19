import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { useDb } from "@/app/providers";
import {
  getCapsuleById,
  getValuesByCapsule,
  type Capsule,
  type CapsuleValue,
} from "@/entities/capsule";
import { getCapsuleTypeById, type CapsuleType } from "@/entities/capsule-type";
import { getFieldsByCapsuleType, type CapsuleField } from "@/entities/field";
import { deleteCapsule } from "@/features/delete-capsule";
import { createComponentTestIDs } from "@/shared/testing";

export default function CapsuleDetailScreen() {
  const db = useDb();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [capsule, setCapsule] = useState<Capsule | null>(null);
  const [capsuleType, setCapsuleType] = useState<CapsuleType | null>(null);
  const [fields, setFields] = useState<CapsuleField[]>([]);
  const [values, setValues] = useState<CapsuleValue[]>([]);

  useFocusEffect(
    useCallback(() => {
      const found = getCapsuleById(db, id);
      setCapsule(found);
      if (found) {
        setCapsuleType(getCapsuleTypeById(db, found.capsuleTypeId));
        setFields(getFieldsByCapsuleType(db, found.capsuleTypeId));
        setValues(getValuesByCapsule(db, found.id));
      }
    }, [db, id]),
  );

  const handleDelete = () => {
    deleteCapsule(db, id);
    router.replace("/capsules");
  };

  if (!capsule) {
    return (
      <View testID={testIDs.containers.root} style={styles.root}>
        <Text testID={testIDs.texts.notFound} style={styles.meta}>
          This capsule no longer exists.
        </Text>
      </View>
    );
  }

  const valueByFieldId = Object.fromEntries(
    values.map((v) => [v.fieldId, v.value]),
  );

  return (
    <ScrollView
      testID={testIDs.containers.root}
      style={styles.root}
      contentContainerStyle={styles.content}
    >
      <Text style={styles.title}>{capsule.title}</Text>
      <Text style={styles.meta}>{capsuleType?.name ?? "Unknown type"}</Text>

      {fields.map((field) => (
        <View key={field.id} style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>{field.name}</Text>
          <Text style={styles.fieldValue}>
            {valueByFieldId[field.id] || "—"}
          </Text>
        </View>
      ))}

      <Pressable
        testID={testIDs.buttons.edit}
        style={styles.primary}
        onPress={() => router.push(`/capsules/${capsule.id}/edit`)}
      >
        <Text style={styles.primaryLabel}>Edit</Text>
      </Pressable>
      <Pressable
        testID={testIDs.buttons.delete}
        style={styles.secondary}
        onPress={handleDelete}
      >
        <Text style={styles.deleteLabel}>Delete capsule</Text>
      </Pressable>
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
  title: {
    color: theme.colors.text,
    fontFamily: theme.fonts.rounded,
    fontSize: 20,
    marginBottom: theme.spacing.one,
  },
  meta: {
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.sans,
    fontSize: 12,
  },
  fieldRow: {
    marginTop: theme.spacing.three,
  },
  fieldLabel: {
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.sans,
    fontSize: 12,
    marginBottom: theme.spacing.half,
  },
  fieldValue: {
    color: theme.colors.text,
    fontFamily: theme.fonts.sans,
    fontSize: 15,
  },
  primary: {
    alignItems: "center",
    paddingVertical: theme.spacing.three,
    borderRadius: theme.spacing.two,
    backgroundColor: theme.colors.backgroundSelected,
    marginTop: theme.spacing.four,
  },
  primaryLabel: {
    color: theme.colors.text,
    fontFamily: theme.fonts.rounded,
  },
  secondary: {
    alignItems: "center",
    paddingVertical: theme.spacing.three,
    marginTop: theme.spacing.two,
  },
  deleteLabel: {
    color: theme.colors.danger,
    fontFamily: theme.fonts.rounded,
  },
}));

const testIDs = createComponentTestIDs("CapsuleDetailScreen", {
  containers: ["root"] as const,
  buttons: ["edit", "delete"] as const,
  texts: ["notFound"] as const,
});
