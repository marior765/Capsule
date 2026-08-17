import { useSyncExternalStore } from "react";
import { Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { createComponentTestIDs } from "@/shared/testing";
import { isEgressActive, subscribeToEgress } from "@/shared/egress";

/**
 * The "live egress indicator" named in CLAUDE.md's "Verifiable privacy"
 * feature: renders nothing while the app is offline (the default,
 * expected state), and a small banner whenever `shared/egress` reports a
 * network call is in flight — today, only `manage-models`' `downloadModel`
 * (the one allowed network action). Purely presentational; all the actual
 * tracking logic lives in `shared/egress`, already unit-tested there.
 *
 * Uses `useSyncExternalStore` rather than `useState` + `useEffect` — an
 * effect-based subscription has a real gap between the value read during
 * render and the effect actually subscribing (effects run after commit,
 * not synchronously), so a transition landing in that window is silently
 * lost. `useSyncExternalStore` exists specifically to close that gap: React
 * re-reads `getSnapshot` itself around the subscription, so there's no
 * window where a change can happen and be missed.
 */
export function PrivacyBanner() {
  const active = useSyncExternalStore(
    (onStoreChange) => subscribeToEgress(() => onStoreChange()),
    isEgressActive,
  );

  if (!active) {
    return null;
  }

  return (
    <View
      testID={testIDs.containers.root}
      style={styles.root}
      accessibilityRole="alert"
    >
      <Text testID={testIDs.texts.label} style={styles.label}>
        Network active — downloading a model
      </Text>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: {
    paddingVertical: theme.spacing.one,
    paddingHorizontal: theme.spacing.three,
    backgroundColor: theme.colors.accent,
  },
  label: {
    color: theme.colors.background,
    fontFamily: theme.fonts.sans,
    fontSize: 13,
    textAlign: "center",
  },
}));

const testIDs = createComponentTestIDs("PrivacyBanner", {
  containers: ["root"] as const,
  texts: ["label"] as const,
});

PrivacyBanner.testIDs = testIDs;
