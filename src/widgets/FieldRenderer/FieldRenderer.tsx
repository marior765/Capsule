import { Pressable, Switch, Text, TextInput, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { buildTestID, createComponentTestIDs } from "@/shared/testing";
import type { CapsuleField } from "@/entities/field";
import {
  parseBooleanValue,
  parseMultiSelectValue,
  parseSelectOptions,
  serializeBooleanValue,
  serializeMultiSelectValue,
} from "./fieldValueCodec";

type FieldRendererProps = {
  field: CapsuleField;
  /** The field's current value — always `string | null`, matching `CapsuleValue.value`. */
  value: string | null;
  onChange: (value: string | null) => void;
};

/**
 * Renders the input control for one `CapsuleField`, dispatched on its
 * `fieldType`. "Base field types" only (docs/DEVELOPMENT_PLAN.md 6.2) —
 * `relation`/`attachment` render a placeholder; their real controls are
 * 6.8's job (structurally different: a relation needs to browse/pick other
 * capsules, an attachment needs file pickers — neither fits this widget's
 * plain-value-in, plain-value-out contract without their own design pass).
 *
 * Purely controlled — like `VoiceRecordButton`, this component owns no
 * state of its own; the caller (`CapsuleEditor`, a later piece of this
 * same step) is responsible for persisting `onChange`'s result.
 */
export function FieldRenderer({ field, value, onChange }: FieldRendererProps) {
  switch (field.fieldType) {
    case "text":
      return (
        <TextInput
          testID={testIDs.inputs.text}
          style={styles.input}
          value={value ?? ""}
          onChangeText={(text) => onChange(text || null)}
        />
      );

    case "long_text":
      return (
        <TextInput
          testID={testIDs.inputs.longText}
          style={[styles.input, styles.longText]}
          value={value ?? ""}
          onChangeText={(text) => onChange(text || null)}
          multiline
        />
      );

    case "number":
      return (
        <TextInput
          testID={testIDs.inputs.number}
          style={styles.input}
          value={value ?? ""}
          onChangeText={(text) => onChange(text || null)}
          keyboardType="numbers-and-punctuation"
          inputMode="decimal"
        />
      );

    case "boolean":
      return (
        <Switch
          testID={testIDs.inputs.boolean}
          value={parseBooleanValue(value)}
          onValueChange={(next) => onChange(serializeBooleanValue(next))}
        />
      );

    case "date":
      // A plain text field for now — a real native date picker (@expo/ui
      // ships one) is a follow-on UI polish pass, not blocking this step.
      return (
        <TextInput
          testID={testIDs.inputs.date}
          style={styles.input}
          value={value ?? ""}
          onChangeText={(text) => onChange(text || null)}
          placeholder="YYYY-MM-DD"
        />
      );

    case "single_select": {
      const options = parseSelectOptions(field.config);
      return (
        <View testID={testIDs.containers.options} style={styles.optionsRow}>
          {options.map((option, index) => {
            const selected = value === option;
            return (
              <Pressable
                key={option}
                testID={buildTestID(
                  "pressable",
                  "FieldRenderer",
                  `singleOption${index}`,
                )}
                style={[styles.chip, selected && styles.chipSelected]}
                onPress={() => onChange(selected ? null : option)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
              >
                <Text
                  style={[
                    styles.chipLabel,
                    selected && styles.chipLabelSelected,
                  ]}
                >
                  {option}
                </Text>
              </Pressable>
            );
          })}
        </View>
      );
    }

    case "multi_select": {
      const options = parseSelectOptions(field.config);
      const selectedValues = parseMultiSelectValue(value);
      return (
        <View testID={testIDs.containers.options} style={styles.optionsRow}>
          {options.map((option, index) => {
            const selected = selectedValues.includes(option);
            const toggle = () => {
              const next = selected
                ? selectedValues.filter((v) => v !== option)
                : [...selectedValues, option];
              onChange(serializeMultiSelectValue(next));
            };
            return (
              <Pressable
                key={option}
                testID={buildTestID(
                  "pressable",
                  "FieldRenderer",
                  `multiOption${index}`,
                )}
                style={[styles.chip, selected && styles.chipSelected]}
                onPress={toggle}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected }}
              >
                <Text
                  style={[
                    styles.chipLabel,
                    selected && styles.chipLabelSelected,
                  ]}
                >
                  {option}
                </Text>
              </Pressable>
            );
          })}
        </View>
      );
    }

    case "relation":
    case "attachment":
      return (
        <Text testID={testIDs.texts.unsupported} style={styles.unsupported}>
          {field.fieldType === "relation" ? "Relation" : "Attachment"} fields
          are not supported yet.
        </Text>
      );
  }
}

const styles = StyleSheet.create((theme) => ({
  input: {
    backgroundColor: theme.colors.backgroundElement,
    color: theme.colors.text,
    fontFamily: theme.fonts.sans,
    padding: theme.spacing.three,
    borderRadius: theme.spacing.two,
  },
  longText: {
    minHeight: theme.spacing.six,
    textAlignVertical: "top",
  },
  unsupported: {
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.sans,
    fontSize: 13,
    fontStyle: "italic",
  },
  optionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.one,
  },
  chip: {
    paddingVertical: theme.spacing.one,
    paddingHorizontal: theme.spacing.two,
    borderRadius: theme.spacing.four,
    backgroundColor: theme.colors.backgroundElement,
  },
  chipSelected: {
    backgroundColor: theme.colors.accent,
  },
  chipLabel: {
    color: theme.colors.text,
    fontFamily: theme.fonts.sans,
    fontSize: 13,
  },
  chipLabelSelected: {
    color: theme.colors.background,
  },
}));

const testIDs = createComponentTestIDs("FieldRenderer", {
  inputs: ["text", "longText", "number", "boolean", "date"] as const,
  containers: ["options"] as const,
  texts: ["unsupported"] as const,
});

FieldRenderer.testIDs = testIDs;
