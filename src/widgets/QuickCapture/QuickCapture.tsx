import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import type { CapsuleType } from "@/entities/capsule-type";
import { createComponentTestIDs } from "@/shared/testing";

type QuickCaptureProps = {
  /** Already fetched by the caller — no db access here, same as every other capsule-list widget. */
  capsuleTypes: CapsuleType[];
  onCapture: (input: { capsuleTypeId: string; title: string }) => void;
};

/**
 * "Fast new-capsule entry" (8.6) — title + a type picker only, deliberately
 * NOT the full field-by-field `CapsuleEditor` flow (`capsules/new.tsx`
 * already exists for that). The philosophy: capture the thought now, add
 * detail later by opening the capsule itself (already fully editable via
 * `capsules/[id]/edit.tsx`) — mirrors how many quick-note apps separate
 * "get it down fast" from "organize it properly."
 *
 * Purely controlled for what it PRODUCES (`onCapture`), but holds its own
 * draft `title`/type-selection state internally and clears the title
 * after each capture — deliberately stays mounted and ready for another
 * entry rather than closing itself, so capturing several capsules in a
 * row costs one tap each, not a re-open every time (the caller decides
 * whether to hide this panel at all; this widget never asks to be hidden).
 *
 * No type picker at all when there's only one `CapsuleType` — nothing to
 * choose, showing a single inert chip would be noise. Renders nothing
 * when there are zero types, matching `capsules/index.tsx`'s own existing
 * "no types yet" notice already covering that case elsewhere on the
 * screen — this widget doesn't duplicate that messaging.
 */
export function QuickCapture({ capsuleTypes, onCapture }: QuickCaptureProps) {
  const [title, setTitle] = useState("");
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);

  if (capsuleTypes.length === 0) return null;

  const activeTypeId = selectedTypeId ?? capsuleTypes[0].id;

  const handleCapture = () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    onCapture({ capsuleTypeId: activeTypeId, title: trimmed });
    setTitle("");
  };

  return (
    <View testID={testIDs.containers.root} style={styles.root}>
      {capsuleTypes.length > 1 && (
        <View testID={testIDs.containers.typePicker} style={styles.typeRow}>
          {capsuleTypes.map((type) => {
            const selected = activeTypeId === type.id;
            return (
              <Pressable
                key={type.id}
                testID={`${testIDs.pressables.typeChip}_${type.id}`}
                style={[styles.chip, selected && styles.chipSelected]}
                onPress={() => setSelectedTypeId(type.id)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
              >
                <Text
                  style={[
                    styles.chipLabel,
                    selected && styles.chipLabelSelected,
                  ]}
                >
                  {type.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
      <View style={styles.captureRow}>
        <TextInput
          testID={testIDs.inputs.title}
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="Quick capture…"
          returnKeyType="done"
          onSubmitEditing={handleCapture}
        />
        <Pressable
          testID={testIDs.buttons.capture}
          style={styles.captureButton}
          onPress={handleCapture}
        >
          <Text style={styles.captureLabel}>Add</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: {
    padding: theme.spacing.three,
    backgroundColor: theme.colors.backgroundElement,
  },
  typeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.one,
    marginBottom: theme.spacing.two,
  },
  chip: {
    paddingVertical: theme.spacing.one,
    paddingHorizontal: theme.spacing.two,
    borderRadius: theme.spacing.four,
    backgroundColor: theme.colors.background,
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
  captureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.two,
  },
  input: {
    flex: 1,
    backgroundColor: theme.colors.background,
    borderRadius: theme.spacing.two,
    paddingHorizontal: theme.spacing.two,
    paddingVertical: theme.spacing.one,
    color: theme.colors.text,
    fontFamily: theme.fonts.sans,
    fontSize: 14,
  },
  captureButton: {
    paddingHorizontal: theme.spacing.three,
    paddingVertical: theme.spacing.one,
    borderRadius: theme.spacing.two,
    backgroundColor: theme.colors.backgroundSelected,
  },
  captureLabel: {
    color: theme.colors.text,
    fontFamily: theme.fonts.rounded,
    fontSize: 13,
  },
}));

const testIDs = createComponentTestIDs("QuickCapture", {
  containers: ["root", "typePicker"] as const,
  pressables: ["typeChip"] as const,
  inputs: ["title"] as const,
  buttons: ["capture"] as const,
});

QuickCapture.testIDs = testIDs;
