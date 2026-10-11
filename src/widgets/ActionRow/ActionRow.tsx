import { Pressable, Text } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { createComponentTestIDs } from "@/shared/testing";

type ActionRowProps = {
  /** Stable key for this action — also its testID suffix. */
  id: string;
  label: string;
  hint: string;
  disabled: boolean;
  onPress: () => void;
};

/** One tappable action in a settings-style list: a label and a one-line hint. */
export function ActionRow({
  id,
  label,
  hint,
  disabled,
  onPress,
}: ActionRowProps) {
  return (
    <Pressable
      testID={`${testIDs.buttons.action}_${id}`}
      style={styles.row}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`${label}. ${hint}`}
      accessibilityState={{ disabled, busy: disabled }}
    >
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.meta}>{hint}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
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
    marginTop: theme.spacing.half,
  },
}));

const testIDs = createComponentTestIDs("ActionRow", {
  buttons: ["action"] as const,
});

ActionRow.testIDs = testIDs;
