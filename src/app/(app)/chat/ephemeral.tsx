import { router } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { useLlm, useStt } from "@/app/providers";
import type { Message } from "@/entities/message";
import { getInferenceSettings } from "@/features/configure-inference";
import { sendEphemeralMessage } from "@/features/send-message";
import {
  createVoiceInputController,
  type VoiceInputController,
} from "@/features/voice-input";
import { generateId } from "@/shared/lib";
import { ChatInput } from "@/widgets/ChatInput";
import { ChatThread } from "@/widgets/ChatThread";
import { VoiceRecordButton } from "@/widgets/VoiceRecordButton";

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
  const { ensureReady } = useStt();

  const [sessionId] = useState(() => generateId());
  const [messages, setMessages] = useState<Message[]>([]);
  const [streaming, setStreaming] = useState("");

  const [isRecording, setIsRecording] = useState(false);
  const voiceControllerRef = useRef<VoiceInputController | null>(null);
  const [voiceText, setVoiceText] = useState<string | null>(null);
  const [voiceInsertKey, setVoiceInsertKey] = useState(0);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const handleVoiceHoldStart = () => {
    setVoiceError(null);
    setIsRecording(true);
    voiceControllerRef.current = createVoiceInputController(ensureReady);
  };

  const handleVoiceHoldCommit = async () => {
    const controller = voiceControllerRef.current;
    voiceControllerRef.current = null;
    setIsRecording(false);
    if (!controller) return;

    try {
      const { text } = await controller.commit();
      if (text.trim()) {
        setVoiceText(text);
        setVoiceInsertKey((k) => k + 1);
      }
    } catch (e) {
      setVoiceError(
        e instanceof Error ? e.message : "Voice input failed to transcribe.",
      );
    }
  };

  const handleVoiceHoldCancel = async () => {
    const controller = voiceControllerRef.current;
    voiceControllerRef.current = null;
    setIsRecording(false);
    if (!controller) return;

    try {
      await controller.cancel();
    } catch {
      // The user explicitly discarded this recording.
    }
  };

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
      {voiceError && (
        <Pressable onPress={() => setVoiceError(null)}>
          <Text style={styles.error}>{voiceError} Tap to dismiss.</Text>
        </Pressable>
      )}
      {canChat ? (
        <View style={styles.inputRow}>
          <VoiceRecordButton
            isRecording={isRecording}
            onHoldStart={handleVoiceHoldStart}
            onHoldCommit={handleVoiceHoldCommit}
            onHoldCancel={handleVoiceHoldCancel}
          />
          <View style={styles.inputFlex}>
            <ChatInput
              key={voiceInsertKey}
              initialText={voiceText ?? ""}
              onSend={handleSend}
            />
          </View>
        </View>
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
  // ChatInput already applies its own `padding: theme.spacing.three` on all
  // sides — this row only adds space for VoiceRecordButton, which sits
  // outside that padded box, not a second layer of padding around it.
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingLeft: theme.spacing.three,
    backgroundColor: theme.colors.background,
  },
  inputFlex: {
    flex: 1,
  },
  error: {
    paddingHorizontal: theme.spacing.three,
    paddingTop: theme.spacing.two,
    color: theme.colors.danger,
    fontFamily: theme.fonts.sans,
    fontSize: 12,
  },
}));
