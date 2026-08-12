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

export type SendMessageInput = {
  conversationId: string;
  text: string;
};

export type EphemeralMessageInput = {
  /** In-memory session id. Never persisted — it only labels the messages. */
  conversationId: string;
  history: Message[];
  text: string;
  systemPrompt?: string;
};

const MAX_TOKENS = 512;

/**
 * Turns a message path into the chat turns llama.rn will render with the
 * model's own template. Pure — the shared core of the persisted and ephemeral
 * paths. Deliberately returns structure, not a formatted string: the prompt
 * markup belongs to the model, not to us.
 */
export function buildMessages(
  history: Message[],
  systemPrompt?: string,
): ChatMessage[] {
  return [
    ...(systemPrompt
      ? [{ role: "system" as const, content: systemPrompt }]
      : []),
    ...history.map((m) => ({ role: m.role, content: m.content })),
  ];
}

function samplingParams(settings: InferenceSettings) {
  return {
    maxTokens: MAX_TOKENS,
    temperature: settings.temperature,
    topP: settings.topP,
    topK: settings.topK,
    repeatPenalty: settings.repeatPenalty,
    seed: settings.seed,
  };
}

/**
 * Persists the user's message, streams an LLM completion, then persists the
 * assistant's reply. The user message is written before the completion runs, so
 * a failed completion leaves the user's input intact (no assistant message).
 *
 * `settings` is injected rather than read from configure-inference: features
 * cannot import other features, so the app layer composes the two.
 */
export async function sendMessage(
  db: SQLiteDatabase,
  ctx: LlamaContext,
  input: SendMessageInput,
  onToken?: (token: string) => void,
  settings: InferenceSettings = DEFAULT_INFERENCE,
): Promise<{ userMessage: Message; assistantMessage: Message }> {
  const conversation = getConversationById(db, input.conversationId);

  const userMessage: Message = {
    id: generateId(),
    conversationId: input.conversationId,
    parentId: conversation?.activeLeafId ?? null,
    role: "user",
    content: input.text,
    tokenCount: 0,
    createdAt: Date.now(),
  };
  insertMessage(db, userMessage);
  updateConversation(db, input.conversationId, {
    activeLeafId: userMessage.id,
  });

  // A dangling personaId (persona deleted) simply yields no system prompt.
  const persona = conversation?.personaId
    ? getPersonaById(db, conversation.personaId)
    : null;

  // Prompt follows the *active branch*, not every message in the conversation.
  const history = getMessagePath(db, userMessage.id);
  const messages = buildMessages(history, persona?.systemPrompt);

  let tokenCount = 0;
  const result = await runCompletion(
    ctx,
    { messages, ...samplingParams(settings) },
    (token) => {
      tokenCount += 1;
      onToken?.(token);
    },
  );

  const assistantMessage: Message = {
    id: generateId(),
    conversationId: input.conversationId,
    parentId: userMessage.id,
    role: "assistant",
    content: result.text,
    tokenCount,
    createdAt: Date.now(),
  };
  insertMessage(db, assistantMessage);

  updateConversation(db, input.conversationId, {
    activeLeafId: assistantMessage.id,
    updatedAt: Date.now(),
  });

  return { userMessage, assistantMessage };
}

/**
 * Runs a completion for a session-only chat.
 *
 * Deliberately takes **no database handle**: an ephemeral chat cannot be
 * written to disk because this function has no way to write to disk. The
 * privacy guarantee is enforced by the signature, not by a runtime flag.
 * Callers hold the history in memory and pass it back on each turn.
 */
export async function sendEphemeralMessage(
  ctx: LlamaContext,
  input: EphemeralMessageInput,
  onToken?: (token: string) => void,
  settings: InferenceSettings = DEFAULT_INFERENCE,
): Promise<{ userMessage: Message; assistantMessage: Message }> {
  const previous = input.history[input.history.length - 1] ?? null;

  const userMessage: Message = {
    id: generateId(),
    conversationId: input.conversationId,
    parentId: previous?.id ?? null,
    role: "user",
    content: input.text,
    tokenCount: 0,
    createdAt: Date.now(),
  };

  const messages = buildMessages(
    [...input.history, userMessage],
    input.systemPrompt,
  );

  let tokenCount = 0;
  const result = await runCompletion(
    ctx,
    { messages, ...samplingParams(settings) },
    (token) => {
      tokenCount += 1;
      onToken?.(token);
    },
  );

  const assistantMessage: Message = {
    id: generateId(),
    conversationId: input.conversationId,
    parentId: userMessage.id,
    role: "assistant",
    content: result.text,
    tokenCount,
    createdAt: Date.now(),
  };

  return { userMessage, assistantMessage };
}
