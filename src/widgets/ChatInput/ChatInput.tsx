import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { createComponentTestIDs } from "@/shared/testing";

type ChatInputProps = {
  onSend: (text: string) => void;
  disabled?: boolean;
};

export function ChatInput({ onSend, disabled = false }: ChatInputProps) {
  const [text, setText] = useState("");

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText("");
  };

  return (
    <View testID={testIDs.containers.root} style={styles.root}>
      <TextInput
        testID={testIDs.inputs.message}
        style={styles.input}
        value={text}
        onChangeText={setText}
        placeholder="Message"
        editable={!disabled}
        multiline
      />
      <Pressable
        testID={testIDs.buttons.send}
        style={[styles.send, disabled && styles.sendDisabled]}
        onPress={handleSend}
        disabled={disabled}
      >
        <Text style={styles.sendLabel}>Send</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: theme.spacing.two,
    padding: theme.spacing.three,
    backgroundColor: theme.colors.background,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    paddingVertical: theme.spacing.two,
    paddingHorizontal: theme.spacing.three,
    borderRadius: theme.spacing.three,
    backgroundColor: theme.colors.backgroundElement,
    color: theme.colors.text,
    fontFamily: theme.fonts.sans,
  },
  send: {
    paddingVertical: theme.spacing.two,
    paddingHorizontal: theme.spacing.three,
    borderRadius: theme.spacing.three,
    backgroundColor: theme.colors.backgroundSelected,
  },
  sendDisabled: {
    opacity: 0.5,
  },
  sendLabel: {
    color: theme.colors.text,
    fontFamily: theme.fonts.rounded,
  },
}));

const testIDs = createComponentTestIDs("ChatInput", {
  containers: ["root"] as const,
  inputs: ["message"] as const,
  buttons: ["send"] as const,
});

ChatInput.testIDs = testIDs;
