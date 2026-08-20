import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import type { Tag } from "@/entities/tag";
import { createComponentTestIDs } from "@/shared/testing";

type TagPickerProps = {
  /** Already fetched by the caller — the tags currently attached to whatever this is editing. */
  tags: Tag[];
  onAddTag: (name: string) => void;
  onRemoveTag: (tagId: string) => void;
};

/**
 * Purely controlled, like `CapsuleEditor`/`SchemaBuilder` — owns no
 * knowledge of what it's tagging, does no persistence itself. The "what's
 * being typed for a new tag" text is local, throwaway state (mirrors
 * `SchemaBuilder`'s own `draftName`) — it's discarded the moment
 * `onAddTag` fires, never part of the controlled `tags` list.
 */
export function TagPicker({ tags, onAddTag, onRemoveTag }: TagPickerProps) {
  const [draftName, setDraftName] = useState("");

  const handleAdd = () => {
    const trimmed = draftName.trim();
    if (!trimmed) return;
    onAddTag(trimmed);
    setDraftName("");
  };

  return (
    <View testID={testIDs.containers.root} style={styles.root}>
      {tags.length > 0 && (
        <View style={styles.row}>
          {tags.map((tag) => (
            <View key={tag.id} style={styles.chip}>
              <Text style={styles.chipLabel}>{tag.name}</Text>
              <Pressable
                testID={`${testIDs.pressables.removeTag}_${tag.id}`}
                onPress={() => onRemoveTag(tag.id)}
              >
                <Text style={styles.removeLabel}>✕</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}
      <View style={styles.addRow}>
        <TextInput
          testID={testIDs.inputs.newTagName}
          style={styles.input}
          value={draftName}
          onChangeText={setDraftName}
          placeholder="Add a tag"
          autoCapitalize="none"
          returnKeyType="done"
          onSubmitEditing={handleAdd}
        />
        <Pressable
          testID={testIDs.buttons.add}
          style={styles.addButton}
          onPress={handleAdd}
        >
          <Text style={styles.addLabel}>Add</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: {
    marginTop: theme.spacing.three,
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.one,
    marginBottom: theme.spacing.two,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.one,
    backgroundColor: theme.colors.backgroundElement,
    paddingHorizontal: theme.spacing.two,
    paddingVertical: theme.spacing.one,
    borderRadius: theme.spacing.two,
  },
  chipLabel: {
    color: theme.colors.text,
    fontFamily: theme.fonts.sans,
    fontSize: 13,
  },
  removeLabel: {
    color: theme.colors.textSecondary,
    fontSize: 12,
  },
  addRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.two,
  },
  input: {
    flex: 1,
    backgroundColor: theme.colors.backgroundElement,
    borderRadius: theme.spacing.two,
    paddingHorizontal: theme.spacing.two,
    paddingVertical: theme.spacing.one,
    color: theme.colors.text,
    fontFamily: theme.fonts.sans,
    fontSize: 14,
  },
  addButton: {
    paddingHorizontal: theme.spacing.two,
    paddingVertical: theme.spacing.one,
  },
  addLabel: {
    color: theme.colors.accent,
    fontFamily: theme.fonts.rounded,
    fontSize: 13,
  },
}));

const testIDs = createComponentTestIDs("TagPicker", {
  containers: ["root"] as const,
  pressables: ["removeTag"] as const,
  inputs: ["newTagName"] as const,
  buttons: ["add"] as const,
});

TagPicker.testIDs = testIDs;
