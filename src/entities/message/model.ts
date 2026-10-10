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

/**
 * One capsule that grounded an assistant reply (7.3/7.4), kept so the chat
 * can show the user which of their capsules an answer drew on. `title` is a
 * snapshot taken at answer time: the capsule may later be renamed, deleted,
 * or simply not exist on another device after an export/import, and the
 * record must still say something meaningful. `rank` is 0 for the best match.
 */
export type MessageSource = {
  messageId: string;
  conversationId: string;
  capsuleId: string;
  title: string;
  rank: number;
};

export type MessageSourceRow = {
  message_id: string;
  conversation_id: string;
  capsule_id: string;
  title: string;
  rank: number;
};

export function rowToMessageSource(row: MessageSourceRow): MessageSource {
  return {
    messageId: row.message_id,
    conversationId: row.conversation_id,
    capsuleId: row.capsule_id,
    title: row.title,
    rank: row.rank,
  };
}
