import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { useDb } from "@/app/providers";
import {
  deleteSnippet,
  getAllSnippets,
  insertSnippet,
  updateSnippet,
  type Snippet,
} from "@/entities/snippet";
import { generateId } from "@/shared/lib";
import { createComponentTestIDs } from "@/shared/testing";

export default function SnippetsScreen() {
  const db = useDb();
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const refresh = useCallback(() => setSnippets(getAllSnippets(db)), [db]);
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const resetForm = () => {
    setEditingId(null);
    setTitle("");
    setContent("");
  };

  const handleSave = () => {
    const trimmedTitle = title.trim();
    const trimmedContent = content.trim();
    if (!trimmedTitle || !trimmedContent) return;

    const now = Date.now();
    if (editingId) {
      updateSnippet(db, editingId, {
        title: trimmedTitle,
        content: trimmedContent,
        updatedAt: now,
      });
    } else {
      insertSnippet(db, {
        id: generateId(),
        title: trimmedTitle,
        content: trimmedContent,
        createdAt: now,
        updatedAt: now,
      });
    }
    resetForm();
    refresh();
  };

  const handleEdit = (snippet: Snippet) => {
    setEditingId(snippet.id);
    setTitle(snippet.title);
    setContent(snippet.content);
  };

  const handleDelete = (snippet: Snippet) => {
    deleteSnippet(db, snippet.id);
    if (editingId === snippet.id) resetForm();
    refresh();
  };

  return (
    <ScrollView
      testID={testIDs.containers.root}
      style={styles.root}
      contentContainerStyle={styles.content}
    >
      <Text style={styles.heading}>
        {editingId ? "Edit snippet" : "New snippet"}
      </Text>

      <TextInput
        testID={testIDs.inputs.title}
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        placeholder="Title (e.g. Summarize)"
      />
      <TextInput
        testID={testIDs.inputs.content}
        style={[styles.input, styles.multiline]}
        value={content}
        onChangeText={setContent}
        placeholder="Snippet text"
        multiline
      />

      <View style={styles.formActions}>
        <Pressable
          testID={testIDs.buttons.save}
          style={styles.primary}
          onPress={handleSave}
        >
          <Text style={styles.primaryLabel}>
            {editingId ? "Save changes" : "Create snippet"}
          </Text>
        </Pressable>
        {editingId && (
          <Pressable
            testID={testIDs.buttons.cancel}
            style={styles.secondary}
            onPress={resetForm}
          >
            <Text style={styles.meta}>Cancel</Text>
          </Pressable>
        )}
      </View>

      <Text style={styles.heading}>Your snippets</Text>
      {snippets.length === 0 && (
        <Text testID={testIDs.texts.empty} style={styles.meta}>
          No snippets yet.
        </Text>
      )}
      {snippets.map((snippet) => (
        <View key={snippet.id} style={styles.row}>
          <Pressable
            testID={`${testIDs.pressables.edit}_${snippet.id}`}
            style={styles.rowMain}
            onPress={() => handleEdit(snippet)}
          >
            <Text style={styles.name}>{snippet.title}</Text>
            <Text style={styles.meta} numberOfLines={2}>
              {snippet.content}
            </Text>
          </Pressable>
          <Pressable
            testID={`${testIDs.pressables.delete}_${snippet.id}`}
            onPress={() => handleDelete(snippet)}
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

const testIDs = createComponentTestIDs("SnippetsScreen", {
  containers: ["root"] as const,
  inputs: ["title", "content"] as const,
  buttons: ["save", "cancel"] as const,
  pressables: ["edit", "delete"] as const,
  texts: ["empty"] as const,
});
