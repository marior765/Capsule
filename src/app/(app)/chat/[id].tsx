import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import * as Clipboard from "expo-clipboard";
import { useDb, useLlm, useStt } from "@/app/providers";
import { getConversationById } from "@/entities/conversation";
import { getChildren, getMessagePath, type Message } from "@/entities/message";
import {
  branchFromMessage,
  switchBranch,
} from "@/features/branch-conversation";
import { getInferenceSettings } from "@/features/configure-inference";
import { exportConversationAsMarkdown } from "@/features/export-chat";
import { sendMessage } from "@/features/send-message";
import {
  createVoiceInputController,
  type VoiceInputController,
} from "@/features/voice-input";
import { getAllSnippets, type Snippet } from "@/entities/snippet";
import { createComponentTestIDs } from "@/shared/testing";
import { ChatInput } from "@/widgets/ChatInput";
import { ChatThread, type BranchPosition } from "@/widgets/ChatThread";
import { InferenceStats } from "@/widgets/InferenceStats";
import { SnippetPicker } from "@/widgets/SnippetPicker";
import { VoiceRecordButton } from "@/widgets/VoiceRecordButton";

const STATUS_MESSAGE: Record<string, string> = {
  "no-model": "Download a model to start chatting.",
  "no-active-model": "You have a model — select it to start chatting.",
  loading: "Loading model…",
  error: "Failed to load the model.",
};

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useDb();
  const { ctx, status } = useLlm();
  const { ensureReady } = useStt();

  /**
   * Render the *active branch*, not every message in the conversation — an
   * edited conversation holds multiple branches in the tree, and the flat list
   * would interleave them into one nonsensical thread.
   */
  const readPath = useCallback((): Message[] => {
    if (!id) return [];
    const conversation = getConversationById(db, id);
    return conversation?.activeLeafId
      ? getMessagePath(db, conversation.activeLeafId)
      : [];
  }, [db, id]);

  const [messages, setMessages] = useState<Message[]>(readPath);
  const [streaming, setStreaming] = useState("");
  const [editing, setEditing] = useState<Message | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Recording state and the pending controller are separate: `isRecording`
  // is what VoiceRecordButton renders, `voiceControllerRef` is the in-flight
  // session it's driving. `createVoiceInputController` is what makes
  // `handleVoiceHoldStart` safe to be synchronous (see its own doc comment)
  // — this ref just holds what it returns, not any async work itself.
  //
  // `voiceError` is deliberately its OWN state, separate from `error`
  // (LLM generation failures): sharing one would mean starting to record
  // silently dismisses an unrelated, unread generation error, and vice
  // versa — two different failure modes with nothing to do with each other.
  const [isRecording, setIsRecording] = useState(false);
  const voiceControllerRef = useRef<VoiceInputController | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  // `draftInsertText`/`draftInsertKey`: the shared "replace whatever's
  // typed" mechanism ChatInput exposes via key-remount — originally built
  // for voice transcription, now also driving snippet insertion (8.2).
  // One shared pair, not two parallel ones: both are "wholesale-replace
  // the draft" in the exact same sense, and a single remount key avoids
  // two insertion sources racing to decide whose text wins on the same
  // render.
  const [draftInsertText, setDraftInsertText] = useState<string | null>(null);
  const [draftInsertKey, setDraftInsertKey] = useState(0);
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [showSnippetPicker, setShowSnippetPicker] = useState(false);

  const refresh = useCallback(() => setMessages(readPath()), [readPath]);

  // The only way `editing` ever changes to a non-null value — routes
  // through here rather than `setEditing` directly so stale draft-insert
  // text from an earlier, unrelated voice recording or snippet pick can
  // never resurface if the user starts, then cancels, an edit. The button
  // is also disabled while editing (below), so this is about the *next*
  // time it's used, not this one.
  const beginEditing = (message: Message) => {
    setDraftInsertText(null);
    setEditing(message);
  };

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
        // Remounts ChatInput with the transcribed text — the same
        // key-remount mechanism `editing` already uses below to re-seed it.
        // This replaces whatever was typed rather than appending to it;
        // ChatInput doesn't expose its live text to the parent, and this
        // matches how the edit flow already reseeds it wholesale.
        setDraftInsertText(text);
        setDraftInsertKey((k) => k + 1);
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
      // The user explicitly discarded this recording — a failure while
      // tearing it down isn't worth surfacing as an error.
    }
  };

  // Sibling counts for the messages on the visible path, so the thread can
  // offer `‹ 2/3 ›` wherever an edit created alternatives.
  const branches: Record<string, BranchPosition> = {};
  for (const message of messages) {
    const siblings = getChildren(db, message.parentId);
    if (siblings.length > 1) {
      branches[message.id] = {
        index: siblings.findIndex((s) => s.id === message.id) + 1,
        total: siblings.length,
      };
    }
  }

  const stream = (token: string, acc: { text: string }) => {
    acc.text += token;
    setStreaming(acc.text);
  };

  const handleSend = async (text: string) => {
    if (!ctx || !id) return;
    const target = editing;
    setEditing(null);
    setError(null);

    const acc = { text: "" };
    try {
      if (target) {
        await branchFromMessage(db, ctx, target.id, text, (t) =>
          stream(t, acc),
        );
      } else {
        await sendMessage(
          db,
          ctx,
          { conversationId: id, text },
          (t) => stream(t, acc),
          getInferenceSettings(),
        );
      }
    } catch (e) {
      // Without this the promise rejects into nothing and a failed generation
      // is indistinguishable from an empty reply.
      setError(e instanceof Error ? e.message : "Generation failed.");
    } finally {
      setStreaming("");
      refresh();
    }
  };

  const handleSwitchBranch = (message: Message, direction: -1 | 1) => {
    const siblings = getChildren(db, message.parentId);
    const currentIndex = siblings.findIndex((s) => s.id === message.id);
    const next = siblings[currentIndex + direction];
    if (!next || !id) return;

    // Follow the chosen sibling down to its deepest reply, then show it.
    let leafId = next.id;
    for (;;) {
      const children = getChildren(db, leafId);
      if (children.length === 0) break;
      leafId = children[children.length - 1].id;
    }

    switchBranch(db, id, leafId);
    refresh();
  };

  // Copies the visible branch as markdown — `expo-clipboard` is a local OS
  // API (same one `ChatBubble`'s code-block copy already uses), not a
  // network action. `getConversationById` here (rather than trusting some
  // already-loaded conversation object) means the exported title is always
  // whatever's actually saved right now, not a stale render's copy of it.
  const [exported, setExported] = useState(false);
  const handleExport = async () => {
    if (!id) return;
    const conversation = getConversationById(db, id);
    if (!conversation) return;
    try {
      const markdown = exportConversationAsMarkdown(conversation, messages);
      const ok = await Clipboard.setStringAsync(markdown);
      if (ok) {
        setExported(true);
        setTimeout(() => setExported(false), 1500);
      }
    } catch {
      // Clipboard access can fail for platform reasons outside this app's
      // control — the button simply doesn't confirm; nothing to crash on.
    }
  };

  const contextUsed = messages.reduce((sum, m) => sum + m.tokenCount, 0);
  const canChat = status === "ready" && ctx != null;

  return (
    <View style={styles.root}>
      <View style={styles.statsRow}>
        <InferenceStats contextUsed={contextUsed} />
        {messages.length > 0 && (
          <Pressable
            testID={testIDs.buttons.export}
            style={styles.exportButton}
            onPress={handleExport}
            accessibilityRole="button"
            accessibilityLabel={exported ? "Copied" : "Export"}
          >
            <Text style={styles.exportLabel} accessibilityLiveRegion="polite">
              {exported ? "Copied!" : "Export"}
            </Text>
          </Pressable>
        )}
      </View>
      <ChatThread
        messages={messages}
        streamingText={streaming}
        onEdit={canChat ? beginEditing : undefined}
        branches={branches}
        onSwitchBranch={handleSwitchBranch}
      />
      {editing && (
        <Pressable
          onPress={() => setEditing(null)}
          accessibilityRole="button"
          accessibilityLabel="Cancel editing"
        >
          <Text style={styles.editing} accessibilityLiveRegion="polite">
            Editing — sending forks a new branch. Tap to cancel.
          </Text>
        </Pressable>
      )}
      {error && (
        <Pressable
          onPress={() => setError(null)}
          accessibilityRole="button"
          accessibilityLabel={`${error}. Dismiss`}
        >
          <Text style={styles.error} accessibilityLiveRegion="polite">
            {error} Tap to dismiss.
          </Text>
        </Pressable>
      )}
      {voiceError && (
        <Pressable
          onPress={() => setVoiceError(null)}
          accessibilityRole="button"
          accessibilityLabel={`${voiceError}. Dismiss`}
        >
          <Text style={styles.error} accessibilityLiveRegion="polite">
            {voiceError} Tap to dismiss.
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
              // Voice input while editing is deliberately not supported —
              // `initialText` below always shows `editing.content` while
              // editing is active, so a transcription captured mid-edit would
              // be silently discarded on the very next render. Disabling the
              // button avoids that trap rather than papering over it.
              disabled={!!editing}
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
                key={`${editing?.id ?? "new"}-${draftInsertKey}`}
                initialText={editing?.content ?? draftInsertText ?? ""}
                sendLabel={editing ? "Resend" : "Send"}
                onSend={handleSend}
              />
            </View>
          </View>
        </>
      ) : status === "loading" ? (
        <Text style={styles.status}>{STATUS_MESSAGE.loading}</Text>
      ) : (
        <Pressable
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
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  exportButton: {
    paddingHorizontal: theme.spacing.three,
    paddingVertical: theme.spacing.one,
  },
  exportLabel: {
    color: theme.colors.accent,
    fontFamily: theme.fonts.sans,
    fontSize: 12,
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
  status: {
    padding: theme.spacing.three,
    textAlign: "center",
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.sans,
  },
  editing: {
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

const testIDs = createComponentTestIDs("ChatScreen", {
  buttons: ["snippets", "export"] as const,
});
