export type Conversation = {
  id: string;
  title: string;
  modelId: string | null;
  createdAt: number;
  updatedAt: number;
};

export type ConversationRow = {
  id: string;
  title: string;
  model_id: string | null;
  created_at: number;
  updated_at: number;
};

export function rowToConversation(row: ConversationRow): Conversation {
  return {
    id: row.id,
    title: row.title,
    modelId: row.model_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
