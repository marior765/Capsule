import type { Conversation } from "@/entities/conversation";
import type { Message, MessageRole } from "@/entities/message";

const ROLE_LABEL: Record<MessageRole, string> = {
  user: "You",
  assistant: "Assistant",
  system: "System",
};

/**
 * Renders one conversation's visible branch (`messages`, already resolved
 * by the caller via `getMessagePath` — this function has no db access and
 * doesn't care how the list was assembled) as a single markdown document.
 * Pure and synchronous — no clipboard/file/network action here; the
 * caller decides what to do with the resulting string (the established
 * pattern in this app is `expo-clipboard`'s `setStringAsync`, the same
 * local OS API `ChatBubble`'s code-block copy already uses).
 *
 * Message `content` is passed through completely untouched — every
 * message is already markdown-ish text (that's what `ChatBubble` renders
 * it as), so a code fence or any other markdown the model produced stays
 * intact rather than being re-escaped or reformatted.
 */
export function exportConversationAsMarkdown(
  conversation: Conversation,
  messages: Message[],
): string {
  const title = conversation.title.trim() || "Untitled conversation";
  const lines = [`# ${title}`];

  // A blank line goes BEFORE each role label, never after a message's own
  // content — that's what makes the final `+ "\n"` below safe to add
  // unconditionally rather than needing a `.trimEnd()` on the whole
  // joined document. `.trimEnd()` on the full string was the original,
  // buggy approach: it cleaned up this function's own trailing blank-line
  // formatting, but it also silently ate any trailing whitespace the
  // LAST message's own content genuinely had (e.g. a markdown hard break,
  // "text  ") — directly contradicting "passed through untouched."
  for (const message of messages) {
    lines.push("", `**${ROLE_LABEL[message.role]}:**`, "", message.content);
  }

  return lines.join("\n") + "\n";
}
