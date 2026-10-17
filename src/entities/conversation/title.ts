/** What a conversation is called until its first message names it. */
export const DEFAULT_CONVERSATION_TITLE = "New chat";

const MAX_TITLE_LENGTH = 40;

/**
 * A conversation title from its first message: one line, at most 40
 * characters, cut at a word boundary with "…" when longer. An empty message
 * keeps the default.
 */
export function titleFromFirstMessage(text: string): string {
  const line = text.replace(/\s+/g, " ").trim();
  if (!line) return DEFAULT_CONVERSATION_TITLE;
  // Characters, not UTF-16 code units — never cut an emoji in half.
  const chars = Array.from(line);
  if (chars.length <= MAX_TITLE_LENGTH) return line;
  const cut = chars.slice(0, MAX_TITLE_LENGTH).join("");
  const lastSpace = cut.lastIndexOf(" ");
  const head = lastSpace > 0 ? cut.slice(0, lastSpace) : cut;
  return `${head.trimEnd()}…`;
}
