export type MessageRole = "user" | "assistant" | "system";

export type Message = {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  tokenCount: number;
  createdAt: number;
};

export type MessageRow = {
  id: string;
  conversation_id: string;
  role: string;
  content: string;
  token_count: number;
  created_at: number;
};

export function rowToMessage(row: MessageRow): Message {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role as MessageRole,
    content: row.content,
    tokenCount: row.token_count,
    createdAt: row.created_at,
  };
}
