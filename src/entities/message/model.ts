export type MessageRole = "user" | "assistant" | "system";

export type Message = {
  id: string;
  conversationId: string;
  /**
   * Parent in the conversation tree; null for a root message. Editing a message
   * creates a *sibling* (same parentId) rather than overwriting it, which is
   * what preserves prior branches.
   */
  parentId: string | null;
  role: MessageRole;
  content: string;
  tokenCount: number;
  createdAt: number;
};

export type MessageRow = {
  id: string;
  conversation_id: string;
  parent_id: string | null;
  role: string;
  content: string;
  token_count: number;
  created_at: number;
};

export function rowToMessage(row: MessageRow): Message {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    parentId: row.parent_id ?? null,
    role: row.role as MessageRole,
    content: row.content,
    tokenCount: row.token_count,
    createdAt: row.created_at,
  };
}
