import { FlatList, Pressable, Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import type { Message } from "@/entities/message";
import { ChatBubble } from "@/widgets/ChatBubble";
import { createComponentTestIDs } from "@/shared/testing";

/** Position of a message among its siblings, e.g. `‹ 2/3 ›`. */
export type BranchPosition = { index: number; total: number };

type ChatThreadProps = {
  messages: Message[];
  streamingText?: string;
  onEdit?: (message: Message) => void;
  /** Keyed by message id. Only entries with `total > 1` render navigation. */
  branches?: Record<string, BranchPosition>;
  onSwitchBranch?: (message: Message, direction: -1 | 1) => void;
};

export function ChatThread({
  messages,
  streamingText,
  onEdit,
  branches,
  onSwitchBranch,
}: ChatThreadProps) {
  const streamingMessage: Message | null = streamingText
    ? {
        id: "__streaming__",
        conversationId: messages[0]?.conversationId ?? "",
        parentId: messages[messages.length - 1]?.id ?? null,
        role: "assistant",
        content: streamingText,
        tokenCount: 0,
        createdAt: Number.MAX_SAFE_INTEGER,
      }
    : null;

  const data = streamingMessage ? [...messages, streamingMessage] : messages;

  const renderItem = ({ item }: { item: Message }) => {
    const branch = branches?.[item.id];
    const hasSiblings = branch != null && branch.total > 1;

    return (
      <View>
        <ChatBubble message={item} onEdit={onEdit} />
        {hasSiblings && (
          <View testID={testIDs.containers.branchNav} style={styles.branchNav}>
            <Pressable
              testID={`${testIDs.buttons.prevBranch}_${item.id}`}
              onPress={() => onSwitchBranch?.(item, -1)}
              disabled={branch.index === 1}
            >
              <Text
                style={[styles.arrow, branch.index === 1 && styles.arrowMuted]}
              >
                ‹
              </Text>
            </Pressable>
            <Text testID={testIDs.texts.branchCount} style={styles.branchCount}>
              {branch.index}/{branch.total}
            </Text>
            <Pressable
              testID={`${testIDs.buttons.nextBranch}_${item.id}`}
              onPress={() => onSwitchBranch?.(item, 1)}
              disabled={branch.index === branch.total}
            >
              <Text
                style={[
                  styles.arrow,
                  branch.index === branch.total && styles.arrowMuted,
                ]}
              >
                ›
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    );
  };

  return (
    <View testID={testIDs.containers.root} style={styles.root}>
      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
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
  branchNav: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-end",
    gap: theme.spacing.two,
    marginBottom: theme.spacing.one,
  },
  arrow: {
    color: theme.colors.text,
    fontFamily: theme.fonts.rounded,
    paddingHorizontal: theme.spacing.one,
  },
  arrowMuted: {
    color: theme.colors.textSecondary,
    opacity: 0.4,
  },
  branchCount: {
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.sans,
    fontSize: 12,
  },
}));

const testIDs = createComponentTestIDs("ChatThread", {
  containers: ["root", "branchNav"] as const,
  buttons: ["prevBranch", "nextBranch"] as const,
  texts: ["branchCount"] as const,
});

ChatThread.testIDs = testIDs;
