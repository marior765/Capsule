import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import * as Clipboard from "expo-clipboard";
import { useDb, useEmbeddings, useLlm, useStt } from "@/app/providers";
import { prepareGrounding } from "@/features/capsule-rag";
import { getEmbeddingModelUri } from "@/features/manage-embedding-model";
import { getBoolean, setBoolean } from "@/shared/storage";
import { getConversationById } from "@/entities/conversation";
import {
  getChildren,
  getImageByMessage,
  getMessagePath,
  getSourcesByMessage,
  type Message,
} from "@/entities/message";
import { getCapsuleById } from "@/entities/capsule";
import { deleteCacheFileIfExists, resolveAppPath } from "@/shared/fs";
import { pickImage, type PickedSource } from "@/shared/picker";
import {
  branchFromMessage,
  switchBranch,
} from "@/features/branch-conversation";
import { getInferenceSettings } from "@/features/configure-inference";
import { exportConversationAsMarkdown } from "@/features/export-chat";
import { sendMessage, type Grounding } from "@/features/send-message";
import {
  createVoiceInputController,
  describeVoiceError,
  VOICE_EMPTY_HINT,
  VOICE_HOLD_HINT,
  type VoiceInputController,
} from "@/features/voice-input";
import { getAllSnippets, type Snippet } from "@/entities/snippet";
import { createComponentTestIDs } from "@/shared/testing";
import { ChatInput } from "@/widgets/ChatInput";
import { ChatThread, type BranchPosition } from "@/widgets/ChatThread";
import { InferenceStats } from "@/widgets/InferenceStats";
import { SnippetPicker } from "@/widgets/SnippetPicker";
import { VoiceRecordButton } from "@/widgets/VoiceRecordButton";
import { toSourceChips, type SourceChip } from "@/widgets/MessageSources";

/** How long a message waits for capsule search before going out ungrounded. */
const CAPSULE_SEARCH_TIMEOUT_MS = 4000;

