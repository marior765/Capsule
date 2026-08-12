import { router } from "expo-router";
import { Pressable, ScrollView, Text } from "react-native";
import { StyleSheet } from "react-native-unistyles";

/**
 * Only routes that actually do something are listed. Screens still to be built
 * (privacy, storage, import/export, sync) get their link when they land —
 * linking to an empty screen is worse than not offering it.
 */
const ENTRIES = [
  {
    label: "Inference",
    hint: "Temperature, sampling, context length",
    href: "/settings/inference",
  },
  {
    label: "Models",
    hint: "Download, select, or delete on-device models",
    href: "/models",
  },
  {
    label: "Personas",
    hint: "Reusable system prompts",
    href: "/personas",
  },
] as const;

export default function SettingsScreen() {
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Settings</Text>
      {ENTRIES.map((entry) => (
        <Pressable
          key={entry.href}
          style={styles.row}
          onPress={() => router.push(entry.href)}
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
