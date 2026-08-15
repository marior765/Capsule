/**
 * Prepares a rendered code block's raw content for the clipboard.
 *
 * react-native-markdown-display's own `fence`/`code_block` render rules trim
 * exactly one trailing newline from `node.content` before displaying it —
 * their own comment says "the parser sends an extra one." Mirroring that
 * exact behavior here (rather than a blanket `.trimEnd()`) keeps what gets
 * copied identical to what's on screen, including any blank lines the author
 * genuinely left at the end of the block.
 */
export function prepareCodeForCopy(content: string): string {
  if (content.endsWith("\n")) {
    return content.slice(0, -1);
  }
  return content;
}
