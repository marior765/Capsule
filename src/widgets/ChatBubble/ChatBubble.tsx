import { Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import type { Message } from "@/entities/message";
import { createComponentTestIDs } from "@/shared/testing";

type ChatBubbleProps = {
  message: Message;
};

export function ChatBubble({ message }: ChatBubbleProps) {
  const isUser = message.role === "user";
  return (
    <View
      testID={`${testIDs.containers.root}_${message.id}`}
      style={[styles.bubble, isUser ? styles.user : styles.assistant]}
    >
      <Text testID={testIDs.texts.content} style={styles.content}>
        {message.content}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  bubble: {
    maxWidth: "85%",
    paddingVertical: theme.spacing.two,
    paddingHorizontal: theme.spacing.three,
    borderRadius: theme.spacing.three,
    marginVertical: theme.spacing.one,
  },
  user: {
    alignSelf: "flex-end",
    backgroundColor: theme.colors.backgroundSelected,
  },
  assistant: {
    alignSelf: "flex-start",
    backgroundColor: theme.colors.backgroundElement,
  },
  content: {
    color: theme.colors.text,
    fontFamily: theme.fonts.sans,
  },
}));

const testIDs = createComponentTestIDs("ChatBubble", {
  containers: ["root"] as const,
  texts: ["content"] as const,
});

ChatBubble.testIDs = testIDs;
