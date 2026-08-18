import { Pressable, Text } from "react-native";
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
}: CapsuleCardProps) {
  return (
    <Pressable
      testID={`${testIDs.pressables.root}_${capsule.id}`}
      style={styles.root}
      onPress={onPress}
    >
      <Text style={styles.title}>{capsule.title}</Text>
      <Text style={styles.typeName}>{capsuleTypeName ?? "Unknown type"}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: {
    paddingVertical: theme.spacing.three,
    paddingHorizontal: theme.spacing.three,
    borderRadius: theme.spacing.two,
    backgroundColor: theme.colors.backgroundElement,
    marginBottom: theme.spacing.two,
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
});

CapsuleCard.testIDs = testIDs;
