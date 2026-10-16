import { router } from "expo-router";
import { Pressable, ScrollView, Text } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { createComponentTestIDs } from "@/shared/testing";

/**
 * Only routes that actually do something are listed. Screens still to be
 * built (appearance, storage, sync) get their link when they land —
 * linking to an empty screen is worse than not offering it.
 */
const ENTRIES = [
  {
    id: "inference",
    label: "Inference",
    hint: "Temperature, sampling, context length",
    href: "/settings/inference",
  },
  {
    id: "models",
    label: "Models",
    hint: "Download, select, or delete on-device models",
    href: "/models",
  },
  {
    id: "personas",
    label: "Personas",
    hint: "Reusable system prompts",
    href: "/personas",
  },
  {
    id: "snippets",
    label: "Snippets",
    hint: "Reusable prompt text for chat",
    href: "/snippets",
  },
  {
    id: "privacy",
    label: "Privacy",
    hint: "App lock, activity log, erase everything",
    href: "/settings/privacy",
  },
  {
    id: "importExport",
    label: "Import & Export",
    hint: "Backups, exports, and imports from other apps",
    href: "/settings/import-export",
  },
] as const;

export default function SettingsScreen() {
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      style={styles.root}
      contentContainerStyle={styles.content}
    >
      <Text style={styles.heading}>Settings</Text>
      {ENTRIES.map((entry) => (
        <Pressable
          testID={`${testIDs.pressables.entry}_${entry.id}`}
          key={entry.id}
          style={styles.row}
          onPress={() => router.push(entry.href)}
          accessibilityRole="button"
          accessibilityLabel={`${entry.label}. ${entry.hint}`}
        >
          <Text style={styles.label}>{entry.label}</Text>
          <Text style={styles.meta}>{entry.hint}</Text>
        </Pressable>
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
    marginBottom: theme.spacing.three,
  },
  row: {
    backgroundColor: theme.colors.backgroundElement,
    padding: theme.spacing.three,
    borderRadius: theme.spacing.two,
    marginBottom: theme.spacing.two,
  },
  label: {
    color: theme.colors.text,
    fontFamily: theme.fonts.sans,
  },
  meta: {
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.sans,
    fontSize: 12,
  },
}));

const testIDs = createComponentTestIDs("SettingsScreen", {
  pressables: ["entry"] as const,
});

SettingsScreen.testIDs = testIDs;
