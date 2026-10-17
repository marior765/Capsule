import { Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { createComponentTestIDs } from "@/shared/testing";
import { formatContextUsage } from "./formatContext";

type InferenceStatsProps = {
  tokensPerSecond?: number;
  contextUsed?: number;
  /** The model's context window size (the "of" in "750 / 4,096"). */
  contextTotal?: number;
  /** True when `contextUsed` is an estimate, not the model's own count. */
  contextApproximate?: boolean;
};

export function InferenceStats({
  tokensPerSecond,
  contextUsed,
  contextTotal,
  contextApproximate = false,
}: InferenceStatsProps) {
  const parts: string[] = [];
  if (tokensPerSecond !== undefined) {
    parts.push(`${tokensPerSecond.toFixed(1)} tok/s`);
  }
  if (contextUsed !== undefined && contextTotal !== undefined) {
    parts.push(
      formatContextUsage(contextUsed, contextTotal, contextApproximate),
    );
  }

  if (parts.length === 0) return null;

  return (
    <View testID={testIDs.containers.root} style={styles.root}>
      <Text testID={testIDs.texts.stats} style={styles.text}>
        {parts.join(" · ")}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: {
    paddingVertical: theme.spacing.one,
    paddingHorizontal: theme.spacing.three,
  },
  text: {
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.mono,
  },
}));

const testIDs = createComponentTestIDs("InferenceStats", {
  containers: ["root"] as const,
  texts: ["stats"] as const,
});

InferenceStats.testIDs = testIDs;
