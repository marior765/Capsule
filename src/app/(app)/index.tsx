import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { createComponentTestIDs } from "@/shared/testing";

/**
 * The Home tab — was an empty scaffold stub. `docs/ARCHITECTURE.md`
 * envisions this eventually as "recent conversations + pinned capsules,"
 * but pinning/favorites doesn't exist as a data-model concept anywhere
 * yet (a separate, not-yet-started app-wide feature) — building that
 * full dashboard here would be well outside 8.6's actual scope. This is
 * deliberately a minimal, honest placeholder instead: a lightweight
 * launcher giving Home its first real content (not nothing) and the
 * command palette (8.6) an actual, reachable entry point, without
 * pretending to be the richer screen this tab will eventually become.
 */
export default function HomeScreen() {
  return (
    <View testID={testIDs.containers.root} style={styles.root}>
      <Text style={styles.heading}>Capsule</Text>
      <Pressable
        testID={testIDs.pressables.openSearch}
        style={styles.searchTrigger}
        onPress={() => router.push("/search")}
        accessibilityRole="button"
        accessibilityLabel="Search or jump to"
      >
        <Text style={styles.searchTriggerLabel}>Search or jump to…</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
    padding: theme.spacing.three,
  },
  heading: {
    color: theme.colors.text,
    fontFamily: theme.fonts.rounded,
    fontSize: 22,
    marginTop: theme.spacing.four,
    marginBottom: theme.spacing.three,
  },
  searchTrigger: {
    backgroundColor: theme.colors.backgroundElement,
    borderRadius: theme.spacing.two,
    paddingHorizontal: theme.spacing.three,
    paddingVertical: theme.spacing.three,
  },
  searchTriggerLabel: {
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.sans,
    fontSize: 14,
  },
}));

const testIDs = createComponentTestIDs("HomeScreen", {
  containers: ["root"] as const,
  pressables: ["openSearch"] as const,
});
