import { reloadAppAsync } from "expo";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ScrollView, Text } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { remigrateDb, useDb, useEmbeddings } from "@/app/providers";
import { getAllAuditEntries, type AuditEntry } from "@/entities/audit";
import {
  cancelEmbeddingDownload,
  deleteEmbeddingModel,
} from "@/features/manage-embedding-model";
import { PrivacyBanner } from "@/widgets/PrivacyBanner";
import { EgressLog } from "@/widgets/EgressLog";
import { AppLockSettings } from "@/widgets/AppLockSettings";
import { WipeDataSettings } from "@/widgets/WipeDataSettings";

export default function PrivacyScreen() {
  const db = useDb();
  const embeddings = useEmbeddings();
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
    // An embedding-model download still in flight must not put the model
    // back after the wipe: cancel it, forget anything that already landed,
    // then drop the loaded context.
    cancelEmbeddingDownload();
    deleteEmbeddingModel();
    embeddings.reload();
    router.replace("/");
  };

  return (
    <ScrollView style={styles.root}>
      <PrivacyBanner />
      <Text style={styles.heading}>App lock</Text>
      {/* The database moved to another file: restart so nothing keeps the old connection. */}
      <AppLockSettings onChanged={() => void reloadAppAsync()} />
      <Text style={styles.heading}>Danger zone</Text>
      <WipeDataSettings db={db} onWiped={handleWiped} />
      <Text style={styles.heading}>Activity log</Text>
      <Text style={styles.meta}>
        Every export, vault unlock, wipe, and model download this app has ever
        performed. Nothing here can be edited or deleted.
      </Text>
      <EgressLog entries={entries} />
    </ScrollView>
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
