import { reloadAppAsync } from "expo";
import { useRef, useState } from "react";
import {
  AccessibilityInfo,
  Alert,
  Platform,
  ScrollView,
  Text,
} from "react-native";
import { StyleSheet } from "react-native-unistyles";
import {
  exportForSharing,
  importFile,
  useDb,
  useEmbeddings,
  type ExportKind,
  type ImportKind,
} from "@/app/providers";
import { deleteCacheFileIfExists } from "@/shared/fs";
import { pickDocument } from "@/shared/picker";
import { shareFile } from "@/shared/share";
import { createComponentTestIDs } from "@/shared/testing";
import { ActionRow } from "@/widgets/ActionRow";

const confirmRestore = (): Promise<boolean> =>
  new Promise((resolve) => {
    Alert.alert(
      "Replace everything?",
      "Restoring a backup replaces every conversation and capsule on this device with the ones in the backup. This can't be undone.",
      [
        { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
        { text: "Restore", style: "destructive", onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });

/**
 * Import & Export (5.5): everything leaves or arrives as a file the user
 * picks or shares — nothing is uploaded. Backups and capsule exports are
 * zip files that include attachments and chat images.
 */
export default function ImportExportScreen() {
  const db = useDb();
  const embeddings = useEmbeddings();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // A ref, not state: a double tap must not start two jobs.
  const inFlight = useRef(false);

  const run = async (job: () => Promise<string | null>) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setResult(null);
    setError(null);
    try {
      const message = await job();
      setResult(message);
      if (message !== null) AccessibilityInfo.announceForAccessibility(message);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Something went wrong.";
      setError(message);
      AccessibilityInfo.announceForAccessibility(message);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  const handleExport = (kind: ExportKind, title: string) =>
    run(async () => {
      const { uri, mimeType } = await exportForSharing(db, kind);
      try {
        await shareFile(uri, { mimeType, title });
      } finally {
        // iOS resolves once the sheet has closed — the copy can go now. On
        // Android the receiving app may still be reading it; it's removed
        // before the next export, at the next launch, or by a wipe.
        if (Platform.OS === "ios") {
          try {
            deleteCacheFileIfExists(uri);
          } catch {
            // removed before the next export, at launch, or by a wipe
          }
        }
      }
      return null;
    });

  const handleImport = (kind: ImportKind) =>
    run(async () => {
      const picked = await pickDocument();
      if (picked === null) return null;
      const outcome = await importFile(db, kind, picked, {
        confirm: kind === "backup" ? confirmRestore : undefined,
      });
      if (outcome === null) return null;
      outcome.capsuleIds.forEach((id) => embeddings.indexCapsule(id));
      if (outcome.restartNeeded) {
        // Every screen must start over on the restored data.
        Alert.alert(
          "Backup restored",
          "Capsule will now restart.",
          [{ text: "OK", onPress: () => void reloadAppAsync() }],
          { cancelable: false },
        );
      }
      return outcome.message;
    });

  return (
    <ScrollView
      testID={testIDs.containers.root}
      style={styles.root}
      contentContainerStyle={styles.content}
    >
      {busy && (
        <Text
          testID={testIDs.texts.busy}
          style={styles.notice}
          accessibilityLiveRegion="polite"
        >
          Working…
        </Text>
      )}
      {result !== null && (
        <Text
          testID={testIDs.texts.result}
          style={styles.notice}
          accessibilityLiveRegion="polite"
        >
          {result}
        </Text>
      )}
      {error !== null && (
        <Text
          testID={testIDs.texts.error}
          style={styles.error}
          accessibilityLiveRegion="polite"
        >
          {error}
        </Text>
      )}

      <Text style={styles.heading} accessibilityRole="header">
        Backup
      </Text>
      <ActionRow
        id="backup"
        label="Back up everything"
        hint="One zip file with all conversations, capsules, attachments and chat images."
        disabled={busy}
        onPress={() => void handleExport("backup", "Save backup")}
      />
      <ActionRow
        id="restore"
        label="Restore from a backup…"
        hint="Replaces everything on this device."
        disabled={busy}
        onPress={() => void handleImport("backup")}
      />

      <Text style={styles.heading} accessibilityRole="header">
        Capsules
      </Text>
      <ActionRow
        id="exportCapsules"
        label="Export all capsules"
        hint="A zip file, including attached files."
        disabled={busy}
        onPress={() => void handleExport("capsules", "Export capsules")}
      />
      <ActionRow
        id="importCapsules"
        label="Import capsules…"
        hint="Adds them as new capsules."
        disabled={busy}
        onPress={() => void handleImport("capsules")}
      />

      <Text style={styles.heading} accessibilityRole="header">
        Conversations
      </Text>
      <ActionRow
        id="exportConversations"
        label="Export all conversations"
        hint="A JSON file (without chat images)."
        disabled={busy}
        onPress={() =>
          void handleExport("conversations", "Export conversations")
        }
      />
      <ActionRow
        id="importConversations"
        label="Import conversations…"
        hint="From a Capsule conversations export."
        disabled={busy}
        onPress={() => void handleImport("conversations")}
      />

      <Text style={styles.heading} accessibilityRole="header">
        From other apps
      </Text>
      <ActionRow
        id="importChatgpt"
        label="ChatGPT export…"
        hint="The conversations.json file from a ChatGPT data export."
        disabled={busy}
        onPress={() => void handleImport("chatgpt")}
      />
      <ActionRow
        id="importClaude"
        label="Claude export…"
        hint="The conversations.json file from a Claude data export."
        disabled={busy}
        onPress={() => void handleImport("claude")}
      />
      <ActionRow
        id="importCsv"
        label="CSV spreadsheet…"
        hint="Each row becomes a capsule."
        disabled={busy}
        onPress={() => void handleImport("csv")}
      />
      <ActionRow
        id="importJson"
        label="JSON records…"
        hint="A list of records; each becomes a capsule."
        disabled={busy}
        onPress={() => void handleImport("json")}
      />
      <ActionRow
        id="importMarkdown"
        label="Markdown note…"
        hint="Becomes a note capsule."
        disabled={busy}
        onPress={() => void handleImport("markdown")}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    padding: theme.spacing.three,
  },
  heading: {
    color: theme.colors.text,
    fontFamily: theme.fonts.rounded,
    fontSize: 18,
    marginTop: theme.spacing.three,
    marginBottom: theme.spacing.two,
  },
  notice: {
    color: theme.colors.text,
    fontFamily: theme.fonts.sans,
    padding: theme.spacing.three,
    borderRadius: theme.spacing.two,
    backgroundColor: theme.colors.backgroundSelected,
    marginBottom: theme.spacing.two,
  },
  error: {
    color: theme.colors.danger,
    fontFamily: theme.fonts.sans,
    padding: theme.spacing.three,
    marginBottom: theme.spacing.two,
  },
}));

const testIDs = createComponentTestIDs("ImportExportScreen", {
  containers: ["root"] as const,
  texts: ["busy", "result", "error"] as const,
});

ImportExportScreen.testIDs = testIDs;
