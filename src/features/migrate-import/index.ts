import type { SQLiteDatabase } from "expo-sqlite";
import { insertConversation, type Conversation } from "@/entities/conversation";
import {
  insertMessage,
  type Message,
  type MessageRole,
} from "@/entities/message";
import { generateId } from "@/shared/lib";

/**
 * "Migration importers (ChatGPT export, Claude export, CSV, JSON,
 * Markdown)" (docs/DEVELOPMENT_PLAN.md 5.4) — CLAUDE.md's "zero lock-in"
 * differentiator extended to *other tools'* export formats, not just this
 * app's own portable format (that's `features/import-export`, 5.2).
 *
 * Status: ChatGPT export (conversations, this file) and CSV / JSON /
 * Markdown (capsules, `./capsuleImporters.ts`) and Claude export
 * (conversations, this file — unverified, see below) are implemented. ChatGPT's export has a specific schema: a
 * `conversations.json` array whose entries hold a `mapping` of node id ->
 * `{ message, parent, children }`, the same kind of message tree this
 * app's branching model uses.
 *
 * **Important caveat, not glossed over**: the ChatGPT parser's field names and
 * structure are implemented from training-time knowledge of ChatGPT's
 * export format, not verified against a real, current export file — OpenAI
 * could have changed field names/shapes since. Written defensively
 * (skips anything it doesn't recognize rather than crashing or fabricating
 * content) specifically because of that uncertainty. Flagged in
 * `.claude/loop/BLOCKED.md` as needing validation against a real export
 * before being trusted for an actual migration.
 *
 * Import always generates fresh ids — same "treat as new data" semantics
 * as `features/import-export`'s own import functions (ChatGPT's node ids
 * have no meaning inside this app's schema, and there's no reason to
 * preserve them). No audit entry is written, for the same reason
 * `importConversation`/`importAllConversations` don't: CLAUDE.md's
 * hard rule names "export, decrypt, wipe, model download," not "import."
 */

// --- Minimal shape of a ChatGPT `conversations.json` export, typed loosely
// (`unknown`-heavy, narrowed at each access) since this is untrusted,
// externally-produced data whose exact shape isn't guaranteed. ---

type ChatGptContentPart = string;

type ChatGptMessage = {
  author?: { role?: string };
  content?: { content_type?: string; parts?: ChatGptContentPart[] };
  create_time?: number | null;
};

type ChatGptNode = {
  message?: ChatGptMessage | null;
  parent?: string | null;
  children?: string[];
};

type ChatGptConversation = {
  title?: string;
  create_time?: number;
  update_time?: number;
  current_node?: string;
  mapping?: Record<string, ChatGptNode>;
};

const SUPPORTED_ROLES: ReadonlySet<string> = new Set([
  "user",
  "assistant",
  "system",
]);

export type ParsedMessage = {
  role: MessageRole;
  content: string;
  createdAt: number;
  /** Index into the same conversation's `messages` array, or null for a root. */
  parentIndex: number | null;
};

export type ParsedConversation = {
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ParsedMessage[];
  /** Index into `messages`, or null if the export's active node wasn't importable. */
  activeLeafIndex: number | null;
};

/**
 * Guarantees the parent links form a tree. Parent indices in an imported
 * file are untrusted: a message can name itself, two messages can name
 * each other, and mixing explicit parent ids with array-order chaining
 * can close a loop even in well-meaning data. A cycle saved to the
 * database would make any parent/child walk in the chat UI spin forever,
 * so every node on a cycle-closing edge is turned into a root instead.
 * Pure — returns a new array.
 */
function breakParentCycles(messages: ParsedMessage[]): ParsedMessage[] {
  const parents = messages.map((m) => m.parentIndex);
  for (let start = 0; start < parents.length; start++) {
    const seen = new Set<number>([start]);
    let at = parents[start];
    while (at !== null) {
      if (seen.has(at)) {
        // `start`'s ancestry loops. Cutting `start`'s own parent link is
        // enough when `start` is on the loop; otherwise the loop is cut
        // when the outer loop reaches one of its members.
        if (at === start) parents[start] = null;
        break;
      }
      seen.add(at);
      at = parents[at];
    }
  }
  return messages.map((m, i) => ({ ...m, parentIndex: parents[i] }));
}

function toMillis(
  seconds: number | null | undefined,
  fallback: number,
): number {
  if (typeof seconds !== "number") {
    return fallback;
  }
  return Math.round(seconds * 1000);
}

/**
 * Pure parsing — no database access — so the ChatGPT-schema-reading logic
 * is testable in isolation from the insert step, mirroring every other
 * `shared/`-adjacent extraction in this codebase (`prepareCodeForCopy.ts`,
 * `holdGesture.ts`, `formatAuditEntry.ts`).
 */
