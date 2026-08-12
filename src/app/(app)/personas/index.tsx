import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
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

export default function PersonasScreen() {
  const db = useDb();
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");

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
  };

  const handleDelete = (persona: Persona) => {
    // Conversations referencing this persona keep a dangling id and simply
    // stop applying a system prompt — no cascade needed.
    deletePersona(db, persona.id);
    if (editingId === persona.id) resetForm();
    refresh();
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>
        {editingId ? "Edit persona" : "New persona"}
      </Text>

      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="Name (e.g. Code reviewer)"
      />
      <TextInput
        style={[styles.input, styles.multiline]}
        value={systemPrompt}
        onChangeText={setSystemPrompt}
        placeholder="System prompt"
        multiline
      />

      <View style={styles.formActions}>
        <Pressable style={styles.primary} onPress={handleSave}>
          <Text style={styles.primaryLabel}>
            {editingId ? "Save changes" : "Create persona"}
          </Text>
        </Pressable>
        {editingId && (
          <Pressable style={styles.secondary} onPress={resetForm}>
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
          <Pressable style={styles.rowMain} onPress={() => handleEdit(persona)}>
            <Text style={styles.name}>{persona.name}</Text>
            <Text style={styles.meta} numberOfLines={2}>
              {persona.systemPrompt}
            </Text>
          </Pressable>
          <Pressable onPress={() => handleDelete(persona)}>
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
  delete: {
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.rounded,
    paddingLeft: theme.spacing.three,
  },
}));
