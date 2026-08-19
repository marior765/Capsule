import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { useDb } from "@/app/providers";
import { getCapsuleById, getValuesByCapsule } from "@/entities/capsule";
import { getFieldsByCapsuleType, type CapsuleField } from "@/entities/field";
import { saveCapsuleEdits } from "@/features/edit-capsule";
import { createComponentTestIDs } from "@/shared/testing";
import { CapsuleEditor } from "@/widgets/CapsuleEditor";

export default function EditCapsuleScreen() {
  const db = useDb();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [found, setFound] = useState(false);
  const [fields, setFields] = useState<CapsuleField[]>([]);
  const [title, setTitle] = useState("");
  const [values, setValues] = useState<Record<string, string | null>>({});
  // Snapshot of what's actually persisted right now, taken on load —
  // `saveCapsuleEdits` diffs the current (edited) state against this rather
  // than writing every field unconditionally, so an untouched field never
  // gets a pointless upsertCapsuleValue call (a fresh id/updatedAt, and a
  // capsule.updatedAt bump per setCapsuleFieldValue's own contract) for a
  // value that never changed.
  const [initialTitle, setInitialTitle] = useState("");
  const [initialValues, setInitialValues] = useState<
    Record<string, string | null>
  >({});

  useFocusEffect(
    useCallback(() => {
      const capsule = getCapsuleById(db, id);
      setFound(capsule !== null);
      if (!capsule) return;

      const capsuleFields = getFieldsByCapsuleType(db, capsule.capsuleTypeId);
      const capsuleValues = Object.fromEntries(
        getValuesByCapsule(db, capsule.id).map((v) => [v.fieldId, v.value]),
      );

      setFields(capsuleFields);
      setTitle(capsule.title);
      setValues(capsuleValues);
      setInitialTitle(capsule.title);
      setInitialValues(capsuleValues);
    }, [db, id]),
  );

  const handleValueChange = (fieldId: string, value: string | null) => {
    setValues((current) => ({ ...current, [fieldId]: value }));
  };

  const handleSave = () => {
    saveCapsuleEdits(db, id, {
      title,
      initialTitle,
      values,
      initialValues,
      fieldIds: fields.map((field) => field.id),
    });
    router.replace(`/capsules/${id}`);
  };

  if (!found) {
    return (
      <View testID={testIDs.containers.root} style={styles.root}>
        <Text testID={testIDs.texts.notFound} style={styles.meta}>
          This capsule no longer exists.
        </Text>
      </View>
    );
  }

  return (
    <View testID={testIDs.containers.root} style={styles.root}>
      <CapsuleEditor
        title={title}
        onTitleChange={setTitle}
        fields={fields}
        values={values}
        onValueChange={handleValueChange}
      />
      <Pressable
        testID={testIDs.buttons.save}
        style={styles.primary}
        onPress={handleSave}
      >
        <Text style={styles.primaryLabel}>Save changes</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  meta: {
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.sans,
    fontSize: 12,
    padding: theme.spacing.three,
  },
  primary: {
    alignItems: "center",
    paddingVertical: theme.spacing.three,
    borderRadius: theme.spacing.two,
    backgroundColor: theme.colors.backgroundSelected,
    margin: theme.spacing.three,
  },
  primaryLabel: {
    color: theme.colors.text,
    fontFamily: theme.fonts.rounded,
  },
}));

const testIDs = createComponentTestIDs("EditCapsuleScreen", {
  containers: ["root"] as const,
  buttons: ["save"] as const,
  texts: ["notFound"] as const,
});
