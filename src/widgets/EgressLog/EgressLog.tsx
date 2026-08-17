import { ScrollView, Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { createComponentTestIDs } from "@/shared/testing";
import type { AuditEntry } from "@/entities/audit";
import { formatAuditAction, formatAuditTimestamp } from "./formatAuditEntry";

type EgressLogProps = {
  /** Caller-fetched, like every other list widget in this app (e.g.
   * ModelsScreen) — this widget renders, it doesn't own db access. */
  entries: AuditEntry[];
};

/**
 * The audit-log viewer named in CLAUDE.md's "Verifiable privacy" feature —
 * a plain, append-only list (entities/audit enforces append-only at the
 * SQL level; this widget just displays it). `entries` should already be in
 * the order the caller wants shown (getAllAuditEntries returns newest
 * first).
 */
export function EgressLog({ entries }: EgressLogProps) {
  if (entries.length === 0) {
    return (
      <View testID={testIDs.containers.root} style={styles.empty}>
        <Text testID={testIDs.texts.empty} style={styles.emptyLabel}>
          No privacy-sensitive activity recorded yet.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView testID={testIDs.containers.root} style={styles.root}>
      {entries.map((entry) => (
        <View key={entry.id} style={styles.row}>
          <Text style={styles.action}>{formatAuditAction(entry.action)}</Text>
          {entry.detail !== null && (
            <Text style={styles.detail}>{entry.detail}</Text>
          )}
          <Text style={styles.timestamp}>
            {formatAuditTimestamp(entry.createdAt)}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: {
    flex: 1,
  },
  empty: {
    padding: theme.spacing.three,
    alignItems: "center",
  },
  emptyLabel: {
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.sans,
    fontSize: 14,
    textAlign: "center",
  },
  row: {
    paddingVertical: theme.spacing.two,
    paddingHorizontal: theme.spacing.three,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.backgroundElement,
  },
  action: {
    color: theme.colors.text,
    fontFamily: theme.fonts.sans,
    fontSize: 15,
  },
  detail: {
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.sans,
    fontSize: 13,
    marginTop: theme.spacing.half,
  },
  timestamp: {
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.sans,
    fontSize: 12,
    marginTop: theme.spacing.half,
  },
}));

const testIDs = createComponentTestIDs("EgressLog", {
  containers: ["root"] as const,
  texts: ["empty"] as const,
});

EgressLog.testIDs = testIDs;
