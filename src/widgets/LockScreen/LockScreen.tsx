import { useRef, useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { createComponentTestIDs } from "@/shared/testing";
import { unlockErrorMessage } from "./unlockErrorMessage";

type LockScreenProps = {
  /** Show the biometric button. */
  biometrics: boolean;
  /** Resolves when unlocked; throws on a wrong passphrase or data that won't open. */
  onUnlockWithPassphrase: (passphrase: string) => Promise<void>;
  /** Resolves when unlocked; throws if the biometric check fails or is cancelled. */
  onUnlockWithBiometrics: () => Promise<void>;
  /** Erase everything and start over — the only way back from a forgotten passphrase. */
  onErase: () => void;
};

/**
 * Capsule's lock screen (4.6): shown at launch while app lock is on, and
 * again after the app was away longer than the lock timing allows. The
 * caller does the unlocking; this only collects the passphrase, offers
 * biometrics, and reports failures. A forgotten passphrase can't be
 * recovered — the data is encrypted with it — so the only way out is to
 * erase everything, behind two confirmations.
 */
export function LockScreen({
  biometrics,
  onUnlockWithPassphrase,
  onUnlockWithBiometrics,
  onErase,
}: LockScreenProps) {
  const [passphrase, setPassphrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const run = async (
    unlock: () => Promise<void>,
    method: "passphrase" | "biometrics",
  ) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      await unlock();
    } catch (e) {
      setError(unlockErrorMessage(e, method));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  const handlePassphrase = () => {
    if (!passphrase) return;
    void run(() => onUnlockWithPassphrase(passphrase), "passphrase");
  };

  const handleBiometrics = () => {
    void run(onUnlockWithBiometrics, "biometrics");
  };

  const handleErase = () => {
    Alert.alert(
      "Erase everything?",
      "Without your passphrase your data can't be decrypted. Erasing deletes all conversations, capsules, files and settings on this device.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Continue",
          style: "destructive",
          onPress: () =>
            Alert.alert("This can't be undone", "Erase everything now?", [
              { text: "Cancel", style: "cancel" },
              { text: "Erase", style: "destructive", onPress: onErase },
            ]),
        },
      ],
    );
  };

  return (
    <View testID={testIDs.containers.root} style={styles.root}>
      <Text style={styles.title}>Capsule is locked</Text>
      <TextInput
        testID={testIDs.inputs.passphrase}
        style={styles.input}
        placeholder="Passphrase"
        secureTextEntry
        autoFocus={!biometrics}
        value={passphrase}
        onChangeText={setPassphrase}
        onSubmitEditing={handlePassphrase}
        editable={!busy}
        accessibilityLabel="Passphrase"
      />
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
        testID={testIDs.buttons.unlock}
        style={styles.primary}
        onPress={handlePassphrase}
        disabled={busy || !passphrase}
        accessibilityRole="button"
        accessibilityState={{ disabled: busy || !passphrase, busy }}
      >
        <Text style={styles.primaryLabel}>
          {busy ? "Unlocking…" : "Unlock"}
        </Text>
      </Pressable>
      {biometrics && (
        <Pressable
          testID={testIDs.buttons.biometrics}
          style={styles.secondary}
          onPress={handleBiometrics}
          disabled={busy}
          accessibilityRole="button"
          accessibilityState={{ disabled: busy, busy }}
        >
          <Text style={styles.secondaryLabel}>Use Face ID / fingerprint</Text>
        </Pressable>
      )}
      <Pressable
        testID={testIDs.buttons.erase}
        style={styles.erase}
        onPress={handleErase}
        disabled={busy}
        accessibilityRole="button"
        accessibilityState={{ disabled: busy }}
      >
        <Text style={styles.eraseLabel}>
          Forgot your passphrase? Erase everything
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: {
    flex: 1,
    justifyContent: "center",
    padding: theme.spacing.four,
    backgroundColor: theme.colors.background,
  },
  title: {
    color: theme.colors.text,
    fontFamily: theme.fonts.rounded,
    fontSize: 22,
    textAlign: "center",
    marginBottom: theme.spacing.four,
  },
  input: {
    backgroundColor: theme.colors.backgroundElement,
    color: theme.colors.text,
    fontFamily: theme.fonts.mono,
    padding: theme.spacing.three,
    borderRadius: theme.spacing.two,
    marginBottom: theme.spacing.two,
  },
  error: {
    color: theme.colors.danger,
    fontFamily: theme.fonts.sans,
    fontSize: 13,
    marginBottom: theme.spacing.two,
  },
  primary: {
    alignItems: "center",
    paddingVertical: theme.spacing.three,
    borderRadius: theme.spacing.two,
    backgroundColor: theme.colors.accent,
  },
  primaryLabel: {
    color: theme.colors.background,
    fontFamily: theme.fonts.rounded,
  },
  secondary: {
    alignItems: "center",
    paddingVertical: theme.spacing.three,
    marginTop: theme.spacing.two,
    borderRadius: theme.spacing.two,
    backgroundColor: theme.colors.backgroundSelected,
  },
  secondaryLabel: {
    color: theme.colors.accent,
    fontFamily: theme.fonts.rounded,
  },
  erase: {
    alignItems: "center",
    marginTop: theme.spacing.four,
  },
  eraseLabel: {
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.sans,
    fontSize: 12,
  },
}));

const testIDs = createComponentTestIDs("LockScreen", {
  containers: ["root"] as const,
  inputs: ["passphrase"] as const,
  texts: ["error"] as const,
  buttons: ["unlock", "biometrics", "erase"] as const,
});

LockScreen.testIDs = testIDs;
