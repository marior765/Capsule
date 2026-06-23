import { updateConversation } from "@/entities/conversation";
import {
    getMessagesByConversation,
    insertMessage,
    type Message,
} from "@/entities/message";
import { generateId } from "@/shared/lib";
import { runCompletion, type LlamaContext } from "@/shared/llm";
import type { SQLiteDatabase } from "expo-sqlite";

export type SendMessageInput = {
  conversationId: string;
  text: string;
};

const MAX_TOKENS = 512;

/**
 * Persists the user's message, streams an LLM completion, then persists the
 * assistant's reply. The user message is written before the completion runs, so
 * a failed completion leaves the user's input intact (no assistant message).
 */
export async function sendMessage(
  db: SQLiteDatabase,
  ctx: LlamaContext,
  input: SendMessageInput,
  onToken?: (token: string) => void,
): Promise<{ userMessage: Message; assistantMessage: Message }> {
  const userMessage: Message = {
    id: generateId(),
    conversationId: input.conversationId,
    role: "user",
    content: input.text,
    tokenCount: 0,
    createdAt: Date.now(),
  };
  insertMessage(db, userMessage);

  const history = getMessagesByConversation(db, input.conversationId);
  const prompt =
    history.map((m) => `${m.role}: ${m.content}`).join("\n") + "\nassistant:";

  let tokenCount = 0;
  const result = await runCompletion(
    ctx,
    { prompt, maxTokens: MAX_TOKENS },
    (token) => {
      tokenCount += 1;
      onToken?.(token);
    },
  );

  const assistantMessage: Message = {
    id: generateId(),
    conversationId: input.conversationId,
    role: "assistant",
    content: result.text,
    tokenCount,
    createdAt: Date.now(),
  };
  insertMessage(db, assistantMessage);

  updateConversation(db, input.conversationId, { updatedAt: Date.now() });

  return { userMessage, assistantMessage };
}