export function parseChatGptExport(json: string): ParsedConversation[] {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new Error("Not valid JSON");
  }
  if (!Array.isArray(raw)) {
    throw new Error(
      "Expected a ChatGPT export to be a JSON array of conversations",
    );
  }

  return (raw as ChatGptConversation[]).map((conversation) => {
    const mapping = conversation.mapping ?? {};
    const createdAt = toMillis(conversation.create_time, Date.now());
    const updatedAt = toMillis(conversation.update_time, createdAt);

    // Two passes, deliberately: `Object.entries(mapping)` has no guaranteed
    // relationship to tree order — a child can legitimately appear before
    // its parent in the JSON's own key order (confirmed empirically: V8
    // preserves literal source order for non-numeric string keys, and
    // nothing about ChatGPT's export format promises parent-before-child
    // ordering). A single-pass resolve-as-you-go approach would silently
    // mis-root any such child as a top-level message the moment its real
    // parent hadn't been visited yet — a genuine bug caught during review,
    // not a hypothetical. Pass 1 decides which nodes are importable and
    // assigns each a stable index; pass 2 resolves every `parentIndex`
    // only once ALL importable nodes are already in `nodeIdToIndex`, so
    // iteration order can never affect the result.
    const importable: {
      nodeId: string;
      parentNodeId: string | null;
      role: MessageRole;
      content: string;
      createdAt: number;
    }[] = [];
    const nodeIdToIndex = new Map<string, number>();

    for (const [nodeId, node] of Object.entries(mapping)) {
      const message = node.message;
      if (!message) {
        continue; // the synthetic root, or any other message-less node
      }
      const role = message.author?.role;
      if (role === undefined || !SUPPORTED_ROLES.has(role)) {
        continue; // e.g. "tool" — this app's MessageRole has no such case
      }
      if (message.content?.content_type !== "text") {
        continue; // non-text content (code, multimodal, ...) — not this beat's scope
      }
      const parts = message.content.parts ?? [];
      const content = parts.join("\n");
      if (!content) {
        continue; // empty parts — nothing meaningful to import
      }

      nodeIdToIndex.set(nodeId, importable.length);
      importable.push({
        nodeId,
        parentNodeId: node.parent ?? null,
        role: role as MessageRole,
        content,
        createdAt: toMillis(message.create_time, createdAt),
      });
    }

    // Skipped nodes (null message, unsupported role, non-text/empty
    // content) are never in `nodeIdToIndex`, so a child whose real parent
    // was skipped correctly re-roots at null here too — same guarantee as
    // before, just no longer order-dependent for the *valid* parent case.
    const messages: ParsedMessage[] = importable.map((entry) => ({
      role: entry.role,
      content: entry.content,
      createdAt: entry.createdAt,
      parentIndex:
        entry.parentNodeId !== null
          ? (nodeIdToIndex.get(entry.parentNodeId) ?? null)
          : null,
    }));

    const activeLeafIndex =
      conversation.current_node !== undefined
        ? (nodeIdToIndex.get(conversation.current_node) ?? null)
        : null;

    return {
      title: conversation.title ?? "Imported conversation",
      createdAt,
      updatedAt,
      messages: breakParentCycles(messages),
      activeLeafIndex,
    };
  });
}

/**
 * Inserts already-parsed conversations as new data (fresh ids, parent and
 * active-leaf indices remapped). Shared by every conversation importer so
 * the insert step exists once, whatever format the data came from.
 */
function insertParsedConversations(
  db: SQLiteDatabase,
  parsedConversations: ParsedConversation[],
): Conversation[] {
  return parsedConversations.map((parsed) => {
    const ids = parsed.messages.map(() => generateId());
    const conversationId = generateId();

    const conversation: Conversation = {
      id: conversationId,
      title: parsed.title,
      modelId: null,
      personaId: null,
      activeLeafId:
        parsed.activeLeafIndex !== null ? ids[parsed.activeLeafIndex] : null,
      createdAt: parsed.createdAt,
      updatedAt: parsed.updatedAt,
    };
    insertConversation(db, conversation);

    parsed.messages.forEach((message, index) => {
      const insertedMessage: Message = {
        id: ids[index],
        conversationId,
        parentId:
          message.parentIndex !== null ? ids[message.parentIndex] : null,
        role: message.role,
        content: message.content,
        tokenCount: 0,
        createdAt: message.createdAt,
      };
      insertMessage(db, insertedMessage);
    });

    return conversation;
  });
}

/** Parses a ChatGPT export and inserts every conversation as new data. */
export function importChatGptExport(
  db: SQLiteDatabase,
  json: string,
): Conversation[] {
  return insertParsedConversations(db, parseChatGptExport(json));
}

