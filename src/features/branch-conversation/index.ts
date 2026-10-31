import {
  getConversationById,
  updateConversation,
} from "@/entities/conversation";
import {
  getChildren,
  getImageByMessage,
  getMessagePath,
  getSiblings,
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

/** Where a message sits among its alternatives, e.g. `‹ 2/3 ›` (1-based). */
interface SiblingPosition {
  index: number;
  total: number;
}

/**
 * `message`'s position among its siblings in its own conversation, or null
 * when it has no alternatives (10.35: first messages of other conversations
 * are not alternatives).
 */
export function getBranchPosition(
  db: SQLiteDatabase,
  message: Message,
): SiblingPosition | null {
  const siblings = getSiblings(db, message);
  if (siblings.length < 2) return null;
  return {
    index: siblings.findIndex((s) => s.id === message.id) + 1,
    total: siblings.length,
  };
}

/**
 * The leaf to show when stepping from `message` to its previous (-1) or next
 * (+1) sibling: that sibling followed down its newest replies. Null when
 * there is no sibling in that direction.
 */
export function findSiblingBranchLeaf(
  db: SQLiteDatabase,
  message: Message,
  direction: -1 | 1,
): string | null {
  const siblings = getSiblings(db, message);
  const currentIndex = siblings.findIndex((s) => s.id === message.id);
  if (currentIndex < 0) return null;
  const next = siblings[currentIndex + direction];
  if (!next) return null;

  // The visited set stops the walk if stored data ever contains a parent
  // cycle (importers now refuse to write one, but older data might).
  let leafId = next.id;
  const visited = new Set<string>([leafId]);
  for (;;) {
    const children = getChildren(db, leafId);
    if (children.length === 0) break;
    const child = children[children.length - 1].id;
    if (visited.has(child)) break;
    visited.add(child);
    leafId = child;
  }
  return leafId;
}
