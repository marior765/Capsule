import { reloadAppAsync } from "expo";
import { useEffect, useState, type PropsWithChildren } from "react";
import {
  Alert,
  AppState,
  BackHandler,
  Keyboard,
  Pressable,
  StyleSheet as RNStyleSheet,
  Text,
  View,
} from "react-native";
import { StyleSheet } from "react-native-unistyles";
import {
  hasBiometricUnlock,
  unlockVault,
  unlockVaultWithBiometrics,
} from "@/features/encrypt-vault";
import { getLockAfter, shouldRelock } from "@/features/app-lock";
import { LockScreen } from "@/widgets/LockScreen";
import { createComponentTestIDs } from "@/shared/testing";
import { openAtLaunch, openUnlocked } from "./launchDatabase";
import { eraseEverything } from "./eraseEverything";

type Phase = "starting" | "locked" | "ready" | "failed";

/**
 * Wraps the whole app (4.6). With app lock off, it opens the database and
 * renders the app. With it on, the app's providers don't mount — so nothing
 * can touch the database — until the lock screen unlocks the encrypted one.
 * After that, returning from the background longer than the lock timing
 * covers the app with the lock screen again (the database stays open; the
 * passphrase or biometrics are checked again before the app shows).
 */
export function AppLockGate({ children }: PropsWithChildren) {
  const [phase, setPhase] = useState<Phase>("starting");
  const [lockOn, setLockOn] = useState(false);
  const [biometrics, setBiometrics] = useState(false);
  const [relocked, setRelocked] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    openAtLaunch()
      .then(async (state) => {
        if (state.kind === "locked") {
          const bio = await hasBiometricUnlock().catch(() => false);
          if (!alive) return;
          setLockOn(true);
          setBiometrics(bio);
        }
        if (alive) setPhase(state.kind);
      })
      .catch(() => {
        if (alive) setPhase("failed");
      });
    return () => {
      alive = false;
    };
  }, [attempt]);

  useEffect(() => {
    if (!lockOn || phase !== "ready") return;
    let leftAt: number | null = null;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "background") {
        leftAt = Date.now();
      } else if (state === "active") {
        if (shouldRelock(leftAt, Date.now(), getLockAfter())) {
          Keyboard.dismiss();
          setRelocked(true);
        }
        leftAt = null;
      }
    });
    return () => subscription.remove();
  }, [lockOn, phase]);

  // While the lock screen covers the app, Android's back button must not
  // drive the navigation underneath it.
  useEffect(() => {
    if (!relocked) return;
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => true,
    );
    return () => subscription.remove();
  }, [relocked]);

  const erase = async () => {
    try {
      await eraseEverything();
    } catch (e) {
      Alert.alert(
        "Couldn't erase everything",
        e instanceof Error ? e.message : "Something went wrong. Try again.",
      );
      return;
    }
    await reloadAppAsync();
  };

  const retry = () => {
    setPhase("starting");
    setAttempt((n) => n + 1);
  };

  if (phase === "starting") return null;

  if (phase === "failed") {
    return (
      <View testID={testIDs.containers.failed} style={styles.failed}>
        <Text style={styles.failedText}>
          Capsule couldn&apos;t open its data.
        </Text>
        <Pressable
          testID={testIDs.buttons.retry}
          style={styles.retry}
          onPress={retry}
          accessibilityRole="button"
        >
          <Text style={styles.retryLabel}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  if (phase === "locked") {
    return (
      <LockScreen
        biometrics={biometrics}
        onUnlockWithPassphrase={async (passphrase) => {
          openUnlocked(await unlockVault(passphrase));
          setPhase("ready");
        }}
        onUnlockWithBiometrics={async () => {
          openUnlocked(await unlockVaultWithBiometrics());
          setPhase("ready");
        }}
        onErase={() => void erase()}
      />
    );
  }

  return (
    <>
      <View
        style={styles.app}
        importantForAccessibility={relocked ? "no-hide-descendants" : "auto"}
        accessibilityElementsHidden={relocked}
      >
        {children}
      </View>
      {relocked && (
        <View
          testID={testIDs.containers.relock}
          style={RNStyleSheet.absoluteFill}
          accessibilityViewIsModal
          importantForAccessibility="yes"
        >
          <LockScreen
            biometrics={biometrics}
            onUnlockWithPassphrase={async (passphrase) => {
              await unlockVault(passphrase);
              setRelocked(false);
            }}
            onUnlockWithBiometrics={async () => {
              await unlockVaultWithBiometrics();
              setRelocked(false);
            }}
            onErase={() => void erase()}
          />
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create((theme) => ({
  app: {
    flex: 1,
  },
  failed: {
    flex: 1,
    justifyContent: "center",
    padding: theme.spacing.four,
    backgroundColor: theme.colors.background,
  },
  failedText: {
    color: theme.colors.text,
    fontFamily: theme.fonts.sans,
    textAlign: "center",
  },
  retry: {
    alignSelf: "center",
    marginTop: theme.spacing.three,
    paddingHorizontal: theme.spacing.four,
    paddingVertical: theme.spacing.two,
    borderRadius: theme.spacing.two,
    backgroundColor: theme.colors.backgroundSelected,
  },
  retryLabel: {
    color: theme.colors.accent,
    fontFamily: theme.fonts.rounded,
  },
}));

const testIDs = createComponentTestIDs("AppLockGate", {
  containers: ["failed", "relock"] as const,
  buttons: ["retry"] as const,
});

AppLockGate.testIDs = testIDs;
