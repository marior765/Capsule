import { useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import type { SQLiteDatabase } from "expo-sqlite";
import { createComponentTestIDs } from "@/shared/testing";
import { deleteCapsule } from "@/features/delete-capsule";
import type { BulkOperationResult } from "@/shared/lib";
import { bulkDeleteWithConfirmation } from "./bulkDeleteWithConfirmation";

type BulkActionBarProps = {
  db: SQLiteDatabase;
  selectedIds: string[];
  /**
   * Called once a confirmed bulk delete actually ran, with the full
   * result — the caller (`capsules/index.tsx`) owns `selectedIds`/
   * `selectionMode` and the capsule list itself, so it's responsible for
   * re-fetching and deciding what to do with a partial failure (this
   * widget's OWN `error` state would otherwise be invisible: unmounting
   * on every call, regardless of outcome, hides the very message this
   * widget computes). Mirrors `WipeDataSettings`' `onWiped` callback shape,
   * extended with the result since a wipe has no partial-failure case to
   * report but a multi-id batch does.
   */
  onDeleted: (result: BulkOperationResult<void>) => void;
};

/**
 * The action bar shown while `capsules/index.tsx` is in bulk-select mode
 * with at least one capsule selected — mirrors `WipeDataSettings`' shape
 * exactly (a widget that takes `db` as a prop and calls a feature
 * function itself, `Alert.alert` wrapped in a promise for confirmation,
 * the actual "never without confirmation" logic delegated to an already
 * unit-tested, injected-dependency orchestrator). A bulk delete is just
 * as destructive as a full wipe, at a smaller scale — same discipline.
 *
 * `runBulkOperation`'s continue-on-error semantics mean a failure on one
 * capsule doesn't lose the rest of the batch — `deleteCapsule` itself has
 * no realistic failure mode against a normal db (confirmed empirically:
 * deleting an unknown id doesn't throw either), so `result.failed` is
 * expected to stay empty in practice, but the count is still surfaced
 * rather than assumed, in case a future cascade step ever does add one.
 */
export function BulkActionBar({
  db,
  selectedIds,
  onDeleted,
}: BulkActionBarProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirmViaAlert = (): Promise<boolean> =>
    new Promise((resolve) => {
      Alert.alert(
        `Delete ${selectedIds.length} capsule${selectedIds.length === 1 ? "" : "s"}?`,
        "This cannot be undone.",
        [
          { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
          {
            text: "Delete",
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
      const result = await bulkDeleteWithConfirmation(
        selectedIds,
        confirmViaAlert,
        (id) => deleteCapsule(db, id),
      );
      if (result === null) return;
      if (result.failed.length > 0) {
        setError(`${result.failed.length} capsule(s) could not be deleted.`);
      }
      onDeleted(result);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View testID={testIDs.containers.root} style={styles.root}>
      {error !== null && (
        <Text
          testID={testIDs.texts.error}
          style={styles.error}
          accessibilityLiveRegion="polite"
        >
          {error}
        </Text>
      )}
      <Text testID={testIDs.texts.count} style={styles.count}>
        {selectedIds.length} selected
      </Text>
      <Pressable
        testID={testIDs.buttons.delete}
        style={styles.deleteButton}
        onPress={handlePress}
        disabled={busy || selectedIds.length === 0}
        accessibilityRole="button"
        accessibilityLabel={`Delete ${selectedIds.length} selected capsule${selectedIds.length === 1 ? "" : "s"}`}
        accessibilityState={{ disabled: busy || selectedIds.length === 0 }}
      >
        <Text style={styles.deleteLabel}>{busy ? "Deleting…" : "Delete"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.three,
    paddingVertical: theme.spacing.two,
    backgroundColor: theme.colors.backgroundElement,
  },
  count: {
    color: theme.colors.text,
    fontFamily: theme.fonts.sans,
    fontSize: 13,
  },
  error: {
    color: theme.colors.danger,
    fontFamily: theme.fonts.sans,
    fontSize: 12,
  },
  deleteButton: {
    paddingHorizontal: theme.spacing.three,
    paddingVertical: theme.spacing.one,
    borderRadius: theme.spacing.two,
    backgroundColor: theme.colors.danger,
  },
  deleteLabel: {
    color: theme.colors.background,
    fontFamily: theme.fonts.rounded,
    fontSize: 13,
  },
}));

const testIDs = createComponentTestIDs("BulkActionBar", {
  containers: ["root"] as const,
  texts: ["count", "error"] as const,
  buttons: ["delete"] as const,
});

BulkActionBar.testIDs = testIDs;
