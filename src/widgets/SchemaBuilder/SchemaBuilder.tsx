import { useState } from "react";
import { Pressable, Switch, Text, TextInput, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { buildTestID, createComponentTestIDs } from "@/shared/testing";
import type { FieldType } from "@/entities/field";
import { moveField } from "./moveField";

export type FieldDraft = {
  /**
   * A real `CapsuleField.id` when editing an already-saved type; a
   * caller-generated placeholder for a field that's only staged locally
   * and not persisted yet (e.g. while building a brand-new type in
   * `types/new.tsx`, before "Create type" is pressed). This widget never
   * inspects or interprets the value beyond passing it back verbatim in
   * its callbacks — it's an opaque key, not a domain concept it owns.
   */
  id: string;
  name: string;
  fieldType: FieldType;
  required: boolean;
};

const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: "Text",
  long_text: "Long text",
  number: "Number",
  boolean: "Yes/No",
  date: "Date",
  single_select: "Single select",
  multi_select: "Multi select",
  relation: "Relation",
  attachment: "Attachment",
};

const FIELD_TYPES = Object.keys(FIELD_TYPE_LABELS) as FieldType[];

type SchemaBuilderProps = {
  name: string;
  onNameChange: (name: string) => void;
  description: string;
  onDescriptionChange: (description: string) => void;
  /** Caller-owned, already in display order (`sortOrder` ascending). */
  fields: FieldDraft[];
  onAddField: (draft: Omit<FieldDraft, "id">) => void;
  onRemoveField: (fieldId: string) => void;
  onToggleRequired: (fieldId: string) => void;
  /** The whole reordered array — SchemaBuilder computes the move itself (via `moveField`) and hands back the result; the caller only needs to persist it (a local splice for an unsaved type, or `manage-schema`'s `reorderFields(db, typeId, nextFields.map(f => f.id))` for an already-saved one). */
  onReorder: (nextFields: FieldDraft[]) => void;
};

/**
 * The UI for `manage-schema` (docs/ARCHITECTURE.md's `SchemaBuilder`) —
 * authors a `CapsuleType`'s name, description, and field list. Purely
 * controlled, like `CapsuleEditor`/`FieldRenderer`: owns no domain state,
 * does no persistence — the caller (`types/new.tsx` or `types/[id].tsx`)
 * decides whether a change applies immediately (an already-saved type) or
 * stays local until an explicit save (a type still being created). The
 * one piece of local state here is the "add a field" mini-form's own
 * draft name/type, which is genuinely transient UI input, not domain
 * data — it's discarded the moment `onAddField` fires.
 *
 * Deliberately does NOT support renaming a field or changing its type
 * after it's added, and every new field's `config` is always `null` —
 * inline field-renaming and per-type `config` authoring (e.g. defining a
 * `single_select`'s option list) are out of this step's scope. Choosing
 * `relation`/`attachment` here is allowed (matches `entities/field`'s own
 * `FieldType` union) even though neither renders a real control yet —
 * `FieldRenderer` already degrades gracefully for both with its own
 * "not supported yet" placeholder (6.2), so nothing here is unsafe to
 * create ahead of 6.8 actually building their controls.
 */
