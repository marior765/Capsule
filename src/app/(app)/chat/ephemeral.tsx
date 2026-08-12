import { router } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { useLlm } from "@/app/providers";
import type { Message } from "@/entities/message";
import { getInferenceSettings } from "@/features/configure-inference";
import { sendEphemeralMessage } from "@/features/send-message";
import { generateId } from "@/shared/lib";
import { ChatInput } from "@/widgets/ChatInput";
import { ChatThread } from "@/widgets/ChatThread";

const STATUS_MESSAGE: Record<string, string> = {
  "no-model": "Download a model to start chatting.",
  "no-active-model": "You have a model — select it to start chatting.",
  loading: "Loading model…",
  error: "Failed to load the model.",
};

/**
 * A session-only chat. Everything lives in component state and is discarded
 * when the screen unmounts — this route never touches the database, and
 * `sendEphemeralMessage` has no handle to do so even if it wanted to.
 */
export default function EphemeralChatScreen() {
  const { ctx, status } = useLlm();

  const [sessionId] = useState(() => generateId());
  const [messages, setMessages] = useState<Message[]>([]);
  const [streaming, setStreaming] = useState("");

  const handleSend = useCallback(
    async (text: string) => {
      if (!ctx) return;

      let acc = "";
      try {
        const { userMessage, assistantMessage } = await sendEphemeralMessage(
          ctx,
          { conversationId: sessionId, history: messages, text },
          (token) => {
            acc += token;
            setStreaming(acc);
          },
          getInferenceSettings(),
        );
        setMessages((prev) => [...prev, userMessage, assistantMessage]);
      } finally {
        setStreaming("");
      }
    },
    [ctx, messages, sessionId],
  );

  const canChat = status === "ready" && ctx != null;

  return (
    <View style={styles.root}>
      <Text style={styles.banner}>
        Ephemeral chat — nothing here is saved to disk.
      </Text>
      <ChatThread messages={messages} streamingText={streaming} />
      {canChat ? (
        <ChatInput onSend={handleSend} />
      ) : status === "loading" ? (
        <Text style={styles.status}>{STATUS_MESSAGE.loading}</Text>
      ) : (
        <Pressable onPress={() => router.push("/models")}>
          <Text style={styles.status}>
            {STATUS_MESSAGE[status]} Tap to manage models.
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  banner: {
    padding: theme.spacing.two,
    textAlign: "center",
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.rounded,
    fontSize: 12,
    backgroundColor: theme.colors.backgroundElement,
  },
  status: {
    padding: theme.spacing.three,
    textAlign: "center",
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.sans,
  },
}));
