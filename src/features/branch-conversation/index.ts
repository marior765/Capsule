import {
  getConversationById,
  updateConversation,
} from "@/entities/conversation";
import {
  getMessagePath,
  insertMessage,
  type Message,
} from "@/entities/message";
import { getPersonaById } from "@/entities/persona";
import { DEFAULT_INFERENCE, type InferenceSettings } from "@/shared/config";
import { generateId } from "@/shared/lib";
import {
  runCompletion,
  type ChatMessage,
  type LlamaContext,
} from "@/shared/llm";
import type { SQLiteDatabase } from "expo-sqlite";

const MAX_TOKENS = 512;

function findMessage(db: SQLiteDatabase, id: string): Message | null {
  // The path to a message ends with the message itself.
  const path = getMessagePath(db, id);
  const last = path[path.length - 1];
  return last && last.id === id ? last : null;
}

/**
 * Re-asks a question with edited text, forking the conversation.
 *
 * The edit becomes a *sibling* of the original message (same parentId) rather
 * than replacing it, so the original branch stays in the tree and remains
 * reachable via `switchBranch`. The conversation's active leaf moves to the
 * newly generated reply.
 */
export async function branchFromMessage(
  db: SQLiteDatabase,
  ctx: LlamaContext,
  messageId: string,
  newText: string,
  onToken?: (token: string) => void,
  settings: InferenceSettings = DEFAULT_INFERENCE,
): Promise<{ userMessage: Message; assistantMessage: Message }> {
  const original = findMessage(db, messageId);
  if (!original) {
    throw new Error(`Cannot branch: message ${messageId} not found`);
  }
  if (original.role !== "user") {
    throw new Error("Cannot branch: only user messages can be edited");
  }

  const userMessage: Message = {
    id: generateId(),
    conversationId: original.conversationId,
    parentId: original.parentId, // sibling of the original — never overwrite
    role: "user",
    content: newText,
    tokenCount: 0,
    createdAt: Date.now(),
  };
  insertMessage(db, userMessage);

  const conversation = getConversationById(db, original.conversationId);
  const persona = conversation?.personaId
    ? getPersonaById(db, conversation.personaId)
    : null;

  const history = getMessagePath(db, userMessage.id);
  const messages: ChatMessage[] = [
    ...(persona
      ? [{ role: "system" as const, content: persona.systemPrompt }]
      : []),
    ...history.map((m) => ({ role: m.role, content: m.content })),
  ];

  let tokenCount = 0;
  const result = await runCompletion(
    ctx,
    {
      messages,
      maxTokens: MAX_TOKENS,
      temperature: settings.temperature,
      topP: settings.topP,
      topK: settings.topK,
      repeatPenalty: settings.repeatPenalty,
      seed: settings.seed,
    },
    (token) => {
      tokenCount += 1;
      onToken?.(token);
    },
  );

  const assistantMessage: Message = {
    id: generateId(),
    conversationId: original.conversationId,
    parentId: userMessage.id,
    role: "assistant",
    content: result.text,
    tokenCount,
    createdAt: Date.now(),
  };
  insertMessage(db, assistantMessage);

  // Only now does the new branch become the visible one — a failed generation
  // above leaves the original branch active.
  updateConversation(db, original.conversationId, {
    activeLeafId: assistantMessage.id,
    updatedAt: Date.now(),
  });

  return { userMessage, assistantMessage };
}

/** Makes `leafId` the visible branch tip of the conversation. */
export function switchBranch(
  db: SQLiteDatabase,
  conversationId: string,
  leafId: string,
): void {
  updateConversation(db, conversationId, { activeLeafId: leafId });
}