export function SchemaBuilder({
  name,
  onNameChange,
  description,
  onDescriptionChange,
  fields,
  onAddField,
  onRemoveField,
  onToggleRequired,
  onReorder,
}: SchemaBuilderProps) {
  const [draftName, setDraftName] = useState("");
  const [draftType, setDraftType] = useState<FieldType>("text");

  const handleAddField = () => {
    const trimmed = draftName.trim();
    if (!trimmed) return;
    onAddField({ name: trimmed, fieldType: draftType, required: false });
    setDraftName("");
    setDraftType("text");
  };

  const handleMove = (index: number, direction: "up" | "down") => {
    const next = moveField(fields, index, direction);
    if (next !== fields) onReorder(next);
  };

  return (
    <View testID={testIDs.containers.root}>
      <TextInput
        testID={testIDs.inputs.name}
        style={styles.titleInput}
        value={name}
        onChangeText={onNameChange}
        placeholder="Type name (e.g. Book)"
      />
      <TextInput
        testID={testIDs.inputs.description}
        style={[styles.input, styles.multiline]}
        value={description}
        onChangeText={onDescriptionChange}
        placeholder="Description (optional)"
        multiline
      />

      <Text style={styles.heading}>Fields</Text>
      {fields.length === 0 && (
        <Text testID={testIDs.texts.emptyFields} style={styles.meta}>
          No fields yet.
        </Text>
      )}
      {fields.map((field, index) => (
        <View
          key={field.id}
          testID={`${testIDs.containers.fieldRow}_${field.id}`}
          style={styles.fieldRow}
        >
          <View style={styles.fieldMain}>
            <Text style={styles.fieldName}>{field.name}</Text>
            <Text style={styles.meta}>
              {FIELD_TYPE_LABELS[field.fieldType]}
            </Text>
          </View>
          <Switch
            testID={buildTestID(
              "input",
              "SchemaBuilder",
              `required_${field.id}`,
            )}
            value={field.required}
            onValueChange={() => onToggleRequired(field.id)}
          />
          {index > 0 && (
            <Pressable
              testID={buildTestID(
                "pressable",
                "SchemaBuilder",
                `moveUp_${field.id}`,
              )}
              onPress={() => handleMove(index, "up")}
            >
              <Text style={styles.moveLabel}>↑</Text>
            </Pressable>
          )}
          {index < fields.length - 1 && (
            <Pressable
              testID={buildTestID(
                "pressable",
                "SchemaBuilder",
                `moveDown_${field.id}`,
              )}
              onPress={() => handleMove(index, "down")}
            >
              <Text style={styles.moveLabel}>↓</Text>
            </Pressable>
          )}
          <Pressable
            testID={buildTestID(
              "pressable",
              "SchemaBuilder",
              `removeField_${field.id}`,
            )}
            onPress={() => onRemoveField(field.id)}
          >
            <Text style={styles.removeLabel}>Remove</Text>
          </Pressable>
        </View>
      ))}

      <Text style={styles.heading}>Add a field</Text>
      <TextInput
        testID={testIDs.inputs.newFieldName}
        style={styles.input}
        value={draftName}
        onChangeText={setDraftName}
        placeholder="Field name (e.g. Author)"
      />
      <View testID={testIDs.containers.typeOptions} style={styles.optionsRow}>
        {FIELD_TYPES.map((fieldType) => {
          const selected = draftType === fieldType;
          return (
            <Pressable
              key={fieldType}
              testID={buildTestID(
                "pressable",
                "SchemaBuilder",
                `fieldType_${fieldType}`,
              )}
              style={[styles.chip, selected && styles.chipSelected]}
              onPress={() => setDraftType(fieldType)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
            >
              <Text
                style={[styles.chipLabel, selected && styles.chipLabelSelected]}
              >
                {FIELD_TYPE_LABELS[fieldType]}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Pressable
        testID={testIDs.buttons.addField}
        style={styles.primary}
        onPress={handleAddField}
      >
        <Text style={styles.primaryLabel}>Add field</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  titleInput: {
    color: theme.colors.text,
    fontFamily: theme.fonts.rounded,
    fontSize: 20,
    marginBottom: theme.spacing.two,
  },
  input: {
    backgroundColor: theme.colors.backgroundElement,
    color: theme.colors.text,
    fontFamily: theme.fonts.sans,
    padding: theme.spacing.three,
    borderRadius: theme.spacing.two,
    marginBottom: theme.spacing.two,
  },
  multiline: {
    minHeight: theme.spacing.six,
    textAlignVertical: "top",
  },
  heading: {
    color: theme.colors.text,
    fontFamily: theme.fonts.rounded,
    marginTop: theme.spacing.three,
    marginBottom: theme.spacing.two,
  },
  meta: {
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.sans,
    fontSize: 12,
  },
  fieldRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.two,
    backgroundColor: theme.colors.backgroundElement,
    padding: theme.spacing.three,
    borderRadius: theme.spacing.two,
    marginBottom: theme.spacing.two,
  },
  fieldMain: {
    flex: 1,
  },
  fieldName: {
    color: theme.colors.text,
    fontFamily: theme.fonts.sans,
  },
  moveLabel: {
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.rounded,
    fontSize: 16,
    paddingHorizontal: theme.spacing.one,
  },
  removeLabel: {
    color: theme.colors.danger,
    fontFamily: theme.fonts.rounded,
    fontSize: 12,
  },
  optionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.one,
    marginBottom: theme.spacing.three,
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
  primary: {
    alignItems: "center",
    paddingVertical: theme.spacing.three,
    borderRadius: theme.spacing.two,
    backgroundColor: theme.colors.backgroundSelected,
  },
  primaryLabel: {
    color: theme.colors.text,
    fontFamily: theme.fonts.rounded,
  },
}));

const testIDs = createComponentTestIDs("SchemaBuilder", {
  containers: ["root", "fieldRow", "typeOptions"] as const,
  inputs: ["name", "description", "newFieldName"] as const,
  texts: ["emptyFields"] as const,
  buttons: ["addField"] as const,
});

SchemaBuilder.testIDs = testIDs;
