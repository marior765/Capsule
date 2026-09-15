import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { useDb } from "@/app/providers";
import { getCapsuleById, getValuesByCapsule } from "@/entities/capsule";
import {
  validateFields,
  getFieldsByCapsuleType,
  type CapsuleField,
} from "@/entities/field";
import { hasCapsuleEdits, saveCapsuleEdits } from "@/features/edit-capsule";
import { snapshotCapsule } from "@/features/capsule-versioning";
import { createComponentTestIDs } from "@/shared/testing";
import { CapsuleEditor } from "@/widgets/CapsuleEditor";

export default function EditCapsuleScreen() {
  const db = useDb();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [found, setFound] = useState(false);
  const [fields, setFields] = useState<CapsuleField[]>([]);
  const [title, setTitle] = useState("");
  const [values, setValues] = useState<Record<string, string | null>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
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
      setErrors({});
      setInitialTitle(capsule.title);
      setInitialValues(capsuleValues);
    }, [db, id]),
  );

  const handleValueChange = (fieldId: string, value: string | null) => {
    setValues((current) => ({ ...current, [fieldId]: value }));
  };

  const handleSave = () => {
    const fieldErrors = validateFields(fields, values);
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }
    const editInput = {
      title,
      initialTitle,
      values,
      initialValues,
      fieldIds: fields.map((field) => field.id),
    };
    // Snapshot for version history (8.5) BEFORE applying the edit, so the
    // snapshot captures what's still actually persisted right now — and
    // only when something will really change, so an unedited "Save" tap
    // doesn't create a noise history entry. Composed here at the route
    // layer since `features/edit-capsule` and `features/capsule-
    // versioning` can't import each other (FSD forbids cross-feature
    // imports); the route is the one place allowed to reach across both.
    if (hasCapsuleEdits(editInput)) {
      snapshotCapsule(db, id);
    }
    saveCapsuleEdits(db, id, editInput);
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
        errors={errors}
      />
      <Pressable
        testID={testIDs.buttons.save}
        style={styles.primary}
        onPress={handleSave}
        accessibilityRole="button"
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
