import {
  getConversationById,
  updateConversation,
} from "@/entities/conversation";
import {
  getImageByMessage,
  getMessagePath,
  insertMessage,
  insertMessageImage,
  insertMessageSources,
  type Message,
} from "@/entities/message";
import { resolveAppPath } from "@/shared/fs";
import { getPersonaById } from "@/entities/persona";
import { DEFAULT_INFERENCE, type InferenceSettings } from "@/shared/config";
import { generateId, joinSystemPrompts } from "@/shared/lib";
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
  /**
   * Optional per-turn capsule grounding (7.3/7.4) — same contract as
   * `sendMessage`'s: the prompt is never stored, the sources are stored
   * against the new reply.
   */
  grounding?: {
    prompt: string;
    sources: { capsuleId: string; title: string }[];
  },
  /** Send the conversation's images only to a vision-capable context (same rule as `sendMessage`'s `withImages`). */
  options: { withImages?: boolean } = {},
): Promise<{
  userMessage: Message;
  assistantMessage: Message;
  contextTokens: number | null;
}> {
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
  // An edit changes the text, not the attached image (8.4): the new
  // sibling points at the same stored image file as the original.
  const originalImage = getImageByMessage(db, original.id);
  if (originalImage) {
    insertMessageImage(db, { ...originalImage, messageId: userMessage.id });
  }

  const conversation = getConversationById(db, original.conversationId);
  const persona = conversation?.personaId
    ? getPersonaById(db, conversation.personaId)
    : null;

  const history = getMessagePath(db, userMessage.id);
  const systemPrompt = joinSystemPrompts(
    persona?.systemPrompt,
    grounding?.prompt,
  );
  const messages: ChatMessage[] = [
    ...(systemPrompt
      ? [{ role: "system" as const, content: systemPrompt }]
      : []),
    ...history.map((m) => {
      const image = options.withImages ? getImageByMessage(db, m.id) : null;
      return image
        ? {
            role: m.role,
            content: m.content,
            imageUrl: resolveAppPath(image.path),
          }
        : { role: m.role, content: m.content };
    }),
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
  if (grounding?.prompt.trim()) {
    insertMessageSources(
      db,
      assistantMessage.id,
      original.conversationId,
      grounding.sources,
    );
  }

  // Only now does the new branch become the visible one — a failed generation
  // above leaves the original branch active.
  updateConversation(db, original.conversationId, {
    activeLeafId: assistantMessage.id,
    updatedAt: Date.now(),
  });

  // Context the conversation now takes (prompt + reply), as the model
  // counted it; null if it didn't report a prompt size.
  const contextTokens =
    result.promptTokens === null
      ? null
      : result.promptTokens + result.generatedTokens;
  return { userMessage, assistantMessage, contextTokens };
}

/** Makes `leafId` the visible branch tip of the conversation. */
export function switchBranch(
  db: SQLiteDatabase,
  conversationId: string,
  leafId: string,
): void {
  updateConversation(db, conversationId, { activeLeafId: leafId });
}
