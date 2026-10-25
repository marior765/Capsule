import { DateTimePicker } from "@expo/ui/community/datetime-picker";
import { useState } from "react";
import { Modal, Platform, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { createComponentTestIDs } from "@/shared/testing";
import {
  dateValueFromLocal,
  dateValueFromUtc,
  formatDateValue,
  localDayAsUtcMidnight,
  pickerStartDate,
} from "./fieldDate";

type FieldDateInputProps = {
  label: string;
  /** "YYYY-MM-DD", or null when empty. */
  value: string | null;
  onChange: (value: string | null) => void;
};

/**
 * A date field's control (10.22): shows the day and opens the native picker
 * — a calendar sheet with Done on iOS, the system date dialog on Android —
 * instead of asking for "YYYY-MM-DD" in a text box. Clear empties it.
 */
export function FieldDateInput({
  label,
  value,
  onChange,
}: FieldDateInputProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Date>(() =>
    pickerStartDate(value, new Date()),
  );
  const insets = useSafeAreaInsets();
  const { theme } = useUnistyles();

  const openPicker = () => {
    setDraft(pickerStartDate(value, new Date()));
    setOpen(true);
  };

  return (
    <View style={styles.row}>
      <Pressable
        testID={testIDs.buttons.open}
        style={styles.field}
        onPress={openPicker}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value ? formatDateValue(value) : "not set"}`}
        accessibilityHint="Opens a date picker"
      >
        <Text style={value ? styles.value : styles.placeholder}>
          {value ? formatDateValue(value) : "Choose a date"}
        </Text>
      </Pressable>
      {value !== null && (
        <Pressable
          testID={testIDs.buttons.clear}
          style={styles.clear}
          onPress={() => onChange(null)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Clear ${label}`}
        >
          <Text style={styles.clearLabel}>Clear</Text>
        </Pressable>
      )}

      {open && Platform.OS === "android" && (
        <DateTimePicker
          value={localDayAsUtcMidnight(draft)}
          mode="date"
          onValueChange={(_, picked) => {
            setOpen(false);
            onChange(dateValueFromUtc(picked));
          }}
          onDismiss={() => setOpen(false)}
        />
      )}

      {open && Platform.OS !== "android" && (
        <Modal
          transparent
          animationType="slide"
          onRequestClose={() => setOpen(false)}
        >
          <View style={styles.backdrop}>
            <View
              testID={testIDs.containers.sheet}
              style={[
                styles.sheet,
                { paddingBottom: Math.max(insets.bottom, theme.spacing.three) },
              ]}
            >
              {/* Cancel / Done sit above the calendar: its native view draws
                  past the height it reports, so anything placed below it
                  could end up underneath. */}
              <View style={styles.header}>
                <Pressable
                  testID={testIDs.buttons.cancel}
                  style={styles.button}
                  onPress={() => setOpen(false)}
                  accessibilityRole="button"
                >
                  <Text style={styles.cancelLabel}>Cancel</Text>
                </Pressable>
                <Text
                  style={styles.title}
                  numberOfLines={1}
                  accessibilityRole="header"
                >
                  {label}
                </Text>
                <Pressable
                  testID={testIDs.buttons.done}
                  style={styles.button}
                  onPress={() => {
                    setOpen(false);
                    onChange(dateValueFromLocal(draft));
                  }}
                  accessibilityRole="button"
                >
                  <Text style={styles.doneLabel}>Done</Text>
                </Pressable>
              </View>
              <DateTimePicker
                testID={testIDs.inputs.calendar}
                value={draft}
                mode="date"
                display="inline"
                style={styles.calendar}
                onValueChange={(_, picked) => setDraft(picked)}
              />
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.two,
  },
  field: {
    flex: 1,
    backgroundColor: theme.colors.backgroundElement,
    padding: theme.spacing.three,
    borderRadius: theme.spacing.two,
  },
  value: {
    color: theme.colors.text,
    fontFamily: theme.fonts.sans,
  },
  placeholder: {
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.sans,
  },
  clear: {
    paddingHorizontal: theme.spacing.two,
  },
  clearLabel: {
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.rounded,
    fontSize: 12,
  },
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
    flex: 1,
    textAlign: "center",
    color: theme.colors.text,
    fontFamily: theme.fonts.rounded,
    fontSize: 17,
  },
  // Room for a six-week month; the calendar centres itself in its frame.
  calendar: {
    height: 400,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.two,
    marginBottom: theme.spacing.two,
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
  doneLabel: {
    color: theme.colors.accent,
    fontFamily: theme.fonts.rounded,
  },
}));

const testIDs = createComponentTestIDs("FieldDateInput", {
  buttons: ["open", "clear", "cancel", "done"] as const,
  inputs: ["calendar"] as const,
  containers: ["sheet"] as const,
});

FieldDateInput.testIDs = testIDs;
