import { Pressable, Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { createComponentTestIDs } from "@/shared/testing";
import type { Capsule } from "@/entities/capsule";

type CapsuleCardProps = {
  capsule: Capsule;
  /**
   * Resolved by the caller (`CapsuleList`), not looked up here — this
   * component stays presentational, no db access. `null` when the
   * capsule's `capsuleTypeId` doesn't resolve to an existing type
   * (deleted type, or any other dangling reference) — CLAUDE.md's
   * graceful-degradation rule for capsule-domain references applies here
   * the same way it does for `CapsuleLink`, even though this isn't a link.
   */
  capsuleTypeName: string | null;
  onPress?: () => void;
  /**
   * True while the list is in bulk-select mode (8.5) — this component has
   * no opinion on what a press MEANS (navigate vs. toggle selection,
   * decided by the caller); it only changes what gets rendered, so a
   * selection checkbox never appears outside select mode.
   */
  selectionMode?: boolean;
  selected?: boolean;
};

/**
 * One capsule's summary row — title + its type's name (or a fallback).
 * The root testID appends `capsule.id` (a stable domain id, not a
 * render-order index) — mirrors `ChatBubble`'s own established pattern,
 * necessary here because `CapsuleList` renders many of these at once and
 * each one needs a distinct, stable testID to be individually targetable.
 */
export function CapsuleCard({
  capsule,
  capsuleTypeName,
  onPress,
  selectionMode = false,
  selected = false,
}: CapsuleCardProps) {
  return (
    <Pressable
      testID={`${testIDs.pressables.root}_${capsule.id}`}
      style={[styles.root, selectionMode && selected && styles.selected]}
      onPress={onPress}
    >
      {selectionMode && (
        <Text
          testID={`${testIDs.texts.checkbox}_${capsule.id}`}
          style={styles.checkbox}
        >
          {selected ? "●" : "○"}
        </Text>
      )}
      <View style={styles.info}>
        <Text style={styles.title}>{capsule.title}</Text>
        <Text style={styles.typeName}>{capsuleTypeName ?? "Unknown type"}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: theme.spacing.three,
    paddingHorizontal: theme.spacing.three,
    borderRadius: theme.spacing.two,
    backgroundColor: theme.colors.backgroundElement,
    marginBottom: theme.spacing.two,
  },
  selected: {
    backgroundColor: theme.colors.backgroundSelected,
  },
  checkbox: {
    color: theme.colors.accent,
    fontSize: 16,
    marginRight: theme.spacing.two,
  },
  info: {
    flex: 1,
  },
  title: {
    color: theme.colors.text,
    fontFamily: theme.fonts.sans,
    fontSize: 15,
  },
  typeName: {
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.sans,
    fontSize: 12,
    marginTop: theme.spacing.half,
  },
}));

const testIDs = createComponentTestIDs("CapsuleCard", {
  pressables: ["root"] as const,
  texts: ["checkbox"] as const,
});

CapsuleCard.testIDs = testIDs;
