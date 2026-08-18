import { useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import type { SQLiteDatabase } from "expo-sqlite";
import { createComponentTestIDs } from "@/shared/testing";
import { wipeAllData } from "@/features/wipe-data";
import { wipeWithConfirmation } from "./wipeWithConfirmation";

type WipeDataSettingsProps = {
  db: SQLiteDatabase;
  /**
   * Called once the wipe actually ran. Deliberately a caller-supplied
   * callback rather than this widget reaching for `app/providers`'
   * `remigrateDb` or `expo-router`'s `router` itself — `widgets/` sits
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
export function WipeDataSettings({ db, onWiped }: WipeDataSettingsProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirmViaAlert = (): Promise<boolean> =>
    new Promise((resolve) => {
      Alert.alert(
        "Wipe all data?",
        "This permanently deletes every conversation, model, and setting. This cannot be undone.",
        [
          { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
          {
            text: "Wipe everything",
            style: "destructive",
            onPress: () => resolve(true),
          },
        ],
      );
    });

  const handlePress = async () => {
    setBusy(true);
    setError(null);
    try {
      const wiped = await wipeWithConfirmation(
        db,
        confirmViaAlert,
        wipeAllData,
      );
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
        <Text testID={testIDs.texts.error} style={styles.error}>
          {error}
        </Text>
      )}
      <Pressable
        testID={testIDs.buttons.wipe}
        style={styles.button}
        onPress={handlePress}
        disabled={busy}
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
