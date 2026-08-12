export type Conversation = {
  id: string;
  title: string;
  modelId: string | null;
  /**
   * Reference to a Persona. May dangle if the persona was deleted — consumers
   * degrade gracefully (no system prompt) rather than failing.
   */
  personaId: string | null;
  /**
   * Tip of the branch currently being displayed. `getMessagePath(activeLeafId)`
   * yields the visible conversation; other branches remain in the tree.
   */
  activeLeafId: string | null;
  createdAt: number;
  updatedAt: number;
};

export type ConversationRow = {
  id: string;
  title: string;
  model_id: string | null;
  persona_id: string | null;
  active_leaf_id: string | null;
  created_at: number;
  updated_at: number;
};

export function rowToConversation(row: ConversationRow): Conversation {
  return {
    id: row.id,
    title: row.title,
    modelId: row.model_id,
    personaId: row.persona_id ?? null,
    activeLeafId: row.active_leaf_id ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
