import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { useDb, useLlm } from "@/app/providers";
import { getConversationById } from "@/entities/conversation";
import { getChildren, getMessagePath, type Message } from "@/entities/message";
import {
  branchFromMessage,
  switchBranch,
} from "@/features/branch-conversation";
import { getInferenceSettings } from "@/features/configure-inference";
import { sendMessage } from "@/features/send-message";
import { ChatInput } from "@/widgets/ChatInput";
import { ChatThread, type BranchPosition } from "@/widgets/ChatThread";
import { InferenceStats } from "@/widgets/InferenceStats";

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

  const refresh = useCallback(() => setMessages(readPath()), [readPath]);

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

  const contextUsed = messages.reduce((sum, m) => sum + m.tokenCount, 0);
  const canChat = status === "ready" && ctx != null;

  return (
    <View style={styles.root}>
      <InferenceStats contextUsed={contextUsed} />
      <ChatThread
        messages={messages}
        streamingText={streaming}
        onEdit={canChat ? setEditing : undefined}
        branches={branches}
        onSwitchBranch={handleSwitchBranch}
      />
      {editing && (
        <Pressable onPress={() => setEditing(null)}>
          <Text style={styles.editing}>
            Editing — sending forks a new branch. Tap to cancel.
          </Text>
        </Pressable>
      )}
      {error && (
        <Pressable onPress={() => setError(null)}>
          <Text style={styles.error}>{error} Tap to dismiss.</Text>
        </Pressable>
      )}
      {canChat ? (
        <ChatInput
          key={editing?.id ?? "new"}
          initialText={editing?.content ?? ""}
          sendLabel={editing ? "Resend" : "Send"}
          onSend={handleSend}
        />
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
