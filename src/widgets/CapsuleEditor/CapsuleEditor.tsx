import { ScrollView, Text, TextInput, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { createComponentTestIDs } from "@/shared/testing";
import type { CapsuleField } from "@/entities/field";
import { FieldRenderer } from "@/widgets/FieldRenderer";

type CapsuleEditorProps = {
  title: string;
  onTitleChange: (title: string) => void;
  /** Already fetched by the caller, expected pre-sorted by sortOrder (`getFieldsByCapsuleType`'s own order). */
  fields: CapsuleField[];
  /** fieldId -> current value, matching CapsuleValue.value's shape. */
  values: Record<string, string | null>;
  onValueChange: (fieldId: string, value: string | null) => void;
};

/**
 * Composes a title input + one `FieldRenderer` per `CapsuleField` into a
 * single edit form. Purely controlled, like `FieldRenderer` and
 * `VoiceRecordButton` — owns no state, does no persistence, and has no
 * idea whether it's editing a brand-new or an already-saved capsule.
 * There's no capsule route to mount this in yet (docs/DEVELOPMENT_PLAN.md
 * 6.3, "CapsuleList + CapsuleCard, capsules routes") — a future route
 * owns fetching `fields`/`values`, wiring `onTitleChange`/`onValueChange`
 * to `entities/capsule`'s `insertCapsule`/`updateCapsule`/`upsertCapsuleValue`,
 * and deciding when/whether those writes happen (as-you-type vs. an
 * explicit save action) — a UX decision this widget deliberately doesn't
 * make.
 */
export function CapsuleEditor({
  title,
  onTitleChange,
  fields,
  values,
  onValueChange,
}: CapsuleEditorProps) {
  return (
    <ScrollView
      testID={testIDs.containers.root}
      contentContainerStyle={styles.content}
    >
      <TextInput
        testID={testIDs.inputs.title}
        style={styles.titleInput}
        value={title}
        onChangeText={onTitleChange}
        placeholder="Title"
      />
      {fields.map((field) => (
        <View key={field.id} style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>
            {field.name}
            {field.required ? " *" : ""}
          </Text>
          <FieldRenderer
            field={field}
            value={values[field.id] ?? null}
            onChange={(value) => onValueChange(field.id, value)}
          />
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create((theme) => ({
  content: {
    padding: theme.spacing.three,
  },
  titleInput: {
    color: theme.colors.text,
    fontFamily: theme.fonts.rounded,
    fontSize: 20,
    marginBottom: theme.spacing.four,
  },
  fieldRow: {
    marginBottom: theme.spacing.four,
  },
  fieldLabel: {
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.sans,
    fontSize: 13,
    marginBottom: theme.spacing.one,
  },
}));

const testIDs = createComponentTestIDs("CapsuleEditor", {
  containers: ["root"] as const,
  inputs: ["title"] as const,
});

CapsuleEditor.testIDs = testIDs;
