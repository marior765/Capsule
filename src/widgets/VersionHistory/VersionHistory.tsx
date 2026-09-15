import { Pressable, Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import type { CapsuleVersion } from "@/entities/capsule";
import { createComponentTestIDs } from "@/shared/testing";

type VersionHistoryProps = {
  /** Already fetched by the caller (`getCapsuleHistory`), most recent first. */
  versions: CapsuleVersion[];
  onRestore: (versionId: string) => void;
};

/**
 * Purely controlled, like `TagPicker`/`RelationPicker` — owns no state,
 * does no persistence, knows nothing about which capsule this history
 * belongs to. Renders nothing when there's no history yet, rather than an
 * empty-state message — a brand-new, never-edited capsule having no
 * history is the normal case, not a gap worth calling out (unlike
 * `RelationPicker`'s "Missing capsule," which flags an actual data
 * problem).
 */
export function VersionHistory({ versions, onRestore }: VersionHistoryProps) {
  if (versions.length === 0) return null;

  return (
    <View testID={testIDs.containers.root} style={styles.root}>
      <Text style={styles.heading}>History</Text>
      {versions.map((version) => (
        <View key={version.id} style={styles.row}>
          <View style={styles.info}>
            <Text style={styles.title}>{version.title}</Text>
            <Text style={styles.timestamp}>
              {new Date(version.createdAt).toLocaleString()}
            </Text>
          </View>
          <Pressable
            testID={`${testIDs.pressables.restore}_${version.id}`}
            onPress={() => onRestore(version.id)}
            accessibilityRole="button"
            accessibilityLabel={`Restore version "${version.title}" from ${new Date(version.createdAt).toLocaleString()}`}
          >
            <Text style={styles.restoreLabel}>Restore</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: {
    marginTop: theme.spacing.three,
  },
  heading: {
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.sans,
    fontSize: 12,
    marginBottom: theme.spacing.one,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: theme.spacing.one,
  },
  info: {
    flex: 1,
  },
  title: {
    color: theme.colors.text,
    fontFamily: theme.fonts.sans,
    fontSize: 14,
  },
  timestamp: {
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.sans,
    fontSize: 11,
  },
  restoreLabel: {
    color: theme.colors.accent,
    fontFamily: theme.fonts.rounded,
    fontSize: 13,
  },
}));

const testIDs = createComponentTestIDs("VersionHistory", {
  containers: ["root"] as const,
  pressables: ["restore"] as const,
});

VersionHistory.testIDs = testIDs;
