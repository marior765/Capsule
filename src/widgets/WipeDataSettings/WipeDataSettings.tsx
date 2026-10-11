import { useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { createComponentTestIDs } from "@/shared/testing";
import { wipeWithConfirmation } from "./wipeWithConfirmation";

type WipeDataSettingsProps = {
  /** The app's one erase-everything (4.7) — injected, since it lives in `app/`. */
  erase: () => Promise<void>;
  /**
   * Called once the wipe actually ran (the route restarts the app).
   * Deliberately a caller-supplied callback rather than this widget
   * reaching into `app/` itself — `widgets/` sits
   * below `app/` in FSD's layering (docs/ARCHITECTURE.md), so a widget
   * importing from `app/` is a forbidden upward import (lint-enforced at
   * error severity via eslint-plugin-boundaries). The route composing this
   * widget lives in `app/` itself and can freely do both.
   */
  onWiped: () => void;
};

/**
 * The "wipe" piece of 4.4's privacy screen, completing the four things
 * docs/ARCHITECTURE.md names for this route (app-lock, wipe, audit log,
 * egress indicator — the other three shipped in earlier beats).
 *
 * `Alert.alert` is wrapped in a promise (`confirmViaAlert`) rather than
 * tested directly — the actual "don't wipe without confirmation" logic is
 * `wipeWithConfirmation`, already unit-tested against a fake confirm
 * function.
 *
 * Does not attempt to guarantee every *other* currently-open screen's
 * cached state refreshes correctly after a wipe mid-session — that's a
 * real, broader concern flagged in .claude/loop/BLOCKED.md, not solved
 * ad hoc here.
 */
export function WipeDataSettings({ erase, onWiped }: WipeDataSettingsProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirmViaAlert = (): Promise<boolean> =>
    new Promise((resolve) => {
      Alert.alert(
        "Wipe all data?",
        "This permanently deletes every conversation, capsule, file, model and setting on this device, and turns off app lock. This cannot be undone.",
        [
          { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
          {
            text: "Wipe everything",
            style: "destructive",
            onPress: () => resolve(true),
          },
        ],
        // Android: tapping outside dismisses — that's a "no", not a hang.
        { cancelable: true, onDismiss: () => resolve(false) },
      );
    });

  const handlePress = async () => {
    setBusy(true);
    setError(null);
    try {
      const wiped = await wipeWithConfirmation(confirmViaAlert, erase);
      if (wiped) {
        onWiped();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not wipe data");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View testID={testIDs.containers.root} style={styles.root}>
      {error !== null && (
        <Text
          testID={testIDs.texts.error}
          style={styles.error}
          accessibilityLiveRegion="polite"
        >
          {error}
        </Text>
      )}
      <Pressable
        testID={testIDs.buttons.wipe}
        style={styles.button}
        onPress={handlePress}
        disabled={busy}
        accessibilityRole="button"
        accessibilityState={{ disabled: busy, busy }}
      >
        <Text style={styles.buttonLabel}>
          {busy ? "Wiping…" : "Wipe all data"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: {
    padding: theme.spacing.three,
  },
  error: {
    color: theme.colors.danger,
    fontFamily: theme.fonts.sans,
    fontSize: 12,
    marginBottom: theme.spacing.two,
  },
  button: {
    alignItems: "center",
    paddingVertical: theme.spacing.three,
    borderRadius: theme.spacing.two,
    backgroundColor: theme.colors.danger,
  },
  buttonLabel: {
    color: theme.colors.background,
    fontFamily: theme.fonts.rounded,
  },
}));

const testIDs = createComponentTestIDs("WipeDataSettings", {
  containers: ["root"] as const,
  texts: ["error"] as const,
  buttons: ["wipe"] as const,
});

WipeDataSettings.testIDs = testIDs;
