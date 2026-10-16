import { DateTimePicker } from "@expo/ui/community/datetime-picker";
import { useState } from "react";
import { Modal, Platform, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { createComponentTestIDs } from "@/shared/testing";
import {
  combinePickedDayAndTime,
  defaultPickerDate,
  localDayAsUtcMidnight,
  withLocalDate,
  withLocalTime,
} from "./reminderTime";

type ReminderDateTimePickerProps = {
  /** When the picker opened — its starting value and earliest date. */
  now: number;
  onPick: (at: number) => void;
  onClose: () => void;
};

/**
 * "Pick date & time…" for a reminder (8.11), on `@expo/ui`'s picker. iOS
 * shows a date calendar and a separate time row in a sheet with Set /
 * Cancel — not the combined inline datetime picker, whose time row
 * overflowed its measured height and hid under the buttons (10.8).
 * Android has no combined picker, so it asks for the day, then the time, in
 * two system dialogs. A time in the past is refused by `addReminder`.
 */
export function ReminderDateTimePicker({
  now,
  onPick,
  onClose,
}: ReminderDateTimePickerProps) {
  const [value, setValue] = useState(() => defaultPickerDate(now));
  const [day, setDay] = useState<Date | null>(null);
  const insets = useSafeAreaInsets();
  const { theme } = useUnistyles();
  const minimumDate = new Date(now);

  if (Platform.OS === "android") {
    // The date dialog works in whole days as midnight UTC: start it on the
    // local day of `value`, and read its answer in UTC (see reminderTime).
    // `minimumDate` is converted by the native side itself.
    return day === null ? (
      <DateTimePicker
        value={localDayAsUtcMidnight(value)}
        mode="date"
        minimumDate={minimumDate}
        onValueChange={(_, picked) => setDay(picked)}
        onDismiss={onClose}
      />
    ) : (
      <DateTimePicker
        value={value}
        mode="time"
        onValueChange={(_, picked) => {
          onPick(combinePickedDayAndTime(day, picked));
          onClose();
        }}
        onDismiss={onClose}
      />
    );
  }

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View
          testID={testIDs.containers.sheet}
          style={[
            styles.sheet,
            // Clear the home indicator; the sheet sits at the screen's bottom edge.
            { paddingBottom: Math.max(insets.bottom, theme.spacing.three) },
          ]}
        >
          <Text style={styles.title} accessibilityRole="header">
            Remind me
          </Text>
          <DateTimePicker
            testID={testIDs.inputs.date}
            value={value}
            mode="date"
            display="inline"
            minimumDate={minimumDate}
            onValueChange={(_, picked) =>
              setValue((current) => withLocalDate(current, picked))
            }
          />
          <View style={styles.timeRow}>
            <Text style={styles.timeLabel}>Time</Text>
            <DateTimePicker
              testID={testIDs.inputs.time}
              value={value}
              mode="time"
              display="compact"
              style={styles.timePicker}
              minimumDate={minimumDate}
              onValueChange={(_, picked) =>
                setValue((current) => withLocalTime(current, picked))
              }
            />
          </View>
          <View style={styles.actions}>
            <Pressable
              testID={testIDs.buttons.cancel}
              style={styles.button}
              onPress={onClose}
              accessibilityRole="button"
            >
              <Text style={styles.cancelLabel}>Cancel</Text>
            </Pressable>
            <Pressable
              testID={testIDs.buttons.set}
              style={styles.button}
              onPress={() => {
                onPick(value.getTime());
                onClose();
              }}
              accessibilityRole="button"
            >
              <Text style={styles.setLabel}>Set reminder</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create((theme) => ({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  sheet: {
    backgroundColor: theme.colors.background,
    padding: theme.spacing.three,
    borderTopLeftRadius: theme.spacing.three,
    borderTopRightRadius: theme.spacing.three,
  },
  title: {
    color: theme.colors.text,
    fontFamily: theme.fonts.rounded,
    fontSize: 18,
    marginBottom: theme.spacing.two,
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.two,
    marginTop: theme.spacing.three,
  },
  // The compact picker's native host otherwise collapses to ~0 width (and
  // its content spills off-screen); give it the rest of the row.
  timePicker: {
    flex: 1,
  },
  timeLabel: {
    color: theme.colors.text,
    fontFamily: theme.fonts.sans,
    fontSize: 16,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: theme.spacing.two,
    marginTop: theme.spacing.two,
  },
  button: {
    paddingHorizontal: theme.spacing.three,
    paddingVertical: theme.spacing.two,
    borderRadius: theme.spacing.two,
    backgroundColor: theme.colors.backgroundSelected,
  },
  cancelLabel: {
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.rounded,
  },
  setLabel: {
    color: theme.colors.accent,
    fontFamily: theme.fonts.rounded,
  },
}));

const testIDs = createComponentTestIDs("ReminderDateTimePicker", {
  containers: ["sheet"] as const,
  buttons: ["cancel", "set"] as const,
  inputs: ["date", "time"] as const,
});

ReminderDateTimePicker.testIDs = testIDs;
