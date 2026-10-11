import { useEffect, useRef, useState } from "react";
import { Alert, Pressable, Switch, Text, TextInput, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { createComponentTestIDs } from "@/shared/testing";
import {
  hasBiometricUnlock,
  isVaultConfigured,
  LeftoverCopyError,
  turnOffAppLock,
  turnOnAppLock,
} from "@/features/encrypt-vault";
import {
  getLockAfter,
  isBiometricAvailable,
  LOCK_AFTER_OPTIONS,
  setLockAfter,
  type LockAfter,
} from "@/features/app-lock";
import { validatePassphraseSetup } from "./validatePassphraseSetup";

type AppLockSettingsProps = {
  /**
   * Called after the lock was turned on or off. The database has moved to
   * another file, so the caller restarts the app — no screen may keep using
   * the old connection.
   */
  onChanged: () => void;
};

const ERROR_MESSAGES: Record<string, string> = {
  empty: "Enter a passphrase.",
  mismatch: "Passphrases don't match.",
};

/**
 * App lock on the Privacy screen (4.6). Turning it on encrypts everything
 * on this device under a passphrase (optionally also unlockable with
 * biometrics); turning it off decrypts it again without losing anything.
 * While it's on, the user picks how long Capsule may be away before it
 * locks again (default 1 minute).
 */
export function AppLockSettings({ onChanged }: AppLockSettingsProps) {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricOn, setBiometricOn] = useState(false);
  const [useBiometrics, setUseBiometrics] = useState(true);
  const [passphrase, setPassphrase] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [lockAfter, setLockAfterState] = useState<LockAfter>(getLockAfter);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // A ref, not state: a fast double tap must not start two lock changes
  // before the busy re-render lands.
  const inFlight = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void isVaultConfigured().then((value) => {
      if (!cancelled) setConfigured(value);
    });
    void isBiometricAvailable().then((value) => {
      if (!cancelled) setBiometricAvailable(value);
    });
    void hasBiometricUnlock().then((value) => {
      if (!cancelled) setBiometricOn(value);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // A leftover copy means the change itself happened — say so, then restart.
  const finish = (e: unknown, fallback: string) => {
    if (e instanceof LeftoverCopyError) {
      // Not dismissable: the restart must happen either way.
      Alert.alert("Done", e.message, [{ text: "OK", onPress: onChanged }], {
        cancelable: false,
      });
      return;
    }
    setError(e instanceof Error ? e.message : fallback);
  };

  const handleTurnOn = async () => {
    const validationError = validatePassphraseSetup(passphrase, confirmation);
    if (validationError) {
      setError(ERROR_MESSAGES[validationError]);
      return;
    }
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      await turnOnAppLock(passphrase, {
        biometrics: biometricAvailable && useBiometrics,
      });
      onChanged();
    } catch (e) {
      finish(e, "Couldn't turn on app lock.");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  const turnOff = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      await turnOffAppLock(passphrase);
      onChanged();
    } catch (e) {
      if (e instanceof Error && e.name === "VaultUnlockError") {
        setError("That passphrase didn't work.");
      } else {
        finish(e, "Couldn't turn off app lock.");
      }
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  const handleTurnOff = () => {
    if (!passphrase) {
      setError("Enter your passphrase to turn app lock off.");
      return;
    }
    Alert.alert(
      "Turn off app lock?",
      "Your data stays on this device but will no longer be encrypted.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Turn off",
          style: "destructive",
          onPress: () => void turnOff(),
        },
      ],
    );
  };

  const handleLockAfter = (value: LockAfter) => {
    setLockAfter(value);
    setLockAfterState(value);
  };

  if (configured === null) {
    return null;
  }

  const errorText = error !== null && (
    <Text
      testID={testIDs.texts.error}
      style={styles.error}
      accessibilityLiveRegion="polite"
    >
      {error}
    </Text>
  );

  if (configured) {
    return (
      <View testID={testIDs.containers.root} style={styles.root}>
        <Text testID={testIDs.texts.status} style={styles.status}>
          App lock is on. Everything on this device is encrypted.
        </Text>
        <Text style={styles.meta}>
          {biometricOn
            ? "Unlock with your passphrase or Face ID / fingerprint."
            : "Unlock with your passphrase."}
        </Text>

        <Text style={styles.label}>Lock again when Capsule has been away</Text>
        {LOCK_AFTER_OPTIONS.map((option) => (
          <Pressable
            key={option.value}
            testID={`${testIDs.pressables.lockAfter}_${option.value}`}
            style={styles.option}
            onPress={() => handleLockAfter(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected: lockAfter === option.value }}
          >
            <Text style={styles.optionLabel}>
              {lockAfter === option.value ? "● " : "○ "}
              {option.label}
            </Text>
          </Pressable>
        ))}

        <Text style={styles.label}>Turn off app lock</Text>
        <TextInput
          testID={testIDs.inputs.currentPassphrase}
          style={styles.input}
          placeholder="Current passphrase"
          secureTextEntry
          value={passphrase}
          onChangeText={setPassphrase}
          editable={!busy}
          accessibilityLabel="Current passphrase"
        />
        {errorText}
        <Pressable
          testID={testIDs.buttons.turnOff}
          style={styles.secondary}
          onPress={handleTurnOff}
          disabled={busy}
          accessibilityRole="button"
          accessibilityState={{ disabled: busy, busy }}
        >
          <Text style={styles.secondaryLabel}>
            {busy ? "Turning off…" : "Turn off app lock"}
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View testID={testIDs.containers.root} style={styles.root}>
      <Text style={styles.status}>App lock is off.</Text>
      <Text style={styles.meta}>
        Turning it on encrypts everything on this device with your passphrase.
        If you forget the passphrase, the only way back in is to erase
        everything.
      </Text>
      <TextInput
        testID={testIDs.inputs.passphrase}
        style={styles.input}
        placeholder="Passphrase"
        secureTextEntry
        value={passphrase}
        onChangeText={setPassphrase}
        editable={!busy}
        accessibilityLabel="Passphrase"
      />
      <TextInput
        testID={testIDs.inputs.confirmation}
        style={styles.input}
        placeholder="Confirm passphrase"
        secureTextEntry
        value={confirmation}
        onChangeText={setConfirmation}
        editable={!busy}
        accessibilityLabel="Confirm passphrase"
      />
      {biometricAvailable && (
        <View style={styles.switchRow}>
          <Text style={styles.optionLabel}>
            Also unlock with Face ID / fingerprint
          </Text>
          <Switch
            testID={testIDs.inputs.biometrics}
            value={useBiometrics}
            onValueChange={setUseBiometrics}
            disabled={busy}
            accessibilityLabel="Also unlock with Face ID or fingerprint"
          />
        </View>
      )}
      {errorText}
      <Pressable
        testID={testIDs.buttons.turnOn}
        style={styles.button}
        onPress={handleTurnOn}
        disabled={busy}
        accessibilityRole="button"
        accessibilityState={{ disabled: busy, busy }}
      >
        <Text style={styles.buttonLabel}>
          {busy ? "Encrypting…" : "Turn on app lock"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: {
    padding: theme.spacing.three,
  },
  status: {
    color: theme.colors.text,
    fontFamily: theme.fonts.sans,
    fontSize: 15,
    marginBottom: theme.spacing.one,
  },
  meta: {
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.sans,
    fontSize: 12,
    marginBottom: theme.spacing.two,
  },
  label: {
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.sans,
    fontSize: 12,
    marginTop: theme.spacing.three,
    marginBottom: theme.spacing.one,
  },
  option: {
    paddingVertical: theme.spacing.two,
  },
  optionLabel: {
    color: theme.colors.text,
    fontFamily: theme.fonts.sans,
    fontSize: 14,
    flexShrink: 1,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.two,
    marginBottom: theme.spacing.two,
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
    fontSize: 12,
    marginBottom: theme.spacing.two,
  },
  button: {
    alignItems: "center",
    paddingVertical: theme.spacing.three,
    borderRadius: theme.spacing.two,
    backgroundColor: theme.colors.accent,
  },
  buttonLabel: {
    color: theme.colors.background,
    fontFamily: theme.fonts.rounded,
  },
  secondary: {
    alignItems: "center",
    paddingVertical: theme.spacing.three,
    borderRadius: theme.spacing.two,
    backgroundColor: theme.colors.backgroundSelected,
  },
  secondaryLabel: {
    color: theme.colors.danger,
    fontFamily: theme.fonts.rounded,
  },
}));

const testIDs = createComponentTestIDs("AppLockSettings", {
  containers: ["root"] as const,
  texts: ["status", "error"] as const,
  inputs: [
    "passphrase",
    "confirmation",
    "currentPassphrase",
    "biometrics",
  ] as const,
  buttons: ["turnOn", "turnOff"] as const,
  pressables: ["lockAfter"] as const,
});

AppLockSettings.testIDs = testIDs;
