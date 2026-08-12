import { Pressable, Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import type { Message } from "@/entities/message";
import { createComponentTestIDs } from "@/shared/testing";

type ChatBubbleProps = {
  message: Message;
  /** Only offered on user messages — editing forks a new branch. */
  onEdit?: (message: Message) => void;
};

export function ChatBubble({ message, onEdit }: ChatBubbleProps) {
  const isUser = message.role === "user";
  const canEdit = isUser && onEdit != null;

  return (
    <View
      testID={`${testIDs.containers.root}_${message.id}`}
      style={[styles.bubble, isUser ? styles.user : styles.assistant]}
    >
      <Text testID={testIDs.texts.content} style={styles.content}>
        {message.content}
      </Text>
      {canEdit && (
        <Pressable
          testID={`${testIDs.buttons.edit}_${message.id}`}
          onPress={() => onEdit(message)}
        >
          <Text style={styles.edit}>Edit</Text>
        </Pressable>
      )}
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
  edit: {
    marginTop: theme.spacing.one,
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.rounded,
    fontSize: 12,
  },
}));

const testIDs = createComponentTestIDs("ChatBubble", {
  containers: ["root"] as const,
  texts: ["content"] as const,
  buttons: ["edit"] as const,
});

ChatBubble.testIDs = testIDs;
