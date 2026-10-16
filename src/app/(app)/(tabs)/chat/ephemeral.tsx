import { router } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { useDb, useLlm, useStt } from "@/app/providers";
import type { Message } from "@/entities/message";
import { getInferenceSettings } from "@/features/configure-inference";
import { sendEphemeralMessage } from "@/features/send-message";
import {
  createVoiceInputController,
  describeVoiceError,
  VOICE_EMPTY_HINT,
  VOICE_HOLD_HINT,
  type VoiceInputController,
} from "@/features/voice-input";
import { getAllSnippets, type Snippet } from "@/entities/snippet";
import { generateId } from "@/shared/lib";
import { createComponentTestIDs } from "@/shared/testing";
import { ChatInput } from "@/widgets/ChatInput";
import { ChatThread } from "@/widgets/ChatThread";
import { SnippetPicker } from "@/widgets/SnippetPicker";
import { VoiceRecordButton } from "@/widgets/VoiceRecordButton";

const STATUS_MESSAGE: Record<string, string> = {
  "no-model": "Download a model to start chatting.",
  "no-active-model": "You have a model — select it to start chatting.",
  loading: "Loading model…",
  error: "Failed to load the model.",
};

/**
 * A session-only chat. Messages/streaming live in component state and are
 * discarded when the screen unmounts — `sendEphemeralMessage` has no db
 * handle and never persists a message or conversation. The one exception
 * is reading (never writing) `entities/snippet` for the snippet picker —
 * snippets are a user-level library, not conversation state, so "nothing
 * here is saved to disk" (the banner below) still holds for chat content;
 * only an existing, already-saved snippet gets read, never created here.
 */
export default function EphemeralChatScreen() {
  const db = useDb();
  const { ctx, status } = useLlm();
  const { ensureReady } = useStt();

  const [sessionId] = useState(() => generateId());
  const [messages, setMessages] = useState<Message[]>([]);
  const [streaming, setStreaming] = useState("");

  const [isRecording, setIsRecording] = useState(false);
  const voiceControllerRef = useRef<VoiceInputController | null>(null);
  // `kind` decides the styling only: a failure reads as an error, the
  // "hold the mic" hint after a tap reads as a neutral notice.
  const [voiceError, setVoiceError] = useState<{
    text: string;
    kind: "error" | "hint";
  } | null>(null);

  // `draftInsertText`/`draftInsertKey`: the shared "replace whatever's
  // typed" mechanism ChatInput exposes via key-remount — originally built
  // for voice transcription, now also driving snippet insertion (8.2). One
  // shared pair, not two parallel ones — see chat/[id].tsx's identical note.
  const [draftInsertText, setDraftInsertText] = useState<string | null>(null);
  const [draftInsertKey, setDraftInsertKey] = useState(0);
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [showSnippetPicker, setShowSnippetPicker] = useState(false);

  const handleOpenSnippetPicker = () => {
    setSnippets(getAllSnippets(db));
    setShowSnippetPicker(true);
  };

  const handleInsertSnippet = (snippet: Snippet) => {
    setDraftInsertText(snippet.content);
    setDraftInsertKey((k) => k + 1);
    setShowSnippetPicker(false);
  };

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
        setDraftInsertText(text);
        setDraftInsertKey((k) => k + 1);
      } else {
        setVoiceError({ text: VOICE_EMPTY_HINT, kind: "hint" });
      }
    } catch (e) {
      setVoiceError({ text: describeVoiceError(e), kind: "error" });
    }
  };

  const handleVoiceHoldCancel = async () => {
    const controller = voiceControllerRef.current;
    voiceControllerRef.current = null;
    setIsRecording(false);
    // An early release is almost always a tap — say how the button works.
    // (It also fires if the button turns disabled mid-hold; the hint is
    // harmless there.)
    setVoiceError({ text: VOICE_HOLD_HINT, kind: "hint" });
    if (!controller) return;

    try {
      await controller.cancel();
    } catch {
      // The user explicitly discarded this recording.
    }
  };

  // One send at a time (8.12) — see the persisted chat screen.
  const [sending, setSending] = useState(false);
  const sendInFlight = useRef(false);

  const handleSend = useCallback(
    async (text: string) => {
      if (!ctx || sendInFlight.current) return;
      sendInFlight.current = true;
      setSending(true);

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
        setSending(false);
        sendInFlight.current = false;
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
        <Pressable
          testID={testIDs.buttons.dismissVoiceError}
          onPress={() => setVoiceError(null)}
          accessibilityRole="button"
          accessibilityLabel={`${voiceError.text}. Dismiss`}
        >
          <Text
            style={
              voiceError.kind === "error" ? styles.error : styles.voiceHint
            }
            accessibilityLiveRegion="polite"
          >
            {voiceError.text} Tap to dismiss.
          </Text>
        </Pressable>
      )}
      {canChat ? (
        <>
          {showSnippetPicker && (
            <SnippetPicker snippets={snippets} onSelect={handleInsertSnippet} />
          )}
          <View style={styles.inputRow}>
            <VoiceRecordButton
              isRecording={isRecording}
              onHoldStart={handleVoiceHoldStart}
              onHoldCommit={handleVoiceHoldCommit}
              onHoldCancel={handleVoiceHoldCancel}
            />
            <Pressable
              testID={testIDs.buttons.snippets}
              style={styles.snippetsButton}
              onPress={() =>
                showSnippetPicker
                  ? setShowSnippetPicker(false)
                  : handleOpenSnippetPicker()
              }
              accessibilityRole="button"
              accessibilityState={{ expanded: showSnippetPicker }}
            >
              <Text style={styles.snippetsLabel}>
                {showSnippetPicker ? "Close" : "Snippets"}
              </Text>
            </Pressable>
            <View style={styles.inputFlex}>
              <ChatInput
                key={draftInsertKey}
                initialText={draftInsertText ?? ""}
                onSend={(text) => void handleSend(text)}
                disabled={sending}
              />
            </View>
          </View>
        </>
      ) : status === "loading" ? (
        <Text style={styles.status}>{STATUS_MESSAGE.loading}</Text>
      ) : (
        <Pressable
          testID={testIDs.buttons.manageModels}
          onPress={() => router.push("/models")}
          accessibilityRole="button"
          accessibilityLabel={`${STATUS_MESSAGE[status]}. Manage models`}
        >
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
  snippetsButton: {
    paddingHorizontal: theme.spacing.two,
    paddingVertical: theme.spacing.three,
  },
  snippetsLabel: {
    color: theme.colors.accent,
    fontFamily: theme.fonts.sans,
    fontSize: 12,
  },
  voiceHint: {
    paddingHorizontal: theme.spacing.three,
    paddingTop: theme.spacing.two,
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.sans,
    fontSize: 12,
  },
  error: {
    paddingHorizontal: theme.spacing.three,
    paddingTop: theme.spacing.two,
    color: theme.colors.danger,
    fontFamily: theme.fonts.sans,
    fontSize: 12,
  },
}));

const testIDs = createComponentTestIDs("EphemeralChatScreen", {
  buttons: ["snippets", "dismissVoiceError", "manageModels"] as const,
});

EphemeralChatScreen.testIDs = testIDs;
