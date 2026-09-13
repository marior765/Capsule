import { Pressable, Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import type { Capsule } from "@/entities/capsule";
import { createComponentTestIDs } from "@/shared/testing";

type ParentPickerProps = {
  /** The capsule's current parent, already resolved by the caller — `null` for a root capsule. */
  parent: Capsule | null;
  /** Candidate capsules to pick as a new parent, already fetched and filtered by the caller (at minimum: excluding this capsule itself). */
  availableCapsules: Capsule[];
  onSetParent: (capsuleId: string) => void;
  onClearParent: () => void;
  /**
   * Set by the caller when `onSetParent` was rejected (e.g. `setCapsuleParent`
   * throwing on a cycle) — this widget has no idea WHY a nesting request
   * failed (that's `features/nest-capsule`'s `wouldCreateCycle` logic, one
   * layer down), it only displays what the caller tells it to.
   */
  error?: string | null;
};

/**
 * Purely controlled, like `RelationPicker` (which this closely mirrors —
 * pick-to-link / tap-to-clear) — owns no state, does no persistence, has
 * no idea which capsule this is nesting. Unlike `RelationPicker`, this is
 * a single slot (one parent, not many relations), so there's no "linked
 * list" to render, just a current value and a clear action.
 *
 * Does NOT pre-filter `availableCapsules` to exclude descendants (which
 * would prevent a doomed-to-fail cycle attempt before the user even taps
 * it) — that would duplicate `wouldCreateCycle`'s ancestor-walk here in
 * the UI layer for a marginal UX gain. Simpler to let the real rejection
 * happen and surface `error`, matching this codebase's general preference
 * for one source of truth over a client-side shadow copy of business logic.
 */
export function ParentPicker({
  parent,
  availableCapsules,
  onSetParent,
  onClearParent,
  error,
}: ParentPickerProps) {
  const pickable = availableCapsules.filter((c) => c.id !== parent?.id);

  return (
    <View testID={testIDs.containers.root} style={styles.root}>
      <Text style={styles.heading}>Parent</Text>

      {parent ? (
        <View style={styles.currentRow}>
          <Text style={styles.currentLabel}>{parent.title}</Text>
          <Pressable testID={testIDs.pressables.clear} onPress={onClearParent}>
            <Text style={styles.removeLabel}>✕</Text>
          </Pressable>
        </View>
      ) : (
        <Text style={styles.noneLabel}>No parent — this is a root capsule</Text>
      )}

      {error && (
        <Text testID={testIDs.texts.error} style={styles.errorLabel}>
          {error}
        </Text>
      )}

      {pickable.length > 0 && (
        <View testID={testIDs.containers.available} style={styles.pickList}>
          {pickable.map((capsule) => (
            <Pressable
              key={capsule.id}
              testID={`${testIDs.pressables.setParent}_${capsule.id}`}
              style={styles.pickRow}
              onPress={() => onSetParent(capsule.id)}
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
  heading: {
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.sans,
    fontSize: 12,
    marginBottom: theme.spacing.one,
  },
  currentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: theme.spacing.one,
  },
  currentLabel: {
    color: theme.colors.text,
    fontFamily: theme.fonts.sans,
    fontSize: 14,
  },
  noneLabel: {
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.sans,
    fontSize: 13,
    fontStyle: "italic",
  },
  removeLabel: {
    color: theme.colors.textSecondary,
    fontSize: 12,
  },
  errorLabel: {
    color: theme.colors.danger,
    fontFamily: theme.fonts.sans,
    fontSize: 12,
    marginTop: theme.spacing.one,
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

const testIDs = createComponentTestIDs("ParentPicker", {
  containers: ["root", "available"] as const,
  pressables: ["clear", "setParent"] as const,
  texts: ["error"] as const,
});

ParentPicker.testIDs = testIDs;
