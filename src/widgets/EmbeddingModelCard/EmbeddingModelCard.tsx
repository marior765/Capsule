import { Pressable, Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { createComponentTestIDs } from "@/shared/testing";

export type EmbeddingModelState = "missing" | "downloading" | "ready";

type EmbeddingModelCardProps = {
  modelName: string;
  /** Approximate download size, shown before downloading (e.g. "35 MB"). */
  sizeLabel: string;
  state: EmbeddingModelState;
  error: string | null;
  onDownload: () => void;
  onDelete: () => void;
};

/**
 * The on/off switch for "find capsules by meaning" (7.2): download or
 * delete the small on-device embedding model. Purely controlled — the
 * route owns the download, this only shows state and reports taps. The
 * copy says plainly what the one network action is and that everything
 * else stays on the device.
 */
export function EmbeddingModelCard({
  modelName,
  sizeLabel,
  state,
  error,
  onDownload,
  onDelete,
}: EmbeddingModelCardProps) {
  return (
    <View testID={testIDs.containers.root} style={styles.root}>
      <Text style={styles.name}>{modelName}</Text>
      <Text style={styles.meta}>
        Lets Capsule find your capsules by meaning, not just exact words.
        {state === "ready"
          ? " Downloaded — runs entirely on this device."
          : ` One-time ${sizeLabel} download; after that it runs entirely on this device.`}
      </Text>

      {error !== null && (
        <Text
          testID={testIDs.texts.error}
          style={styles.error}
          accessibilityLiveRegion="polite"
        >
          {error}
        </Text>
      )}

      {state === "ready" ? (
        <Pressable
          testID={testIDs.buttons.delete}
          style={styles.button}
          onPress={onDelete}
          accessibilityRole="button"
          accessibilityLabel={`Delete ${modelName}`}
        >
          <Text style={styles.buttonLabel}>Delete</Text>
        </Pressable>
      ) : (
        <Pressable
          testID={testIDs.buttons.download}
          style={styles.button}
          onPress={onDownload}
          disabled={state === "downloading"}
          accessibilityRole="button"
          accessibilityLabel={
            state === "downloading"
              ? `Downloading ${modelName}`
              : `Download ${modelName}, ${sizeLabel}`
          }
          accessibilityState={{
            disabled: state === "downloading",
            busy: state === "downloading",
          }}
        >
          <Text style={styles.buttonLabel}>
            {state === "downloading"
              ? "Downloading…"
              : `Download (${sizeLabel})`}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: {
    backgroundColor: theme.colors.backgroundElement,
    padding: theme.spacing.three,
    borderRadius: theme.spacing.two,
    marginBottom: theme.spacing.two,
  },
  name: {
    color: theme.colors.text,
    fontFamily: theme.fonts.sans,
  },
  meta: {
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.sans,
    fontSize: 12,
    marginTop: theme.spacing.one,
  },
  error: {
    color: theme.colors.danger,
    fontFamily: theme.fonts.sans,
    fontSize: 12,
    marginTop: theme.spacing.two,
  },
  button: {
    alignSelf: "flex-start",
    marginTop: theme.spacing.two,
    paddingHorizontal: theme.spacing.three,
    paddingVertical: theme.spacing.two,
    borderRadius: theme.spacing.two,
    backgroundColor: theme.colors.backgroundSelected,
  },
  buttonLabel: {
    color: theme.colors.accent,
    fontFamily: theme.fonts.rounded,
    fontSize: 13,
  },
}));

const testIDs = createComponentTestIDs("EmbeddingModelCard", {
  containers: ["root"] as const,
  texts: ["error"] as const,
  buttons: ["download", "delete"] as const,
});

EmbeddingModelCard.testIDs = testIDs;
