const number = new Intl.NumberFormat("en-US");

/** "Context 750 / 4096 tokens" — how much of the model's window is in use. */
export function formatContextUsage(
  used: number,
  total: number,
  approximate: boolean,
): string {
  const usedText = `${approximate ? "≈" : ""}${number.format(used)}`;
  return `Context ${usedText} / ${number.format(total)} tokens`;
}

/**
 * A rough token count (≈4 characters per token) for when the model hasn't
 * reported a real one yet — e.g. a conversation just opened. Shown with "≈".
 */
export function estimateTokens(texts: readonly string[]): number {
  return texts.reduce((sum, text) => sum + Math.ceil(text.length / 4), 0);
}
