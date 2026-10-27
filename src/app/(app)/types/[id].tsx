import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { useDb } from "@/app/providers";
import {
  addField,
  deleteCapsuleType,
  DuplicateFieldNameError,
  getCapsuleTypeById,
  getFieldsByCapsuleType,
  removeField,
  renameCapsuleType,
  reorderFields,
  setCapsuleTypeDescription,
  updateField,
  type CapsuleType,
} from "@/features/manage-schema";
import { leaveScreen } from "@/shared/navigation";
import { createComponentTestIDs } from "@/shared/testing";
import { SchemaBuilder, type FieldDraft } from "@/widgets/SchemaBuilder";

export default function TypeDetailScreen() {
  const db = useDb();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [capsuleType, setCapsuleType] = useState<CapsuleType | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [fields, setFields] = useState<FieldDraft[]>([]);

  const refresh = useCallback(() => {
    const found = getCapsuleTypeById(db, id);
    setCapsuleType(found);
    if (found) {
      setName(found.name);
      setDescription(found.description ?? "");
      setFields(
        getFieldsByCapsuleType(db, id).map((f) => ({
          id: f.id,
          name: f.name,
          fieldType: f.fieldType,
          required: f.required,
        })),
      );
    }
  }, [db, id]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  // Field mutations apply immediately -- this type already exists, unlike
  // types/new.tsx's still-unsaved draft, so there's no "unsaved changes"
  // state to reconcile. Each handler re-fetches from manage-schema rather
  // than hand-patching local state, so this screen can never drift out of
  // sync with what's actually persisted.
  const handleAddField = (draft: Omit<FieldDraft, "id">) => {
    try {
      addField(db, id, draft);
    } catch (e) {
      // SchemaBuilder already refuses a duplicate as it's typed; backstop.
      if (e instanceof DuplicateFieldNameError) {
        Alert.alert("Can't add field", e.message);
        return;
      }
      throw e;
    }
    refresh();
  };

  const handleRemoveField = (fieldId: string) => {
    removeField(db, fieldId);
    refresh();
  };

  const handleToggleRequired = (fieldId: string) => {
    const field = fields.find((f) => f.id === fieldId);
    if (!field) return;
    updateField(db, fieldId, { required: !field.required });
    refresh();
  };

  const handleReorder = (nextFields: FieldDraft[]) => {
    reorderFields(
      db,
      id,
      nextFields.map((f) => f.id),
    );
    refresh();
  };

  const handleSaveMeta = () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    renameCapsuleType(db, id, trimmedName);
    setCapsuleTypeDescription(db, id, description.trim() || null);
    refresh();
  };

  const handleDelete = () => {
    deleteCapsuleType(db, id);
    leaveScreen(router, "/types");
  };

  if (!capsuleType) {
    return (
      <View testID={testIDs.containers.root} style={styles.root}>
        <Text testID={testIDs.texts.notFound} style={styles.meta}>
          This capsule type no longer exists.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      testID={testIDs.containers.root}
      style={styles.root}
      contentContainerStyle={styles.content}
    >
      <SchemaBuilder
        name={name}
        onNameChange={setName}
        description={description}
        onDescriptionChange={setDescription}
        fields={fields}
        onAddField={handleAddField}
        onRemoveField={handleRemoveField}
        onToggleRequired={handleToggleRequired}
        onReorder={handleReorder}
      />
      <Pressable
        testID={testIDs.buttons.saveMeta}
        style={[styles.primary, !name.trim() && styles.primaryDisabled]}
        onPress={handleSaveMeta}
        disabled={!name.trim()}
        accessibilityRole="button"
        accessibilityState={{ disabled: !name.trim() }}
      >
        <Text style={styles.primaryLabel}>Save name & description</Text>
      </Pressable>
      <Pressable
        testID={testIDs.buttons.delete}
        style={styles.secondary}
        onPress={handleDelete}
        accessibilityRole="button"
      >
        <Text style={styles.deleteLabel}>Delete type</Text>
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
  meta: {
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.sans,
    fontSize: 12,
    padding: theme.spacing.three,
  },
  primaryDisabled: {
    opacity: 0.5,
  },
  primary: {
    alignItems: "center",
    paddingVertical: theme.spacing.three,
    borderRadius: theme.spacing.two,
    backgroundColor: theme.colors.backgroundSelected,
    marginTop: theme.spacing.three,
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

const testIDs = createComponentTestIDs("TypeDetailScreen", {
  containers: ["root"] as const,
  buttons: ["saveMeta", "delete"] as const,
  texts: ["notFound"] as const,
});

TypeDetailScreen.testIDs = testIDs;
