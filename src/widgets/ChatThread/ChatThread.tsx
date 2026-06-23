import { FlatList, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import type { Message } from "@/entities/message";
import { ChatBubble } from "@/widgets/ChatBubble";
import { createComponentTestIDs } from "@/shared/testing";

type ChatThreadProps = {
  messages: Message[];
  streamingText?: string;
};

export function ChatThread({ messages, streamingText }: ChatThreadProps) {
  const streamingMessage: Message | null = streamingText
    ? {
        id: "__streaming__",
        conversationId: messages[0]?.conversationId ?? "",
        role: "assistant",
        content: streamingText,
        tokenCount: 0,
        createdAt: Number.MAX_SAFE_INTEGER,
      }
    : null;

  const data = streamingMessage ? [...messages, streamingMessage] : messages;

  return (
    <View testID={testIDs.containers.root} style={styles.root}>
      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ChatBubble message={item} />}
        contentContainerStyle={styles.content}
      />
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    padding: theme.spacing.three,
  },
}));

const testIDs = createComponentTestIDs("ChatThread", {
  containers: ["root"] as const,
});

ChatThread.testIDs = testIDs;