const STATUS_MESSAGE: Record<string, string> = {
  "no-model": "Download a model to start chatting.",
  "no-active-model": "You have a model — select it to start chatting.",
  loading: "Loading model…",
  error: "Failed to load the model.",
};

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useDb();
  const { ctx, status, vision } = useLlm();
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
  // Image picked for the next message (8.4) — a picker's temporary cache
  // copy until it's sent (then copied into app storage) or removed.
  const [pendingImage, setPendingImage] = useState<PickedSource | null>(null);
  // True for the whole send (capsule search + generation): the image
  // controls are locked so the image being sent can't be removed/replaced.
  const [sending, setSending] = useState(false);

  const discardPendingImage = (image: PickedSource | null) => {
    if (!image) return;
    try {
      deleteCacheFileIfExists(image.uri);
    } catch {
      // best effort — the OS clears its cache; the wipe clears picker folders
    }
  };

  const handleAttachImage = async () => {
    try {
      const picked = await pickImage();
      if (picked === null) return;
      discardPendingImage(pendingImage);
      setPendingImage(picked);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Couldn't open the photo library.",
      );
    }
  };

  const handleRemovePendingImage = () => {
    discardPendingImage(pendingImage);
    setPendingImage(null);
  };
  const [error, setError] = useState<string | null>(null);

  // "My capsules" (7.3): ground replies in the user's own capsules. Remembered
  // per conversation in local settings (the full wipe clears it).
  const embeddings = useEmbeddings();
  const useCapsulesKey = `chat.useCapsules.${id}`;
  const [useCapsules, setUseCapsules] = useState(
    () => getBoolean(useCapsulesKey) ?? false,
  );
  const [searchingCapsules, setSearchingCapsules] = useState(false);
  const [groundingNotice, setGroundingNotice] = useState<string | null>(null);

  const toggleUseCapsules = () => {
    const next = !useCapsules;
    setUseCapsules(next);
    setBoolean(useCapsulesKey, next);
    setGroundingNotice(
      next && !getEmbeddingModelUri()
        ? "Capsule search needs its model — download it in Models → Capsule search."
        : null,
    );
  };

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
  // `kind` decides the styling only: a failure reads as an error, the
  // "hold the mic" hint after a tap reads as a neutral notice.
  const [voiceError, setVoiceError] = useState<{
    text: string;
    kind: "error" | "hint";
  } | null>(null);

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

  // Re-read on every return to this screen: the chat tab stays mounted while
  // the user is elsewhere (e.g. after tapping a capsule chip), so anything
  // changed meanwhile — a capsule renamed or deleted, a message elsewhere —
  // must be picked up here, not on some later unrelated re-render.
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

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

  // Attached images for the visible messages (8.4), resolved against the
  // current document directory.
  const images = useMemo(() => {
    const byMessage: Record<string, string> = {};
    for (const message of messages) {
      const image = getImageByMessage(db, message.id);
      if (image) byMessage[message.id] = resolveAppPath(image.path);
    }
    return byMessage;
  }, [db, messages]);

  // Which capsules grounded each visible answer (7.4). Recomputed when the
  // message list changes — including on every return to this screen (see
  // the focus effect), so a capsule renamed or deleted meanwhile shows its
  // current state — but not on every streaming token.
  const sources = useMemo(() => {
    const byMessage: Record<string, SourceChip[]> = {};
    for (const message of messages) {
      if (message.role !== "assistant") continue;
      const stored = getSourcesByMessage(db, message.id);
      if (stored.length > 0) {
        byMessage[message.id] = toSourceChips(
          stored,
          (capsuleId) => getCapsuleById(db, capsuleId)?.title ?? null,
        );
      }
    }
    return byMessage;
  }, [db, messages]);

  const stream = (token: string, acc: { text: string }) => {
    acc.text += token;
    setStreaming(acc.text);
  };

  // One send at a time (8.12): a second tap during the capsule search or
  // while a reply streams must not start another completion on the same
  // model. A ref, so it holds before the "sending" re-render lands.
  const sendInFlight = useRef(false);

  const handleSend = async (text: string) => {
    if (!ctx || !id || sendInFlight.current) return;
    sendInFlight.current = true;
    const target = editing;
    setEditing(null);
    setError(null);
    // Claim the pending image BEFORE any await (capsule search can take
    // seconds), so nothing the user does meanwhile can delete or swap the
    // file being sent. An edit doesn't take a new image — it stays pending.
    const image = target ? null : pendingImage;
    if (image) setPendingImage(null);
    setSending(true);

    const acc = { text: "" };
    try {
      let grounding: Grounding | undefined;
      if (useCapsules) {
        setSearchingCapsules(true);
        try {
          const prepared = await prepareGrounding({
            hasModel: getEmbeddingModelUri() !== undefined,
            retrieve: embeddings.retrieveContext,
            query: text,
            timeoutMs: CAPSULE_SEARCH_TIMEOUT_MS,
          });
          grounding =
            prepared.groundingPrompt !== undefined
              ? { prompt: prepared.groundingPrompt, sources: prepared.sources }
              : undefined;
          setGroundingNotice(prepared.notice);
        } finally {
          setSearchingCapsules(false);
        }
      } else {
        setGroundingNotice(null);
      }

      if (target) {
        await branchFromMessage(
          db,
          ctx,
          target.id,
          text,
          (t) => stream(t, acc),
          getInferenceSettings(),
          grounding,
          { withImages: vision },
        );
      } else {
        // Handed over to sendMessage, which copies it into app storage and
        // removes the picker's temp copy whether or not the send succeeds.
        await sendMessage(
          db,
          ctx,
          {
            conversationId: id,
            text,
            grounding,
            withImages: vision,
            image: image
              ? {
                  sourceUri: image.uri,
                  name: image.name,
                  sourceIsTemporaryCopy: true,
                }
              : undefined,
          },
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
      setSending(false);
      sendInFlight.current = false;
      refresh();
    }
  };

  const handleSwitchBranch = (message: Message, direction: -1 | 1) => {
    const siblings = getChildren(db, message.parentId);
    const currentIndex = siblings.findIndex((s) => s.id === message.id);
    const next = siblings[currentIndex + direction];
    if (!next || !id) return;

    // Follow the chosen sibling down to its deepest reply, then show it.
    // The visited set stops the walk if stored data ever contains a parent
    // cycle (importers now refuse to write one, but older data might).
    let leafId = next.id;
    const visited = new Set<string>([leafId]);
    for (;;) {
      const children = getChildren(db, leafId);
      if (children.length === 0) break;
      const child = children[children.length - 1].id;
      if (visited.has(child)) break;
      visited.add(child);
      leafId = child;
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
        sources={sources}
        images={images}
        onOpenSource={(capsuleId) => router.push(`/capsules/${capsuleId}`)}
      />
      {editing && (
        <Pressable
          testID={testIDs.buttons.cancelEdit}
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
          testID={testIDs.buttons.dismissError}
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
      {canChat && (searchingCapsules || groundingNotice !== null) && (
        <Text
          testID={testIDs.texts.capsuleNotice}
          style={styles.capsuleNotice}
          accessibilityLiveRegion="polite"
        >
          {searchingCapsules ? "Searching your capsules…" : groundingNotice}
        </Text>
      )}
      {canChat && pendingImage && !editing && (
        <View
          testID={testIDs.containers.pendingImage}
          style={styles.pendingImage}
        >
          <Text style={styles.pendingImageLabel} numberOfLines={1}>
            Image: {pendingImage.name}
          </Text>
          <Pressable
            testID={testIDs.buttons.removeImage}
            onPress={handleRemovePendingImage}
            disabled={sending}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={`Remove image ${pendingImage.name}`}
            accessibilityState={{ disabled: sending }}
          >
            <Text style={styles.snippetsLabel}>✕</Text>
          </Pressable>
        </View>
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
            <Pressable
              testID={testIDs.buttons.capsules}
              style={styles.snippetsButton}
              onPress={toggleUseCapsules}
              accessibilityRole="switch"
              accessibilityLabel="Use my capsules"
              accessibilityState={{ checked: useCapsules }}
            >
              <Text
                style={[
                  styles.snippetsLabel,
                  !useCapsules && styles.capsulesOff,
                ]}
              >
                {useCapsules ? "Capsules: on" : "Capsules: off"}
              </Text>
            </Pressable>
            {vision && !editing && (
              <Pressable
                testID={testIDs.buttons.image}
                style={styles.snippetsButton}
                onPress={handleAttachImage}
                disabled={sending}
                accessibilityRole="button"
                accessibilityLabel="Attach image"
                accessibilityState={{ disabled: sending }}
              >
                <Text style={styles.snippetsLabel}>Image</Text>
              </Pressable>
            )}
            <View style={styles.inputFlex}>
              <ChatInput
                key={`${editing?.id ?? "new"}-${draftInsertKey}`}
                initialText={editing?.content ?? draftInsertText ?? ""}
                sendLabel={editing ? "Resend" : "Send"}
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
  capsuleNotice: {
    paddingHorizontal: theme.spacing.three,
    paddingTop: theme.spacing.two,
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.sans,
    fontSize: 12,
  },
  pendingImage: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.two,
    paddingHorizontal: theme.spacing.three,
    paddingTop: theme.spacing.two,
  },
  pendingImageLabel: {
    flex: 1,
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.sans,
    fontSize: 12,
  },
  capsulesOff: {
    color: theme.colors.textSecondary,
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

const testIDs = createComponentTestIDs("ChatScreen", {
  buttons: [
    "snippets",
    "export",
    "capsules",
    "image",
    "removeImage",
    "cancelEdit",
    "dismissError",
    "dismissVoiceError",
    "manageModels",
  ] as const,
  texts: ["capsuleNotice"] as const,
  containers: ["pendingImage"] as const,
});

ChatScreen.testIDs = testIDs;
