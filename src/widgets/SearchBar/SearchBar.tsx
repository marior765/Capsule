import { Pressable, Text, TextInput, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { createComponentTestIDs, getInputTestId } from "@/shared/testing";

type SearchBarProps = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
};

/**
 * Purely controlled, like `CapsuleEditor`/`FieldRenderer` — owns no state,
 * knows nothing about what it's searching. The clear button only renders
 * once there's text to clear, matching the platform-standard search-field
 * affordance.
 */
export function SearchBar({
  value,
  onChangeText,
  placeholder = "Search capsules",
}: SearchBarProps) {
  return (
    <View testID={testIDs.containers.root} style={styles.root}>
      <TextInput
        testID={queryTestIDs.input}
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        autoCorrect={false}
        autoCapitalize="none"
      />
      {value.length > 0 && (
        <Pressable
          testID={queryTestIDs.clear}
          style={styles.clearButton}
          onPress={() => onChangeText("")}
        >
          <Text style={styles.clearLabel}>✕</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.backgroundElement,
    borderRadius: theme.spacing.two,
    paddingHorizontal: theme.spacing.three,
    marginHorizontal: theme.spacing.three,
    marginTop: theme.spacing.two,
  },
  input: {
    flex: 1,
    color: theme.colors.text,
    fontFamily: theme.fonts.sans,
    fontSize: 15,
    paddingVertical: theme.spacing.two,
  },
  clearButton: {
    paddingLeft: theme.spacing.two,
  },
  clearLabel: {
    color: theme.colors.textSecondary,
    fontSize: 13,
  },
}));

const testIDs = createComponentTestIDs("SearchBar", {
  containers: ["root"] as const,
  inputs: ["query"] as const,
});

const queryTestIDs = getInputTestId(testIDs.inputs.query);

SearchBar.testIDs = testIDs;