// --- Claude (claude.ai) export ---
//
// Built from the publicly described shape of claude.ai's data export
// (`conversations.json`; there is no formal published schema), NOT verified against a real export file — same
// caveat as the ChatGPT parser above, flagged in .claude/loop/BLOCKED.md.
// Shape relied on: an array of `{ uuid, name, created_at, updated_at,
// chat_messages: [{ uuid, sender: "human" | "assistant", text,
// content: [{ type, text }], created_at, parent_message_uuid? }] }`,
// timestamps as ISO 8601 strings. Typed loosely and narrowed on access,
// since this is untrusted, externally produced data.
//
// Message order: when a message carries `parent_message_uuid`, that is
// used (so branches survive, in either array order); a uuid that matches
// no importable message — the export's synthetic root, or a skipped
// message — makes it a root. Without the field, messages chain linearly
// in array order. Whatever the links say, `breakParentCycles` guarantees
// the result is a tree. The active leaf is `current_leaf_message_uuid` when
// present and importable, else the last importable message in array order.

type ClaudeContentBlock = { type?: string; text?: string };

type ClaudeMessage = {
  uuid?: string;
  sender?: string;
  text?: string;
  content?: ClaudeContentBlock[];
  created_at?: string;
  parent_message_uuid?: string;
};

type ClaudeConversation = {
  name?: string;
  current_leaf_message_uuid?: string;
  created_at?: string;
  updated_at?: string;
  chat_messages?: ClaudeMessage[];
};

const CLAUDE_SENDER_ROLES: Record<string, MessageRole> = {
  human: "user",
  assistant: "assistant",
};

function isoToMillis(value: string | undefined, fallback: number): number {
  const parsed = typeof value === "string" ? Date.parse(value) : NaN;
  return Number.isNaN(parsed) ? fallback : parsed;
}

function claudeMessageText(message: ClaudeMessage): string {
  if (Array.isArray(message.content) && message.content.length > 0) {
    return message.content
      .filter(
        (block): block is { type: string; text: string } =>
          block.type === "text" && typeof block.text === "string",
      )
      .map((block) => block.text)
      .filter((text) => text !== "")
      .join("\n\n");
  }
  return typeof message.text === "string" ? message.text : "";
}

/** Pure parsing of a claude.ai `conversations.json` export — no database access. */
export function parseClaudeExport(json: string): ParsedConversation[] {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new Error("Not valid JSON");
  }
  if (!Array.isArray(raw)) {
    throw new Error(
      "Expected a Claude export to be a JSON array of conversations",
    );
  }

  return (raw as ClaudeConversation[]).map((conversation) => {
    const createdAt = isoToMillis(conversation.created_at, Date.now());
    const updatedAt = isoToMillis(conversation.updated_at, createdAt);
    const source = Array.isArray(conversation.chat_messages)
      ? conversation.chat_messages
      : [];

    // Pass 1: decide which messages are importable and index them, so a
    // parent_message_uuid can resolve regardless of array order.
    const importable: {
      message: ClaudeMessage;
      role: MessageRole;
      content: string;
    }[] = [];
    const uuidToIndex = new Map<string, number>();
    for (const message of source) {
      const role =
        typeof message.sender === "string"
          ? CLAUDE_SENDER_ROLES[message.sender]
          : undefined;
      if (role === undefined) continue;
      const content = claudeMessageText(message);
      if (!content) continue;
      if (typeof message.uuid === "string") {
        uuidToIndex.set(message.uuid, importable.length);
      }
      importable.push({ message, role, content });
    }

    // Pass 2: resolve parents.
    const messages: ParsedMessage[] = importable.map(
      ({ message, role, content }, index) => {
        let parentIndex: number | null;
        if (typeof message.parent_message_uuid === "string") {
          parentIndex = uuidToIndex.get(message.parent_message_uuid) ?? null;
        } else {
          parentIndex = index > 0 ? index - 1 : null;
        }
        return {
          role,
          content,
          createdAt: isoToMillis(message.created_at, createdAt),
          parentIndex,
        };
      },
    );

    const leafFromExport =
      typeof conversation.current_leaf_message_uuid === "string"
        ? uuidToIndex.get(conversation.current_leaf_message_uuid)
        : undefined;

    return {
      title: conversation.name || "Imported conversation",
      createdAt,
      updatedAt,
      messages: breakParentCycles(messages),
      activeLeafIndex:
        leafFromExport ?? (messages.length > 0 ? messages.length - 1 : null),
    };
  });
}

/** Parses a claude.ai export and inserts every conversation as new data. */
export function importClaudeExport(
  db: SQLiteDatabase,
  json: string,
): Conversation[] {
  return insertParsedConversations(db, parseClaudeExport(json));
}

export {
  parseCsv,
  parseCsvTable,
  parseJsonTable,
  parseMarkdownNote,
  importCsv,
  importJsonRecords,
  importMarkdownNotes,
  type ImportedTable,
  type CapsuleImportResult,
  type MarkdownNote,
} from "./capsuleImporters";
