import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { useDb } from "@/app/providers";
import { createCapsuleType } from "@/features/manage-schema";
import { generateId } from "@/shared/lib";
import { createComponentTestIDs } from "@/shared/testing";
import { SchemaBuilder, type FieldDraft } from "@/widgets/SchemaBuilder";

export default function NewTypeScreen() {
  const db = useDb();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [fields, setFields] = useState<FieldDraft[]>([]);

  // Nothing is persisted until "Create type" is pressed -- fields staged
  // here only ever exist in this screen's own local state, keyed by a
  // client-generated id `manage-schema`'s createCapsuleType never sees
  // (it assigns every field's real id itself on insert).
  const handleAddField = (draft: Omit<FieldDraft, "id">) => {
    setFields((current) => [...current, { ...draft, id: generateId() }]);
  };

  const handleRemoveField = (fieldId: string) => {
    setFields((current) => current.filter((f) => f.id !== fieldId));
  };

  const handleToggleRequired = (fieldId: string) => {
    setFields((current) =>
      current.map((f) =>
        f.id === fieldId ? { ...f, required: !f.required } : f,
      ),
    );
  };

  const handleCreate = () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    createCapsuleType(db, {
      name: trimmedName,
      description: description.trim() || null,
      fields: fields.map((f) => ({
        name: f.name,
        fieldType: f.fieldType,
        required: f.required,
      })),
    });
    router.replace("/types");
  };

  return (
    <ScrollView
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
        onReorder={setFields}
      />
      <Pressable
        testID={testIDs.buttons.create}
        style={[styles.primary, !name.trim() && styles.primaryDisabled]}
        onPress={handleCreate}
        disabled={!name.trim()}
      >
        <Text style={styles.primaryLabel}>Create type</Text>
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
  primary: {
    alignItems: "center",
    paddingVertical: theme.spacing.three,
    borderRadius: theme.spacing.two,
    backgroundColor: theme.colors.backgroundSelected,
    marginTop: theme.spacing.three,
  },
  primaryDisabled: {
    opacity: 0.5,
  },
  primaryLabel: {
    color: theme.colors.text,
    fontFamily: theme.fonts.rounded,
  },
}));

const testIDs = createComponentTestIDs("NewTypeScreen", {
  containers: ["root"] as const,
  buttons: ["create"] as const,
});
