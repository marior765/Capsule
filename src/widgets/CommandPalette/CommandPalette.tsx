import { useState } from "react";
import { FlatList, Pressable, Text, TextInput, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { router } from "expo-router";
import type { SQLiteDatabase } from "expo-sqlite";
import type { Capsule } from "@/entities/capsule";
import { searchCapsules } from "@/features/search-capsules";
import { createComponentTestIDs } from "@/shared/testing";
import { filterCommands, type Command } from "./filterCommands";

type CommandPaletteProps = {
  db: SQLiteDatabase;
};

/**
 * Every static, always-available palette entry — one per real, already-
 * existing route in the app. Each `path` is checked against expo-router's
 * own generated `Href` union at compile time (via `filterCommands.ts`'s
 * `Command` type), so a typo'd path here fails `tsc`, not silently 404s
 * on a real device.
 *
 * `"/capsules/new"` earns a real, honest entry point here — the full
 * field-by-field creation screen (unreachable from anywhere else in the
 * app; see 8.6's quick-capture beat, which deliberately left it
 * unwired since the lighter `QuickCapture` flow supersedes it as the
 * PRIMARY path) is still a legitimate, if secondary, way to create a
 * capsule, and a command palette is exactly the right home for a
 * less-common-but-still-valid action like this one.
 */
const COMMANDS: Command[] = [
  { id: "capsules", label: "Capsules", path: "/capsules" },
  {
    id: "new-capsule",
    label: "New capsule (full form)",
    path: "/capsules/new",
  },
  { id: "chat", label: "Chat", path: "/chat" },
  { id: "new-conversation", label: "New conversation", path: "/chat/new" },
  { id: "ephemeral-chat", label: "Ephemeral chat", path: "/chat/ephemeral" },
  { id: "types", label: "Capsule types", path: "/types" },
  { id: "new-type", label: "New capsule type", path: "/types/new" },
  { id: "snippets", label: "Snippets", path: "/snippets" },
  { id: "personas", label: "Personas", path: "/personas" },
  { id: "models", label: "Models", path: "/models" },
  { id: "settings", label: "Settings", path: "/settings" },
  { id: "privacy", label: "Privacy settings", path: "/settings/privacy" },
  {
    id: "inference",
    label: "Inference settings",
    path: "/settings/inference",
  },
];

type ResultItem =
  | { kind: "capsule"; capsule: Capsule }
  | { kind: "command"; command: Command };

/**
 * "Jump to anything" (8.6) — one text input filtering two independent
 * result sources at once: the static `COMMANDS` list (navigation
 * shortcuts, via `filterCommands`) and a live `searchCapsules` query
 * (already fully tested since 6.5) over actual capsule content. Capsule
 * results are shown first — a real record found by title/field-value
 * match is usually more specific, and therefore more useful, than a
 * generic navigation shortcut with a coincidentally similar label.
 *
 * Takes `db` as a prop and calls `searchCapsules` itself, mirroring
 * `WipeDataSettings`/`BulkActionBar`'s own established shape for a widget
 * that composes an already-tested feature function directly rather than
 * making its caller do it.
 */
export function CommandPalette({ db }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [capsuleResults, setCapsuleResults] = useState<Capsule[]>([]);

  const handleQueryChange = (text: string) => {
    setQuery(text);
    setCapsuleResults(text.trim() ? searchCapsules(db, text) : []);
  };

  const commandResults = filterCommands(COMMANDS, query);
  const results: ResultItem[] = [
    ...capsuleResults.map(
      (capsule): ResultItem => ({ kind: "capsule", capsule }),
    ),
    ...commandResults.map(
      (command): ResultItem => ({ kind: "command", command }),
    ),
  ];

  const handleSelect = (item: ResultItem) => {
    if (item.kind === "capsule") {
      router.push(`/capsules/${item.capsule.id}`);
    } else {
      router.push(item.command.path);
    }
    setQuery("");
    setCapsuleResults([]);
  };

  return (
    <View testID={testIDs.containers.root} style={styles.root}>
      <TextInput
        testID={testIDs.inputs.query}
        style={styles.input}
        value={query}
        onChangeText={handleQueryChange}
        placeholder="Search or jump to…"
        autoFocus
        autoCapitalize="none"
        accessibilityLabel="Search or jump to"
      />
      <FlatList
        testID={testIDs.containers.results}
        data={results}
        keyExtractor={(item) =>
          item.kind === "capsule"
            ? `capsule_${item.capsule.id}`
            : `command_${item.command.id}`
        }
        renderItem={({ item }) => (
          <Pressable
            testID={
              item.kind === "capsule"
                ? `${testIDs.pressables.capsuleResult}_${item.capsule.id}`
                : `${testIDs.pressables.command}_${item.command.id}`
            }
            style={styles.row}
            onPress={() => handleSelect(item)}
            accessibilityRole="button"
            accessibilityLabel={
              item.kind === "capsule"
                ? `${item.capsule.title}, capsule`
                : item.command.label
            }
          >
            <Text style={styles.rowLabel}>
              {item.kind === "capsule"
                ? item.capsule.title
                : item.command.label}
            </Text>
            {item.kind === "capsule" && (
              <Text style={styles.rowMeta}>Capsule</Text>
            )}
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  input: {
    backgroundColor: theme.colors.backgroundElement,
    borderRadius: theme.spacing.two,
    marginHorizontal: theme.spacing.three,
    marginTop: theme.spacing.three,
    paddingHorizontal: theme.spacing.two,
    paddingVertical: theme.spacing.two,
    color: theme.colors.text,
    fontFamily: theme.fonts.sans,
    fontSize: 15,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.three,
    paddingVertical: theme.spacing.three,
  },
  rowLabel: {
    color: theme.colors.text,
    fontFamily: theme.fonts.sans,
    fontSize: 15,
  },
  rowMeta: {
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.sans,
    fontSize: 11,
  },
}));

const testIDs = createComponentTestIDs("CommandPalette", {
  containers: ["root", "results"] as const,
  inputs: ["query"] as const,
  pressables: ["command", "capsuleResult"] as const,
});

CommandPalette.testIDs = testIDs;
