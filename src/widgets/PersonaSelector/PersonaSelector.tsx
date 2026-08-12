import { Pressable, Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import type { Persona } from "@/entities/persona";
import { createComponentTestIDs } from "@/shared/testing";

type PersonaSelectorProps = {
  personas: Persona[];
  selectedId?: string | null;
  /** `null` means "no persona" — only offered when `allowNone` is set. */
  onSelect: (persona: Persona | null) => void;
  allowNone?: boolean;
};

export function PersonaSelector({
  personas,
  selectedId = null,
  onSelect,
  allowNone = true,
}: PersonaSelectorProps) {
  return (
    <View testID={testIDs.containers.root}>
      {allowNone && (
        <Pressable
          testID={testIDs.pressables.none}
          style={[styles.row, selectedId === null && styles.rowSelected]}
          onPress={() => onSelect(null)}
        >
          <Text style={styles.name}>No persona</Text>
          <Text style={styles.meta}>
            Use the model&apos;s default behaviour
          </Text>
        </Pressable>
      )}

      {personas.map((persona) => (
        <Pressable
          key={persona.id}
          testID={`${testIDs.pressables.row}_${persona.id}`}
          style={[styles.row, selectedId === persona.id && styles.rowSelected]}
          onPress={() => onSelect(persona)}
        >
          <Text testID={testIDs.texts.name} style={styles.name}>
            {persona.name}
          </Text>
          <Text
            testID={testIDs.texts.prompt}
            style={styles.meta}
            numberOfLines={2}
          >
            {persona.systemPrompt}
          </Text>
        </Pressable>
      ))}

      {personas.length === 0 && (
        <Text testID={testIDs.labels.empty} style={styles.meta}>
          No personas yet.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  row: {
    backgroundColor: theme.colors.backgroundElement,
    padding: theme.spacing.three,
    borderRadius: theme.spacing.two,
    marginBottom: theme.spacing.two,
  },
  rowSelected: {
    backgroundColor: theme.colors.backgroundSelected,
  },
  name: {
    color: theme.colors.text,
    fontFamily: theme.fonts.sans,
  },
  meta: {
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.sans,
    fontSize: 12,
  },
}));

const testIDs = createComponentTestIDs("PersonaSelector", {
  containers: ["root"] as const,
  pressables: ["row", "none"] as const,
  texts: ["name", "prompt"] as const,
  labels: ["empty"] as const,
});

PersonaSelector.testIDs = testIDs;
