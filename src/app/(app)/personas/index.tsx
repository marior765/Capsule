import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState, type ComponentRef } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { useDb } from "@/app/providers";
import {
  deletePersona,
  getAllPersonas,
  insertPersona,
  updatePersona,
  type Persona,
} from "@/entities/persona";
import { generateId } from "@/shared/lib";
import { createComponentTestIDs } from "@/shared/testing";

export default function PersonasScreen() {
  const db = useDb();
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  // Like "Create type": greyed out until the required fields have text,
  // rather than looking tappable and silently doing nothing.
  const canSave = name.trim() !== "" && systemPrompt.trim() !== "";
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);

  const refresh = useCallback(() => setPersonas(getAllPersonas(db)), [db]);
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setSystemPrompt("");
  };

  const handleSave = () => {
    const trimmedName = name.trim();
    const trimmedPrompt = systemPrompt.trim();
    if (!trimmedName || !trimmedPrompt) return;

    const now = Date.now();
    if (editingId) {
      updatePersona(db, editingId, {
        name: trimmedName,
        systemPrompt: trimmedPrompt,
        updatedAt: now,
      });
    } else {
      insertPersona(db, {
        id: generateId(),
        name: trimmedName,
        systemPrompt: trimmedPrompt,
        createdAt: now,
        updatedAt: now,
      });
    }
    resetForm();
    refresh();
  };

  const handleEdit = (persona: Persona) => {
    setEditingId(persona.id);
    setName(persona.name);
    setSystemPrompt(persona.systemPrompt);
    // The form sits above the list — bring it into view, or a tap far down
    // the list looks like it did nothing.
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  const handleDelete = (persona: Persona) => {
    // Conversations referencing this persona keep a dangling id and simply
    // stop applying a system prompt — no cascade needed.
    deletePersona(db, persona.id);
    if (editingId === persona.id) resetForm();
    refresh();
  };

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      ref={scrollRef}
      style={styles.root}
      contentContainerStyle={styles.content}
    >
      <Text style={styles.heading}>
        {editingId ? "Edit persona" : "New persona"}
      </Text>

      <TextInput
        testID={testIDs.inputs.name}
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="Name (e.g. Code reviewer)"
        accessibilityLabel="Persona name"
      />
      <TextInput
        testID={testIDs.inputs.systemPrompt}
        style={[styles.input, styles.multiline]}
        value={systemPrompt}
        onChangeText={setSystemPrompt}
        placeholder="System prompt"
        accessibilityLabel="System prompt"
        multiline
      />

      <View style={styles.formActions}>
        <Pressable
          testID={testIDs.buttons.save}
          style={[styles.primary, !canSave && styles.primaryDisabled]}
          onPress={handleSave}
          disabled={!canSave}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canSave }}
        >
          <Text style={styles.primaryLabel}>
            {editingId ? "Save changes" : "Create persona"}
          </Text>
        </Pressable>
        {editingId && (
          <Pressable
            testID={testIDs.buttons.cancel}
            style={styles.secondary}
            onPress={resetForm}
            accessibilityRole="button"
          >
            <Text style={styles.meta}>Cancel</Text>
          </Pressable>
        )}
      </View>

      <Text style={styles.heading}>Your personas</Text>
      {personas.length === 0 && (
        <Text style={styles.meta}>No personas yet.</Text>
      )}
      {personas.map((persona) => (
        <View key={persona.id} style={styles.row}>
          <Pressable
            testID={`${testIDs.pressables.persona}_${persona.id}`}
            style={styles.rowMain}
            onPress={() => handleEdit(persona)}
            accessibilityRole="button"
            accessibilityLabel={persona.name}
            accessibilityHint="Opens it for editing"
          >
            <Text style={styles.name}>{persona.name}</Text>
            <Text style={styles.meta} numberOfLines={2}>
              {persona.systemPrompt}
            </Text>
          </Pressable>
          <Pressable
            testID={`${testIDs.buttons.edit}_${persona.id}`}
            onPress={() => handleEdit(persona)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Edit ${persona.name}`}
          >
            <Text style={styles.edit}>Edit</Text>
          </Pressable>
          <Pressable
            testID={`${testIDs.buttons.delete}_${persona.id}`}
            hitSlop={8}
            onPress={() => handleDelete(persona)}
            accessibilityRole="button"
            accessibilityLabel={`Delete ${persona.name}`}
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
  heading: {
    color: theme.colors.text,
    fontFamily: theme.fonts.rounded,
    marginTop: theme.spacing.three,
    marginBottom: theme.spacing.two,
  },
  input: {
    backgroundColor: theme.colors.backgroundElement,
    color: theme.colors.text,
    fontFamily: theme.fonts.sans,
    padding: theme.spacing.three,
    borderRadius: theme.spacing.two,
    marginBottom: theme.spacing.two,
  },
  multiline: {
    minHeight: 96,
    textAlignVertical: "top",
  },
  formActions: {
    flexDirection: "row",
    gap: theme.spacing.two,
    alignItems: "center",
  },
  primary: {
    flex: 1,
    alignItems: "center",
    paddingVertical: theme.spacing.three,
    borderRadius: theme.spacing.two,
    backgroundColor: theme.colors.backgroundSelected,
  },
  primaryDisabled: {
    opacity: 0.5,
  },
  primaryLabel: {
    color: theme.colors.text,
    fontFamily: theme.fonts.rounded,
  },
  secondary: {
    paddingHorizontal: theme.spacing.three,
    paddingVertical: theme.spacing.three,
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
  meta: {
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.sans,
    fontSize: 12,
  },
  edit: {
    color: theme.colors.accent,
    fontFamily: theme.fonts.rounded,
    paddingLeft: theme.spacing.three,
  },
  delete: {
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.rounded,
    paddingLeft: theme.spacing.three,
  },
}));

const testIDs = createComponentTestIDs("PersonasScreen", {
  inputs: ["name", "systemPrompt"] as const,
  buttons: ["save", "cancel", "edit", "delete"] as const,
  pressables: ["persona"] as const,
});

PersonasScreen.testIDs = testIDs;
