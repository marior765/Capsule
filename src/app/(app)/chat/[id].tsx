import { useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { useDb, useLlm } from "@/app/providers";
import { getMessagesByConversation, type Message } from "@/entities/message";
import { sendMessage } from "@/features/send-message";
import { ChatInput } from "@/widgets/ChatInput";
import { ChatThread } from "@/widgets/ChatThread";
import { InferenceStats } from "@/widgets/InferenceStats";

const STATUS_MESSAGE: Record<string, string> = {
  "no-model": "Download a model to start chatting.",
  loading: "Loading model…",
  error: "Failed to load the model.",
};

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useDb();
  const { ctx, status } = useLlm();

  const [messages, setMessages] = useState<Message[]>(() =>
    id ? getMessagesByConversation(db, id) : []
  );
  const [streaming, setStreaming] = useState("");

  const refresh = useCallback(() => {
    if (id) setMessages(getMessagesByConversation(db, id));
  }, [db, id]);

  const handleSend = async (text: string) => {
    if (!ctx || !id) return;

    const optimisticUser: Message = {
      id: `tmp-${Date.now()}`,
      conversationId: id,
      role: "user",
      content: text,
      tokenCount: 0,
      createdAt: Date.now(),
    };
    setMessages((prev) => [...prev, optimisticUser]);

    let acc = "";
    try {
      await sendMessage(db, ctx, { conversationId: id, text }, (token) => {
        acc += token;
        setStreaming(acc);
      });
    } finally {
      setStreaming("");
      refresh();
    }
  };

  const contextUsed = messages.reduce((sum, m) => sum + m.tokenCount, 0);
  const canChat = status === "ready" && ctx != null;

  return (
    <View style={styles.root}>
      <InferenceStats contextUsed={contextUsed} />
      <ChatThread messages={messages} streamingText={streaming} />
      {canChat ? (
        <ChatInput onSend={handleSend} />
      ) : (
        <Text style={styles.status}>{STATUS_MESSAGE[status]}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  status: {
    padding: theme.spacing.three,
    textAlign: "center",
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.sans,
  },
}));
