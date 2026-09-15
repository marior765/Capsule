import { Pressable, ScrollView, Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import type { Snippet } from "@/entities/snippet";
import { createComponentTestIDs } from "@/shared/testing";

type SnippetPickerProps = {
  /** Already fetched by the caller (`getAllSnippets`) — this widget does no db work of its own. */
  snippets: Snippet[];
  onSelect: (snippet: Snippet) => void;
};

/**
 * Purely controlled, like `TagPicker`/`RelationPicker` — owns no state,
 * does no fetching. Picking a snippet is the caller's cue to insert its
 * `content` (via `ChatInput`'s existing key-remount mechanism, the same
 * one voice transcription already uses) and dismiss the picker; this
 * widget doesn't know or care what "insert" means to its caller.
 */
export function SnippetPicker({ snippets, onSelect }: SnippetPickerProps) {
  if (snippets.length === 0) {
    return (
      <View testID={testIDs.containers.root} style={styles.empty}>
        <Text testID={testIDs.texts.empty} style={styles.emptyLabel}>
          No snippets yet — add some in Settings → Snippets.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      testID={testIDs.containers.root}
      style={styles.root}
      contentContainerStyle={styles.content}
    >
      {snippets.map((snippet) => (
        <Pressable
          key={snippet.id}
          testID={`${testIDs.pressables.snippet}_${snippet.id}`}
          style={styles.row}
          onPress={() => onSelect(snippet)}
          accessibilityRole="button"
          accessibilityLabel={snippet.title}
        >
          <Text style={styles.title}>{snippet.title}</Text>
          <Text style={styles.preview} numberOfLines={1}>
            {snippet.content}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: {
    maxHeight: 200,
    backgroundColor: theme.colors.backgroundElement,
  },
  content: {
    padding: theme.spacing.two,
  },
  row: {
    paddingVertical: theme.spacing.two,
    paddingHorizontal: theme.spacing.three,
    borderRadius: theme.spacing.two,
  },
  title: {
    color: theme.colors.text,
    fontFamily: theme.fonts.sans,
  },
  preview: {
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.sans,
    fontSize: 12,
  },
  empty: {
    padding: theme.spacing.three,
    backgroundColor: theme.colors.backgroundElement,
  },
  emptyLabel: {
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.sans,
    fontSize: 12,
    textAlign: "center",
  },
}));

const testIDs = createComponentTestIDs("SnippetPicker", {
  containers: ["root"] as const,
  pressables: ["snippet"] as const,
  texts: ["empty"] as const,
});

SnippetPicker.testIDs = testIDs;
