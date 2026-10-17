import {
  DEFAULT_CONVERSATION_TITLE,
  getConversationById,
  titleFromFirstMessage,
  updateConversation,
} from "@/entities/conversation";
import {
  deleteImageByMessage,
  getImageByMessage,
  getMessagePath,
  insertMessage,
  insertMessageImage,
  insertMessageSources,
  type Message,
} from "@/entities/message";
import {
  copyFileInto,
  deleteAppFileIfExists,
  deleteCacheFileIfExists,
  resolveAppPath,
  toSafeFileName,
} from "@/shared/fs";
import { getPersonaById } from "@/entities/persona";
import { DEFAULT_INFERENCE, type InferenceSettings } from "@/shared/config";
import { generateId, joinSystemPrompts } from "@/shared/lib";
import {
  runCompletion,
  type ChatMessage,
  type LlamaContext,
} from "@/shared/llm";
import type { SQLiteDatabase } from "expo-sqlite";

export type SendMessageInput = {
  conversationId: string;
  text: string;
  /**
   * Per-turn grounding in the user's own capsules (7.3). `prompt` is
   * appended to the system prompt, sent to the local model only and never
   * stored; `sources` (which capsules it came from) ARE stored against the
   * assistant reply, so the chat can show what an answer drew on (7.4).
   * `branchFromMessage` (editing a message) takes the same grounding.
   */
  grounding?: Grounding;
  /** An image to attach to this message (8.4). Always stored with it. */
  image?: MessageImageInput;
  /**
   * Whether to send the conversation's images to the model — only when the
   * loaded context is vision-capable (`LlmProvider.vision`). A text-only
   * context has no projector, and llama.rn's behaviour when handed an image
   * then is undefined, so the default is to send text only.
   */
  withImages?: boolean;
};

export type MessageImageInput = {
  /** Where the picked image is now — usually a picker's temporary cache copy. */
  sourceUri: string;
  /** Original file name, used to build the stored name. */
  name: string;
  /** True for a picker's cache copy: deleted once the image is stored (or if storing fails). */
  sourceIsTemporaryCopy?: boolean;
};

const CHAT_IMAGES_DIRECTORY = "chat-images";

/**
 * The `imageUrl` for each message on a history path that has an attached
 * image — what lets a vision model keep "seeing" earlier images in later
 * turns. (`branch-conversation` has the same few lines inline — features
 * can't import each other.)
 */
export function imageUrlFor(
  db: SQLiteDatabase,
): (message: Message) => string | undefined {
  return (message) => {
    const image = getImageByMessage(db, message.id);
    return image ? resolveAppPath(image.path) : undefined;
  };
}

export type Grounding = {
  prompt: string;
  sources: { capsuleId: string; title: string }[];
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
  imageFor?: (message: Message) => string | undefined,
): ChatMessage[] {
  return [
    ...(systemPrompt
      ? [{ role: "system" as const, content: systemPrompt }]
      : []),
    ...history.map((m) => {
      const imageUrl = imageFor?.(m);
      return imageUrl
        ? { role: m.role, content: m.content, imageUrl }
        : { role: m.role, content: m.content };
    }),
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
): Promise<{
  userMessage: Message;
  assistantMessage: Message;
  /** Context the conversation now takes (prompt + reply); null if unknown. */
  contextTokens: number | null;
}> {
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

  // The image is copied into app storage BEFORE anything is saved, so a
  // failed copy leaves no message behind; the picker's temporary copy is
  // removed either way.
  let imagePath: string | null = null;
  if (input.image) {
    try {
      imagePath = await copyFileInto(
        input.image.sourceUri,
        [CHAT_IMAGES_DIRECTORY, input.conversationId],
        `${userMessage.id}-${toSafeFileName(input.image.name) || "image"}`,
      );
    } finally {
      if (input.image.sourceIsTemporaryCopy) {
        try {
          deleteCacheFileIfExists(input.image.sourceUri);
        } catch {
          // best effort — the OS clears its cache; the wipe clears picker folders
        }
      }
    }
  }

  // Image row first, then the message: if either insert fails, undo what
  // was written (row and file) so no message is left without its image.
  // Cleanup errors never mask the original failure.
  let imageRowWritten = false;
  try {
    if (imagePath !== null) {
      insertMessageImage(db, {
        messageId: userMessage.id,
        conversationId: input.conversationId,
        path: imagePath,
      });
      imageRowWritten = true;
    }
    insertMessage(db, userMessage);
  } catch (error) {
    try {
      if (imageRowWritten) deleteImageByMessage(db, userMessage.id);
      if (imagePath !== null) deleteAppFileIfExists(imagePath);
    } catch {
      // keep the original error
    }
    throw error;
  }
  // A conversation still called "New chat" is named after its first message
  // (10.15); a title the user chose, or a conversation already under way, is
  // left alone.
  const isFirstMessage = conversation?.activeLeafId == null;
  const autoTitle =
    isFirstMessage && conversation?.title === DEFAULT_CONVERSATION_TITLE
      ? { title: titleFromFirstMessage(input.text) }
      : {};
  updateConversation(db, input.conversationId, {
    activeLeafId: userMessage.id,
    ...autoTitle,
  });

  // A dangling personaId (persona deleted) simply yields no system prompt.
  const persona = conversation?.personaId
    ? getPersonaById(db, conversation.personaId)
    : null;

  // Prompt follows the *active branch*, not every message in the conversation.
  const history = getMessagePath(db, userMessage.id);
  const messages = buildMessages(
    history,
    joinSystemPrompts(persona?.systemPrompt, input.grounding?.prompt),
    input.withImages ? imageUrlFor(db) : undefined,
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
  insertMessage(db, assistantMessage);
  // Only when the prompt actually went to the model — otherwise nothing
  // grounded the reply and listing sources would be untrue.
  if (input.grounding?.prompt.trim()) {
    insertMessageSources(
      db,
      assistantMessage.id,
      input.conversationId,
      input.grounding.sources,
    );
  }

  updateConversation(db, input.conversationId, {
    activeLeafId: assistantMessage.id,
    updatedAt: Date.now(),
  });

  const contextTokens =
    result.promptTokens === null
      ? null
      : result.promptTokens + result.generatedTokens;
  return { userMessage, assistantMessage, contextTokens };
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
