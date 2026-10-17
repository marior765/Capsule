import type { Message } from "@/entities/message";

export type MessageAction =
  | { key: "copy" }
  /** Ask again: re-send `from` (the user message the reply answered). */
  | { key: "regenerate"; from: Message };

/**
 * What a long-press on `message` offers, given the visible thread. Replies
 * can be copied; the latest one can also be regenerated from the user
 * message it answered. The user's own messages have Edit instead.
 */
export function messageActions(
  message: Message,
  thread: readonly Message[],
): MessageAction[] {
  if (message.role !== "assistant") return [];
  const actions: MessageAction[] = [{ key: "copy" }];
  const isLatest = thread[thread.length - 1]?.id === message.id;
  const from = thread.find((m) => m.id === message.parentId);
  if (isLatest && from?.role === "user") {
    actions.push({ key: "regenerate", from });
  }
  return actions;
}
