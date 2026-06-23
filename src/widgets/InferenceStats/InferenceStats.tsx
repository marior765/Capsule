import { Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { createComponentTestIDs } from "@/shared/testing";

type InferenceStatsProps = {
  tokensPerSecond?: number;
  contextUsed?: number;
  contextTotal?: number;
};

export function InferenceStats({
  tokensPerSecond,
  contextUsed,
  contextTotal,
}: InferenceStatsProps) {
  const parts: string[] = [];
  if (tokensPerSecond !== undefined) {
    parts.push(`${tokensPerSecond.toFixed(1)} tok/s`);
  }
  if (contextUsed !== undefined) {
    parts.push(
      contextTotal !== undefined
        ? `${contextUsed}/${contextTotal} ctx`
        : `${contextUsed} ctx`
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
