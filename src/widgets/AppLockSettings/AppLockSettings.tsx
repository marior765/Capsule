import { useEffect, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import type { SQLiteDatabase } from "expo-sqlite";
import { createComponentTestIDs } from "@/shared/testing";
import { setUpVault, isVaultConfigured } from "@/features/encrypt-vault";
import { isBiometricAvailable } from "@/features/app-lock";
import { insertAuditEntry } from "@/entities/audit";
import { generateId } from "@/shared/lib";
import { validatePassphraseSetup } from "./validatePassphraseSetup";

type AppLockSettingsProps = {
  db: SQLiteDatabase;
};

const ERROR_MESSAGES: Record<string, string> = {
  empty: "Enter a passphrase.",
  mismatch: "Passphrases don't match.",
};

/**
 * The "app-lock" half of 4.4's privacy screen — lets the user configure a
 * passphrase. Deliberately does NOT use `features/app-lock`'s
 * `createAppLock`: that's a lock/unlock *gate* state machine for guarding
 * app access over time (launch, resume) — this is a one-shot setup form,
 * a different concern. It calls `encrypt-vault`'s `setUpVault` directly.
 *
 * No "disable" control exists yet, deliberately: the only way to remove a
 * configured vault today is `resetVault()`, which deletes the *entire*
 * database, not just the lock — using it as a casual "turn off the lock"
 * button would silently destroy the user's conversations/capsules/models
 * for an action they'd reasonably expect to be non-destructive. A real
 * "remove the lock but keep my data" flow doesn't exist yet — flagged in
 * .claude/loop/BLOCKED.md rather than faked here.
 *
 * Important honesty note, surfaced in the UI copy itself, not just docs:
 * setting up a passphrase here does not yet make anything encrypted at
 * rest. `shared/db`'s `openDb({key})` only takes effect on the *first*
 * open of the process-wide connection, and `Providers` already opens it
 * unconditionally and unkeyed before this screen can ever render (see
 * `features/encrypt-vault`'s own module doc comment). That gap closes only
 * once a launch-time unlock gate exists — separate, larger integration
 * work, not part of this screen.
 */
export function AppLockSettings({ db }: AppLockSettingsProps) {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void isVaultConfigured().then((value) => {
      if (!cancelled) setConfigured(value);
    });
    void isBiometricAvailable().then((value) => {
      if (!cancelled) setBiometricAvailable(value);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleEnable = async () => {
    const validationError = validatePassphraseSetup(passphrase, confirmation);
    if (validationError) {
      setError(ERROR_MESSAGES[validationError]);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await setUpVault(passphrase);
      // setUpVault/unlockVault can't log themselves — they run before the
      // caller has derived a key, with no db handle of their own (see
      // encrypt-vault's module doc comment). "decrypt" is the closest fit
      // in AuditAction's four-category closed union (CLAUDE.md names
      // export/decrypt/wipe/model_download exactly, no fifth "setup"
      // category) — flagged as an interpretation, not an exact semantic
      // match, in .claude/loop/BLOCKED.md.
      insertAuditEntry(db, {
        id: generateId(),
        action: "decrypt",
        detail: "App lock passphrase configured",
        createdAt: Date.now(),
      });
      setConfigured(true);
      setPassphrase("");
      setConfirmation("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not set up app lock");
    } finally {
      setBusy(false);
    }
  };

  if (configured === null) {
    return null;
  }

  if (configured) {
    return (
      <View testID={testIDs.containers.root} style={styles.root}>
        <Text testID={testIDs.texts.status} style={styles.statusEnabled}>
          App lock is configured.
        </Text>
        {biometricAvailable && (
          <Text style={styles.meta}>Biometric unlock is available.</Text>
        )}
      </View>
    );
  }

  return (
    <View testID={testIDs.containers.root} style={styles.root}>
      <Text style={styles.statusDisabled}>App lock is not set up.</Text>
      <Text style={styles.meta}>
        Setting a passphrase here does not yet encrypt anything on its own —
        that requires a launch-lock screen this app does not have yet.
      </Text>
      <TextInput
        testID={testIDs.inputs.passphrase}
        style={styles.input}
        placeholder="Passphrase"
        secureTextEntry
        value={passphrase}
        onChangeText={setPassphrase}
        editable={!busy}
      />
      <TextInput
        testID={testIDs.inputs.confirmation}
        style={styles.input}
        placeholder="Confirm passphrase"
        secureTextEntry
        value={confirmation}
        onChangeText={setConfirmation}
        editable={!busy}
      />
      {error !== null && (
        <Text testID={testIDs.texts.error} style={styles.error}>
          {error}
        </Text>
      )}
      <Pressable
        testID={testIDs.buttons.enable}
        style={styles.button}
        onPress={handleEnable}
        disabled={busy}
      >
        <Text style={styles.buttonLabel}>
          {busy ? "Setting up…" : "Enable app lock"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: {
    padding: theme.spacing.three,
  },
  statusEnabled: {
    color: theme.colors.text,
    fontFamily: theme.fonts.sans,
    fontSize: 15,
  },
  statusDisabled: {
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
}));

const testIDs = createComponentTestIDs("AppLockSettings", {
  containers: ["root"] as const,
  texts: ["status", "error"] as const,
  inputs: ["passphrase", "confirmation"] as const,
  buttons: ["enable"] as const,
});

AppLockSettings.testIDs = testIDs;
