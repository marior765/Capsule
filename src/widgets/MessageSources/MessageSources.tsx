import { Pressable, Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { createComponentTestIDs } from "@/shared/testing";
import type { SourceChip } from "./toSourceChips";

type MessageSourcesProps = {
  chips: SourceChip[];
  onOpen: (capsuleId: string) => void;
};

/**
 * "From your capsules: …" under an answer that was grounded in the user's
 * own capsules (7.4) — so it's always visible what an answer drew on.
 * A capsule that's still here opens on tap; one that isn't (deleted, or
 * the chat came from another device) shows its remembered title, not
 * tappable.
 */
export function MessageSources({ chips, onOpen }: MessageSourcesProps) {
  if (chips.length === 0) return null;
  return (
    <View testID={testIDs.containers.root} style={styles.root}>
      <Text style={styles.label}>From your capsules:</Text>
      {chips.map((chip) =>
        chip.available ? (
          <Pressable
            key={chip.capsuleId}
            testID={`${testIDs.buttons.open}_${chip.capsuleId}`}
            style={styles.chip}
            onPress={() => onOpen(chip.capsuleId)}
            accessibilityRole="link"
            accessibilityLabel={`Open capsule ${chip.label}`}
          >
            <Text style={styles.chipLabel}>{chip.label}</Text>
          </Pressable>
        ) : (
          <View
            key={chip.capsuleId}
            style={[styles.chip, styles.chipMissing]}
            accessible
            accessibilityLabel={`${chip.label}, not on this device`}
          >
            <Text style={[styles.chipLabel, styles.chipLabelMissing]}>
              {chip.label} (not on this device)
            </Text>
          </View>
        ),
      )}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: theme.spacing.one,
    paddingHorizontal: theme.spacing.three,
    paddingBottom: theme.spacing.two,
  },
  label: {
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.sans,
    fontSize: 12,
  },
  chip: {
    backgroundColor: theme.colors.backgroundElement,
    borderRadius: theme.spacing.two,
    paddingHorizontal: theme.spacing.two,
    paddingVertical: theme.spacing.half,
  },
  chipMissing: {
    opacity: 0.7,
  },
  chipLabel: {
    color: theme.colors.accent,
    fontFamily: theme.fonts.sans,
    fontSize: 12,
  },
  chipLabelMissing: {
    color: theme.colors.textSecondary,
    fontStyle: "italic",
  },
}));

const testIDs = createComponentTestIDs("MessageSources", {
  containers: ["root"] as const,
  buttons: ["open"] as const,
});

MessageSources.testIDs = testIDs;
