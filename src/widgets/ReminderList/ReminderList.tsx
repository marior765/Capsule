import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import type { Reminder } from "@/entities/reminder";
import { createComponentTestIDs } from "@/shared/testing";
import {
  formatReminderTime,
  type ReminderPreset,
  type ReminderPresetKey,
} from "./reminderTime";
import { ReminderDateTimePicker } from "./ReminderDateTimePicker";

type ReminderListProps = {
  reminders: Reminder[];
  /** Quick choices to offer (from `reminderPresets(now)`). */
  presets: ReminderPreset[];
  /** Used to label times "Today"/"Tomorrow" and to mark passed ones. */
  now: number;
  /** Called with the tapped preset's key; the caller resolves its time at tap time (`resolvePreset`). */
  onAdd: (presetKey: ReminderPresetKey) => void;
  onCancel: (reminderId: string) => void;
  /** A time chosen with "Pick date & time…" (8.11). */
  onAddAt: (at: number) => void;
  /** True while a reminder is being set or cancelled — every button is disabled. */
  busy: boolean;
  error: string | null;
  /** Something worth knowing that isn't a failure (e.g. notifications are off). */
  notice: string | null;
};

/**
 * A capsule's reminders (8.8) plus quick "remind me" choices. Purely
 * controlled like `AttachmentList` — the route asks for permission,
 * schedules and cancels. A reminder with no scheduled notification says
 * so: it is saved, but nothing will pop up unless notifications are on.
 */
export function ReminderList({
  reminders,
  presets,
  now,
  onAdd,
  onCancel,
  onAddAt,
  busy,
  error,
  notice,
}: ReminderListProps) {
  // When the picker was opened (its starting point), or null when closed.
  const [pickingFrom, setPickingFrom] = useState<number | null>(null);
  return (
    <View testID={testIDs.containers.root} style={styles.root}>
      {reminders.length === 0 && (
        <Text testID={testIDs.texts.empty} style={styles.meta}>
          No reminders.
        </Text>
      )}

      {reminders.map((reminder) => {
        const when = formatReminderTime(reminder.remindAt, now);
        return (
          <View key={reminder.id} style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.name}>{when}</Text>
              {reminder.notificationId === null && reminder.remindAt > now && (
                <Text style={styles.meta}>
                  Not scheduled — notifications are off for Capsule.
                </Text>
              )}
            </View>
            <Pressable
              testID={`${testIDs.buttons.cancel}_${reminder.id}`}
              onPress={() => onCancel(reminder.id)}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel={`Cancel reminder ${when}`}
              accessibilityState={{ disabled: busy, busy }}
            >
              <Text style={styles.removeLabel}>✕</Text>
            </Pressable>
          </View>
        );
      })}

      {notice !== null && (
        <Text
          testID={testIDs.texts.notice}
          style={styles.notice}
          accessibilityLiveRegion="polite"
        >
          {notice}
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

      <View style={styles.actions}>
        {presets.map((preset) => (
          <Pressable
            key={preset.key}
            testID={`${testIDs.buttons.preset}_${preset.key}`}
            style={styles.action}
            onPress={() => onAdd(preset.key)}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={`Remind me: ${preset.label}`}
            accessibilityState={{ disabled: busy, busy }}
          >
            <Text style={styles.actionLabel}>{preset.label}</Text>
          </Pressable>
        ))}
        <Pressable
          testID={testIDs.buttons.pickDateTime}
          style={styles.action}
          onPress={() => setPickingFrom(Date.now())}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Remind me at a date and time you choose"
          accessibilityState={{ disabled: busy, busy }}
        >
          <Text style={styles.actionLabel}>Pick date & time…</Text>
        </Pressable>
      </View>
      {pickingFrom !== null && (
        <ReminderDateTimePicker
          now={pickingFrom}
          onPick={onAddAt}
          onClose={() => setPickingFrom(null)}
        />
      )}
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
  notice: {
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.sans,
    fontSize: 12,
    marginTop: theme.spacing.one,
  },
  error: {
    color: theme.colors.danger,
    fontFamily: theme.fonts.sans,
    fontSize: 12,
    marginTop: theme.spacing.one,
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.two,
    marginTop: theme.spacing.two,
  },
  action: {
    paddingHorizontal: theme.spacing.three,
    paddingVertical: theme.spacing.two,
    borderRadius: theme.spacing.two,
    backgroundColor: theme.colors.backgroundSelected,
  },
  actionLabel: {
    color: theme.colors.accent,
    fontFamily: theme.fonts.rounded,
    fontSize: 13,
  },
}));

const testIDs = createComponentTestIDs("ReminderList", {
  containers: ["root"] as const,
  texts: ["empty", "error", "notice"] as const,
  buttons: ["preset", "cancel", "pickDateTime"] as const,
});

ReminderList.testIDs = testIDs;
