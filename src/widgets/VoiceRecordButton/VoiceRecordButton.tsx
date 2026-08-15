import { useRef } from "react";
import { Pressable, Text } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { createComponentTestIDs } from "@/shared/testing";
import { evaluateHold } from "./holdGesture";

const DEFAULT_MIN_HOLD_MS = 300;

type VoiceRecordButtonProps = {
  /** Externally-owned recording state — this widget renders it, never tracks it. */
  isRecording: boolean;
  disabled?: boolean;
  /** Minimum press duration before a release counts as intentional. */
  minHoldMs?: number;
  /** Fires immediately on press-in — the caller starts capturing audio. */
  onHoldStart: () => void;
  /** Fires on release once `minHoldMs` was met — the caller finalizes the recording. */
  onHoldCommit: () => void;
  /** Fires on an early release — the caller discards whatever was captured. */
  onHoldCancel: () => void;
};

export function VoiceRecordButton({
  isRecording,
  disabled = false,
  minHoldMs = DEFAULT_MIN_HOLD_MS,
  onHoldStart,
  onHoldCommit,
  onHoldCancel,
}: VoiceRecordButtonProps) {
  const pressedAtRef = useRef<number | null>(null);

  const handlePressIn = () => {
    if (disabled) return;
    pressedAtRef.current = Date.now();
    onHoldStart();
  };

  const handlePressOut = () => {
    const pressedAt = pressedAtRef.current;
    pressedAtRef.current = null;
    // No press was in progress — nothing to resolve.
    if (pressedAt === null) return;

    // A hold that already started via onHoldStart must always be resolved,
    // even if `disabled` flips mid-press (permission revoked, model busy).
    // Skipping resolution here would strand the caller believing a
    // recording is still open with no onHoldCommit/onHoldCancel ever coming.
    if (disabled) {
      onHoldCancel();
      return;
    }

    const outcome = evaluateHold(pressedAt, Date.now(), { minHoldMs });
    if (outcome === "committed") {
      onHoldCommit();
    } else {
      onHoldCancel();
    }
  };

  return (
    <Pressable
      testID={testIDs.buttons.record}
      style={[styles.root, isRecording && styles.recording]}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled, busy: isRecording }}
      accessibilityLabel={
        isRecording ? "Recording — release to send" : "Hold to record"
      }
    >
      <Text style={styles.label}>{isRecording ? "●" : "🎙"}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: {
    width: theme.spacing.six,
    height: theme.spacing.six,
    borderRadius: theme.spacing.six / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.backgroundElement,
  },
  recording: {
    backgroundColor: theme.colors.danger,
  },
  label: {
    color: theme.colors.text,
    fontFamily: theme.fonts.sans,
    fontSize: 20,
  },
}));

const testIDs = createComponentTestIDs("VoiceRecordButton", {
  buttons: ["record"] as const,
});

VoiceRecordButton.testIDs = testIDs;
