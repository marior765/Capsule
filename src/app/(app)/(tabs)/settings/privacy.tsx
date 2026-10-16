import { reloadAppAsync } from "expo";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, ScrollView, Text } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { eraseEverything, useDb } from "@/app/providers";
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
  const [entries, setEntries] = useState<AuditEntry[]>([]);

  useFocusEffect(
    useCallback(() => {
      setEntries(getAllAuditEntries(db));
    }, [db]),
  );

  // After erasing, restart: every screen and provider starts over on a
  // fresh, empty database. An embedding-model download still in flight
  // must not put the model back after the wipe: cancel it first, and drop
  // anything that already landed.
  // If an erase stops partway, some data may already be gone and the
  // database closed — say so, and restart rather than leave screens on a
  // closed connection. Erasing again from here retries.
  const erase = async () => {
    try {
      await eraseEverything();
    } catch (e) {
      Alert.alert(
        "Erase didn't finish",
        "Some data may already be deleted. Capsule will restart — you can erase again from Privacy.",
        [{ text: "OK", onPress: () => void reloadAppAsync() }],
        { cancelable: false },
      );
      throw e;
    }
  };

  const handleWiped = () => {
    cancelEmbeddingDownload();
    deleteEmbeddingModel();
    void reloadAppAsync();
  };

  return (
    <ScrollView style={styles.root}>
      <PrivacyBanner />
      <Text style={styles.heading}>App lock</Text>
      {/* The database moved to another file: restart so nothing keeps the old connection. */}
      <AppLockSettings onChanged={() => void reloadAppAsync()} />
      <Text style={styles.heading}>Danger zone</Text>
      <WipeDataSettings erase={erase} onWiped={handleWiped} />
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
