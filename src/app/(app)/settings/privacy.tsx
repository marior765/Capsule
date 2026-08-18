import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { remigrateDb, useDb } from "@/app/providers";
import { getAllAuditEntries, type AuditEntry } from "@/entities/audit";
import { PrivacyBanner } from "@/widgets/PrivacyBanner";
import { EgressLog } from "@/widgets/EgressLog";
import { AppLockSettings } from "@/widgets/AppLockSettings";
import { WipeDataSettings } from "@/widgets/WipeDataSettings";

export default function PrivacyScreen() {
  const db = useDb();
  const [entries, setEntries] = useState<AuditEntry[]>([]);

  useFocusEffect(
    useCallback(() => {
      setEntries(getAllAuditEntries(db));
    }, [db]),
  );

  // A fresh, wiped database has no tables until migrations re-run (they
  // only run once, at Providers' own mount) — remigrateDb() restores that
  // invariant before router.replace sends the user to a screen that will
  // genuinely re-fetch fresh (now-empty) state, rather than one still
  // showing pre-wipe data or hitting "no such table."
  const handleWiped = () => {
    remigrateDb();
    router.replace("/");
  };

  return (
    <View style={styles.root}>
      <PrivacyBanner />
      <Text style={styles.heading}>App lock</Text>
      <AppLockSettings db={db} />
      <Text style={styles.heading}>Danger zone</Text>
      <WipeDataSettings db={db} onWiped={handleWiped} />
      <Text style={styles.heading}>Activity log</Text>
      <Text style={styles.meta}>
        Every export, vault unlock, wipe, and model download this app has ever
        performed. Nothing here can be edited or deleted.
      </Text>
      <EgressLog entries={entries} />
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  heading: {
    color: theme.colors.text,
    fontFamily: theme.fonts.rounded,
    fontSize: 18,
    paddingHorizontal: theme.spacing.three,
    paddingTop: theme.spacing.three,
  },
  meta: {
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.sans,
    fontSize: 12,
    paddingHorizontal: theme.spacing.three,
    paddingTop: theme.spacing.one,
    paddingBottom: theme.spacing.three,
  },
}));
