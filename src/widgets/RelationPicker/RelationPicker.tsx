import { Pressable, Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import type { Capsule } from "@/entities/capsule";
import type { CapsuleLink } from "@/entities/link";
import { createComponentTestIDs } from "@/shared/testing";

export type RelationEntry = {
  link: CapsuleLink;
  /** `null` when the linked capsule no longer exists — graceful degradation (CLAUDE.md's CapsuleLink contract), rendered here, not silently filtered out by the caller. */
  capsule: Capsule | null;
};

type RelationPickerProps = {
  /** Every link this relation field currently has, already resolved by the caller (e.g. `getLinksFromByField` + `getCapsuleById` per link). */
  linked: RelationEntry[];
  /** Candidate capsules to browse/pick from, already fetched by the caller — this widget only filters out ones already linked. */
  availableCapsules: Capsule[];
  onLink: (targetCapsuleId: string) => void;
  onUnlink: (linkId: string) => void;
};

/**
 * Purely controlled, like `TagPicker`/`FilterSheet` — owns no state,
 * does no persistence, has no idea which capsule or field it belongs to.
 * Unlike a dangling `capsuleTypeId` (which just falls back to a display
 * label elsewhere), a link with a missing target is rendered explicitly
 * here as "Missing capsule" with a working remove button — CLAUDE.md's
 * "must degrade gracefully if target missing" means showing the gap and
 * letting it be cleaned up, not hiding that the link ever existed.
 */
export function RelationPicker({
  linked,
  availableCapsules,
  onLink,
  onUnlink,
}: RelationPickerProps) {
  const linkedCapsuleIds = new Set(
    linked.map((entry) => entry.capsule?.id).filter((id): id is string => !!id),
  );
  const pickable = availableCapsules.filter(
    (capsule) => !linkedCapsuleIds.has(capsule.id),
  );

  return (
    <View testID={testIDs.containers.root} style={styles.root}>
      {linked.map((entry) => (
        <View key={entry.link.id} style={styles.linkedRow}>
          <Text style={[styles.linkedLabel, !entry.capsule && styles.missing]}>
            {entry.capsule?.title ?? "Missing capsule"}
          </Text>
          <Pressable
            testID={`${testIDs.pressables.unlink}_${entry.link.id}`}
            onPress={() => onUnlink(entry.link.id)}
          >
            <Text style={styles.removeLabel}>✕</Text>
          </Pressable>
        </View>
      ))}

      {pickable.length > 0 && (
        <View testID={testIDs.containers.available} style={styles.pickList}>
          {pickable.map((capsule) => (
            <Pressable
              key={capsule.id}
              testID={`${testIDs.pressables.link}_${capsule.id}`}
              style={styles.pickRow}
              onPress={() => onLink(capsule.id)}
            >
              <Text style={styles.pickLabel}>{capsule.title}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: {
    marginTop: theme.spacing.three,
  },
  linkedRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: theme.spacing.one,
  },
  linkedLabel: {
    color: theme.colors.text,
    fontFamily: theme.fonts.sans,
    fontSize: 14,
  },
  missing: {
    color: theme.colors.textSecondary,
    fontStyle: "italic",
  },
  removeLabel: {
    color: theme.colors.textSecondary,
    fontSize: 12,
  },
  pickList: {
    marginTop: theme.spacing.two,
  },
  pickRow: {
    backgroundColor: theme.colors.backgroundElement,
    borderRadius: theme.spacing.two,
    paddingHorizontal: theme.spacing.two,
    paddingVertical: theme.spacing.one,
    marginBottom: theme.spacing.one,
  },
  pickLabel: {
    color: theme.colors.accent,
    fontFamily: theme.fonts.sans,
    fontSize: 13,
  },
}));

const testIDs = createComponentTestIDs("RelationPicker", {
  containers: ["root", "available"] as const,
  pressables: ["link", "unlink"] as const,
});

RelationPicker.testIDs = testIDs;
