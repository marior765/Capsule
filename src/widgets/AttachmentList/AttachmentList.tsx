import { Image } from "expo-image";
import { Pressable, Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import type { Attachment } from "@/entities/attachment";
import { createComponentTestIDs } from "@/shared/testing";
import { formatFileSize } from "./formatFileSize";

export type AttachmentEntry = {
  attachment: Attachment;
  /** Current `file://` URI of the stored copy, resolved by the caller. */
  uri: string;
};

type AttachmentListProps = {
  entries: AttachmentEntry[];
  onAddFile: () => void;
  onAddPhoto: () => void;
  onRemove: (attachmentId: string) => void;
  /** True while a pick/copy is in progress — both add buttons are disabled. */
  busy: boolean;
  error: string | null;
};

/**
 * One attachment field's files, plus "Add file" / "Add photo". Purely
 * controlled like `RelationPicker` — no state, no persistence, no picker
 * calls of its own; the route does all of that. Image attachments show a
 * small thumbnail from the stored local copy (never a remote URL).
 */
export function AttachmentList({
  entries,
  onAddFile,
  onAddPhoto,
  onRemove,
  busy,
  error,
}: AttachmentListProps) {
  return (
    <View testID={testIDs.containers.root} style={styles.root}>
      {entries.length === 0 && (
        <Text testID={testIDs.texts.empty} style={styles.meta}>
          No files attached.
        </Text>
      )}

      {entries.map(({ attachment, uri }) => {
        const size = formatFileSize(attachment.size);
        return (
          <View key={attachment.id} style={styles.row}>
            {attachment.mimeType?.startsWith("image/") && (
              <Image
                source={{ uri }}
                style={styles.thumbnail}
                contentFit="cover"
                accessibilityElementsHidden
                importantForAccessibility="no"
              />
            )}
            <View style={styles.rowText}>
              <Text style={styles.name} numberOfLines={1}>
                {attachment.filename}
              </Text>
              {size !== "" && <Text style={styles.meta}>{size}</Text>}
            </View>
            <Pressable
              testID={`${testIDs.buttons.remove}_${attachment.id}`}
              onPress={() => onRemove(attachment.id)}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${attachment.filename}`}
            >
              <Text style={styles.removeLabel}>✕</Text>
            </Pressable>
          </View>
        );
      })}

      {error !== null && (
        <Text
          testID={testIDs.texts.error}
          style={styles.error}
          accessibilityLiveRegion="polite"
        >
          {error}
        </Text>
      )}

      <View style={styles.actions}>
        <Pressable
          testID={testIDs.buttons.addFile}
          style={styles.action}
          onPress={onAddFile}
          disabled={busy}
          accessibilityRole="button"
          accessibilityState={{ disabled: busy, busy }}
        >
          <Text style={styles.actionLabel}>
            {busy ? "Adding…" : "Add file"}
          </Text>
        </Pressable>
        <Pressable
          testID={testIDs.buttons.addPhoto}
          style={styles.action}
          onPress={onAddPhoto}
          disabled={busy}
          accessibilityRole="button"
          accessibilityState={{ disabled: busy, busy }}
        >
          <Text style={styles.actionLabel}>Add photo</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: {
    marginTop: theme.spacing.two,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.two,
    paddingVertical: theme.spacing.one,
  },
  thumbnail: {
    width: 40,
    height: 40,
    borderRadius: theme.spacing.one,
    backgroundColor: theme.colors.backgroundElement,
  },
  rowText: {
    flex: 1,
  },
  name: {
    color: theme.colors.text,
    fontFamily: theme.fonts.sans,
    fontSize: 14,
  },
  meta: {
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.sans,
    fontSize: 12,
  },
  removeLabel: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    paddingHorizontal: theme.spacing.one,
  },
  error: {
    color: theme.colors.danger,
    fontFamily: theme.fonts.sans,
    fontSize: 12,
    marginTop: theme.spacing.one,
  },
  actions: {
    flexDirection: "row",
    gap: theme.spacing.two,
    marginTop: theme.spacing.two,
  },
  action: {
    backgroundColor: theme.colors.backgroundElement,
    borderRadius: theme.spacing.two,
    paddingHorizontal: theme.spacing.three,
    paddingVertical: theme.spacing.two,
  },
  actionLabel: {
    color: theme.colors.accent,
    fontFamily: theme.fonts.sans,
    fontSize: 13,
  },
}));

const testIDs = createComponentTestIDs("AttachmentList", {
  containers: ["root"] as const,
  texts: ["empty", "error"] as const,
  buttons: ["addFile", "addPhoto", "remove"] as const,
});

AttachmentList.testIDs = testIDs;
