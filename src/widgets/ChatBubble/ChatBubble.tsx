import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import * as Clipboard from "expo-clipboard";
import Markdown, {
  type ASTNode,
  type RenderRules,
} from "react-native-markdown-display";
import type { Message } from "@/entities/message";
import { createComponentTestIDs } from "@/shared/testing";
import { createMarkdownParser } from "./markdownParser";
import { prepareCodeForCopy } from "./prepareCodeForCopy";

type ChatBubbleProps = {
  message: Message;
  /** Only offered on user messages — editing forks a new branch. */
  onEdit?: (message: Message) => void;
};

// One instance is enough — it holds no per-message state, so it doesn't need
// to be recreated on every render or per bubble.
const markdownParser = createMarkdownParser();

type CodeBlockProps = { code: string; testID: string };

/**
 * `fence` (```-delimited) and `code_block` (4-space-indented) both render
 * through this: a monospace block plus a copy-to-clipboard button.
 * `expo-clipboard` is a local OS API — copying is not a network action.
 *
 * A real component (not a plain render function) so it can hold its own
 * "just copied" feedback state — `setStringAsync`'s result was previously
 * discarded outright, giving no confirmation of success and no visible
 * reaction to failure.
 */
function CodeBlock({ code, testID }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      const ok = await Clipboard.setStringAsync(code);
      if (ok) {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }
    } catch {
      // Clipboard access can fail for platform reasons outside this app's
      // control — the button simply doesn't confirm; nothing to crash on.
    }
  };

  return (
    <View style={styles.codeBlock}>
      <Text style={styles.codeText}>{code}</Text>
      <Pressable testID={testID} style={styles.copyButton} onPress={handleCopy}>
        <Text style={styles.copyLabel}>{copied ? "Copied" : "Copy"}</Text>
      </Pressable>
    </View>
  );
}

/**
 * Message content is local — the user's own text or the model's own
 * output — never a trusted external document. A markdown image reference
 * pointing at a remote URL would otherwise make simply *displaying* a
 * message fetch that URL, which is a network call this app's core chat
 * rendering must never make on its own. The `image` rule is overridden to
 * never render a real `<Image>`.
 *
 * That alone isn't the whole guarantee, though: raw HTML in the content
 * (`<img src="...">`) tokenizes as `html_block`/`html_inline`, a different
 * node type this rule never sees. `createMarkdownParser` (passed as
 * `markdownit` below) is what actually closes that gap, by configuring
 * `html: false` explicitly rather than relying on it being markdown-it's
 * unstated default — see `markdownParser.test.ts`.
 *
 * `node.key` is not used for identity here — it comes from a module-level
 * counter inside react-native-markdown-display that increments on every
 * parse across the whole app, so it changes on every re-render regardless
 * of whether this message's content did. A 0-based index of code blocks in
 * document order, closed over per render, is what CLAUDE.md's testID
 * stability convention actually needs: the same position in the same
 * message content always resolves to the same testID.
 */
function markdownRules(messageId: string): RenderRules {
  let codeBlockIndex = 0;

  const renderCodeBlock = (node: ASTNode) => {
    const testID = `${testIDs.buttons.copyCode}_${messageId}_${codeBlockIndex}`;
    codeBlockIndex += 1;
    return (
      <CodeBlock
        key={testID}
        code={prepareCodeForCopy(node.content)}
        testID={testID}
      />
    );
  };

  return {
    fence: renderCodeBlock,
    code_block: renderCodeBlock,
    image: (node) => (
      <Text key={node.key} style={styles.imageOmitted}>
        [image omitted]
      </Text>
    ),
  };
}

export function ChatBubble({ message, onEdit }: ChatBubbleProps) {
  const { theme } = useUnistyles();
  const isUser = message.role === "user";
  const canEdit = isUser && onEdit != null;

  return (
    <View
      testID={`${testIDs.containers.root}_${message.id}`}
      style={[styles.bubble, isUser ? styles.user : styles.assistant]}
    >
      <View testID={testIDs.texts.content}>
        <Markdown
          rules={markdownRules(message.id)}
          markdownit={markdownParser}
          style={{
            body: { color: theme.colors.text, fontFamily: theme.fonts.sans },
          }}
        >
          {message.content}
        </Markdown>
      </View>
      {canEdit && (
        <Pressable
          testID={`${testIDs.buttons.edit}_${message.id}`}
          onPress={() => onEdit(message)}
        >
          <Text style={styles.edit}>Edit</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  bubble: {
    maxWidth: "85%",
    paddingVertical: theme.spacing.two,
    paddingHorizontal: theme.spacing.three,
    borderRadius: theme.spacing.three,
    marginVertical: theme.spacing.one,
  },
  user: {
    alignSelf: "flex-end",
    backgroundColor: theme.colors.backgroundSelected,
  },
  assistant: {
    alignSelf: "flex-start",
    backgroundColor: theme.colors.backgroundElement,
  },
  edit: {
    marginTop: theme.spacing.one,
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.rounded,
    fontSize: 12,
  },
  codeBlock: {
    marginVertical: theme.spacing.one,
    borderRadius: theme.spacing.one,
    backgroundColor: theme.colors.backgroundElement,
    padding: theme.spacing.two,
  },
  codeText: {
    color: theme.colors.text,
    fontFamily: theme.fonts.mono,
    fontSize: 13,
  },
  copyButton: {
    alignSelf: "flex-end",
    marginTop: theme.spacing.one,
  },
  copyLabel: {
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.rounded,
    fontSize: 12,
  },
  imageOmitted: {
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.sans,
    fontStyle: "italic",
  },
}));

const testIDs = createComponentTestIDs("ChatBubble", {
  containers: ["root"] as const,
  texts: ["content"] as const,
  buttons: ["edit", "copyCode"] as const,
});

ChatBubble.testIDs = testIDs;
