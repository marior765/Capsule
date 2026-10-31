import { useRef } from "react";
import {
  FlatList,
  Pressable,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { StyleSheet } from "react-native-unistyles";
import type { Message } from "@/entities/message";
import { ChatBubble } from "@/widgets/ChatBubble";
import { MessageSources, type SourceChip } from "@/widgets/MessageSources";
import { createComponentTestIDs } from "@/shared/testing";
import {
  INITIAL_FOLLOW_STATE,
  isNearBottom,
  nextFollowState,
  type FollowEvent,
} from "./followBottom";

/** Position of a message among its siblings, e.g. `‹ 2/3 ›`. */
export type BranchPosition = { index: number; total: number };

type ChatThreadProps = {
  messages: Message[];
  streamingText?: string;
  onEdit?: (message: Message) => void;
  /** Keyed by message id. Only entries with `total > 1` render navigation. */
  branches?: Record<string, BranchPosition>;
  onSwitchBranch?: (message: Message, direction: -1 | 1) => void;
  /** Capsules that grounded each answer (7.4), keyed by message id. */
  sources?: Record<string, SourceChip[]>;
  onOpenSource?: (capsuleId: string) => void;
  /** Current `file://` URI of each message's attached image (8.4), keyed by message id. */
  images?: Record<string, string>;
  /** Long-press on a message bubble (10.17). */
  onLongPressMessage?: (message: Message) => void;
};

export function ChatThread({
  messages,
  streamingText,
  onEdit,
  branches,
  onSwitchBranch,
  sources,
  onOpenSource,
  images,
  onLongPressMessage,
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

  // Open at the newest message and follow new content (streamed tokens, new
  // replies) — but only while the reader is at the bottom. Scrolling up to
  // reread stops following until they scroll back down. Only the reader's
  // own scrolling changes this (see nextFollowState): React Native also
  // fires scroll/momentum events for the app's programmatic scrolls.
  const listRef = useRef<FlatList<Message>>(null);
  const follow = useRef(INITIAL_FOLLOW_STATE);
  const hasScrolledInitially = useRef(false);

  // Deferred a frame: a scrollToEnd issued synchronously from the first
  // onContentSizeChange is dropped — the list's viewport isn't laid out yet.
  const scrollToNewest = () => {
    if (!follow.current.following) return;
    const animated = hasScrolledInitially.current;
    requestAnimationFrame(() => {
      // Checked again: the reader may have grabbed the list since this frame
      // was queued, and a late scrollToEnd would pull them back down.
      if (!follow.current.following) return;
      listRef.current?.scrollToEnd({ animated });
    });
    hasScrolledInitially.current = true;
  };

  const onFollowEvent = (event: FollowEvent) => {
    follow.current = nextFollowState(follow.current, event);
  };
  const nearBottom = (event: NativeSyntheticEvent<NativeScrollEvent>) =>
    isNearBottom(event.nativeEvent);

  const renderItem = ({ item }: { item: Message }) => {
    const branch = branches?.[item.id];
    const hasSiblings = branch != null && branch.total > 1;

    return (
      <View>
        <ChatBubble
          message={item}
          onEdit={onEdit}
          imageUri={images?.[item.id]}
          onLongPress={
            item.role === "assistant" && item.id !== "__streaming__"
              ? onLongPressMessage
              : undefined
          }
        />
        {sources?.[item.id] && onOpenSource && (
          <MessageSources chips={sources[item.id]} onOpen={onOpenSource} />
        )}
        {hasSiblings && (
          <View testID={testIDs.containers.branchNav} style={styles.branchNav}>
            <Pressable
              testID={`${testIDs.buttons.prevBranch}_${item.id}`}
              onPress={() => onSwitchBranch?.(item, -1)}
              disabled={branch.index === 1}
              accessibilityRole="button"
              accessibilityLabel="Previous branch"
              accessibilityState={{ disabled: branch.index === 1 }}
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
              accessibilityRole="button"
              accessibilityLabel="Next branch"
              accessibilityState={{ disabled: branch.index === branch.total }}
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
        testID={testIDs.containers.list}
        keyboardShouldPersistTaps="handled"
        ref={listRef}
        onContentSizeChange={scrollToNewest}
        onLayout={() => {
          if (hasScrolledInitially.current) scrollToNewest();
        }}
        onScrollBeginDrag={() => onFollowEvent({ type: "dragBegin" })}
        onScrollEndDrag={(e) =>
          onFollowEvent({ type: "dragEnd", nearBottom: nearBottom(e) })
        }
        onMomentumScrollBegin={() => onFollowEvent({ type: "momentumBegin" })}
        onMomentumScrollEnd={(e) =>
          onFollowEvent({ type: "momentumEnd", nearBottom: nearBottom(e) })
        }
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
  containers: ["root", "list", "branchNav"] as const,
  buttons: ["prevBranch", "nextBranch"] as const,
  texts: ["branchCount"] as const,
});

ChatThread.testIDs = testIDs;
