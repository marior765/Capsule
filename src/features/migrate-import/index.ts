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
 * **This beat implements ChatGPT export only.** Claude export, CSV,
 * generic JSON, and Markdown are deliberately deferred — genuinely
 * unstarted, not silently dropped. ChatGPT's export was picked first
 * because it has a real, specific, well-known schema (a `conversations.json`
 * file: an array of conversation objects, each holding a `mapping` of
 * node id -> `{ message, parent, children }`, forming the same kind of
 * message tree this app's own branching model already uses) — the other
 * four formats each need their own separate design pass (Claude's export
 * has a different schema entirely; CSV/generic-JSON have no fixed schema
 * at all and need a column/field-mapping design decision first; Markdown
 * export has no standard structure to parse against).
 *
 * **Important caveat, not glossed over**: this parser's field names and
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
      messages,
      activeLeafIndex,
    };
  });
}

/** Parses a ChatGPT export and inserts every conversation as new data. */
export function importChatGptExport(
  db: SQLiteDatabase,
  json: string,
): Conversation[] {
  const parsedConversations = parseChatGptExport(json);

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
