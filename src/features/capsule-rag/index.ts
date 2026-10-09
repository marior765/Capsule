import type { LlamaContext } from "@/shared/llm";
import { embedText } from "@/shared/llm";
import type { SQLiteDatabase } from "expo-sqlite";
import {
  getAllCapsules,
  getAllEmbeddings,
  getCapsuleById,
  getEmbeddingByCapsule,
  getValuesByCapsule,
  upsertEmbedding,
  type Capsule,
} from "@/entities/capsule";
import { getCapsuleTypeById, type CapsuleType } from "@/entities/capsule-type";
import { getFieldsByCapsuleType, type CapsuleField } from "@/entities/field";
import { buildCapsuleText } from "./buildCapsuleText";
import { cosineSimilarity } from "./cosineSimilarity";

export { buildCapsuleText } from "./buildCapsuleText";
export { cosineSimilarity } from "./cosineSimilarity";

/**
 * Indexes one capsule: builds its text, embeds it (via `shared/llm`'s
 * `embedText` — `ctx` must be a context loaded with `initEmbeddingContext`,
 * 7.1), and stores the result. Skips the actual embedding call when the
 * built text is unchanged since the last index — comparing the *content*
 * a plain string, not the vector, is what makes that check possible
 * without loading a model at all when nothing needs re-embedding.
 *
 * `ctx: LlamaContext` — a context from `initEmbeddingContext` loaded with
 * the dedicated embedding model (decided 2026-10-09; downloaded by
 * `features/manage-embedding-model`). `app/providers`' EmbeddingProvider
 * loads that context and calls `indexCapsuleById` after a capsule is
 * created, edited, or restored, plus `indexAllCapsules` on app start.
 */
export async function indexCapsule(
  db: SQLiteDatabase,
  ctx: LlamaContext,
  capsule: Capsule,
  capsuleType: CapsuleType | null,
  fields: CapsuleField[],
  values: Record<string, string | null>,
): Promise<boolean> {
  const content = buildCapsuleText(capsule, capsuleType, fields, values);
  const existing = getEmbeddingByCapsule(db, capsule.id);
  if (existing?.content === content) return false;

  const { embedding } = await embedText(ctx, content);
  upsertEmbedding(db, {
    capsuleId: capsule.id,
    embedding,
    content,
    updatedAt: Date.now(),
  });
  return true;
}

/**
 * Loads a capsule's current type, fields, and values from the database and
 * indexes it. Returns true if it was (re-)embedded, false if the capsule
 * doesn't exist or its text hasn't changed since the last index.
 */
export async function indexCapsuleById(
  db: SQLiteDatabase,
  ctx: LlamaContext,
  capsuleId: string,
): Promise<boolean> {
  const capsule = getCapsuleById(db, capsuleId);
  if (capsule === null) return false;
  const values: Record<string, string | null> = {};
  for (const v of getValuesByCapsule(db, capsuleId)) {
    values[v.fieldId] = v.value;
  }
  return indexCapsule(
    db,
    ctx,
    capsule,
    getCapsuleTypeById(db, capsule.capsuleTypeId),
    getFieldsByCapsuleType(db, capsule.capsuleTypeId),
    values,
  );
}

export type IndexAllResult = {
  embedded: number;
  skipped: number;
  failed: number;
};

/**
 * Backfill: indexes every capsule, one at a time. Unchanged capsules are
 * skipped cheaply (no model call), so this is safe to run on every app
 * start. One capsule failing doesn't stop the rest.
 */
export async function indexAllCapsules(
  db: SQLiteDatabase,
  ctx: LlamaContext,
): Promise<IndexAllResult> {
  const result: IndexAllResult = { embedded: 0, skipped: 0, failed: 0 };
  for (const capsule of getAllCapsules(db)) {
    try {
      if (await indexCapsuleById(db, ctx, capsule.id)) result.embedded++;
      else result.skipped++;
    } catch {
      result.failed++;
    }
  }
  return result;
}

export type RelevantCapsule = {
  capsuleId: string;
  score: number;
};

/**
 * Embeds `queryText` and ranks every indexed capsule against it by
 * cosine similarity, highest first. A local linear scan, not an ANN
 * index (FAISS/HNSW/etc.) — deliberately: this is a single-user, local-
 * first app where the realistic embedding count is in the hundreds to
 * low thousands, not millions, and a plain JS scan over that many
 * fixed-length float arrays costs single-digit milliseconds. Reaching
 * for a real vector-index library here would be exactly the kind of
 * premature complexity this codebase's stated philosophy warns against.
 *
 * Returns `[]` without calling `embedText` at all when nothing has been
 * indexed yet — no point spending a model call on a query that has
 * nothing to compare against.
 */
export async function retrieveRelevantCapsules(
  db: SQLiteDatabase,
  ctx: LlamaContext,
  queryText: string,
  topK: number = 5,
): Promise<RelevantCapsule[]> {
  const all = getAllEmbeddings(db);
  if (all.length === 0) return [];

  const { embedding: queryEmbedding } = await embedText(ctx, queryText);
  return all
    .map((entry) => ({
      capsuleId: entry.capsuleId,
      score: cosineSimilarity(queryEmbedding, entry.embedding),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

// --- Grounding chat in the user's capsules (7.3) ---

export type GroundingEntry = { title: string; text: string };

const GROUNDING_INSTRUCTION =
  "The user keeps a personal, on-device knowledge base of notes called capsules. " +
  "The capsules below may be relevant to their next message. Use them only if they " +
  "help answer it, refer to them by their number like [1] when you do, and don't " +
  "invent details they don't contain.";

function composeGrounding(
  entries: GroundingEntry[],
  maxChars: number,
): { prompt: string | null; included: number } {
  let prompt = GROUNDING_INSTRUCTION;
  let included = 0;
  for (const [index, entry] of entries.entries()) {
    const header = `\n\n[${index + 1}] ${entry.title}\n`;
    const room = maxChars - prompt.length - header.length;
    if (room <= 0) break;
    if (entry.text.length <= room) {
      prompt += header + entry.text;
      included++;
    } else {
      // Truncate only the best match; otherwise stop at the budget.
      if (included === 0) {
        prompt += header + entry.text.slice(0, Math.max(0, room - 1)) + "…";
        included++;
      }
      break;
    }
  }
  return included > 0 ? { prompt, included } : { prompt: null, included: 0 };
}

/**
 * Formats retrieved capsules into a system-prompt block, best match first,
 * within `maxChars`. Lower-ranked capsules are dropped first; a single
 * capsule too long to fit is truncated rather than dropped. Pure.
 */
export function buildGroundingPrompt(
  entries: GroundingEntry[],
  maxChars: number,
): string | null {
  return composeGrounding(entries, maxChars).prompt;
}

export type GroundingSource = {
  capsuleId: string;
  title: string;
  score: number;
};

export type CapsuleContext = {
  /** System-prompt text to send with the message, or null if nothing was relevant enough. */
  prompt: string | null;
  /** The capsules actually included, best first — for showing the user what was used (7.4). */
  sources: GroundingSource[];
};

export type RetrieveContextOptions = {
  topK?: number;
  /**
   * Cosine-similarity floor. A starting value, not a measured one — the
   * right threshold for this embedding model has to be tuned on real
   * capsules on a device (see `.claude/loop/BLOCKED.md`, 7.1/7.2 device
   * check, item g).
   */
  minScore?: number;
  maxChars?: number;
};

export const DEFAULT_RETRIEVE_OPTIONS: Required<RetrieveContextOptions> = {
  topK: 3,
  minScore: 0.35,
  maxChars: 2000,
};

/**
 * Retrieves the capsules most relevant to `query` and turns them into a
 * grounding prompt. Uses each capsule's indexed text (exactly what was
 * embedded) rather than rebuilding it. Embeddings whose capsule no longer
 * exists are skipped.
 */
export async function retrieveCapsuleContext(
  db: SQLiteDatabase,
  ctx: LlamaContext,
  query: string,
  options: RetrieveContextOptions = {},
): Promise<CapsuleContext> {
  const { topK, minScore, maxChars } = {
    ...DEFAULT_RETRIEVE_OPTIONS,
    ...options,
  };
  const ranked = await retrieveRelevantCapsules(db, ctx, query, topK);

  const sources: GroundingSource[] = [];
  const entries: GroundingEntry[] = [];
  for (const { capsuleId, score } of ranked) {
    if (score < minScore) continue;
    const capsule = getCapsuleById(db, capsuleId);
    const indexed = getEmbeddingByCapsule(db, capsuleId);
    if (capsule === null || indexed === null) continue;
    sources.push({ capsuleId, title: capsule.title, score });
    entries.push({ title: capsule.title, text: indexed.content });
  }

  const { prompt, included } = composeGrounding(entries, maxChars);
  if (prompt === null) return { prompt: null, sources: [] };
  // Only report capsules that actually made it into the prompt.
  return { prompt, sources: sources.slice(0, included) };
}

export type PreparedGrounding = {
  /** Pass to sendMessage / branchFromMessage; undefined means send ungrounded. */
  groundingPrompt?: string;
  sources: GroundingSource[];
  /** One honest line for the user about what happened. */
  notice: string;
};

/**
 * Decides how one chat message is grounded when "My capsules" is on, and
 * what to tell the user. `retrieve` is injected (the app layer's serial
 * embedding queue). Retrieval is capped at `timeoutMs` so a message never
 * waits behind start-up indexing; on timeout or failure the message goes
 * out ungrounded and the notice says so — it's never silently dropped.
 */
export async function prepareGrounding(params: {
  hasModel: boolean;
  retrieve: (query: string) => Promise<CapsuleContext | null>;
  query: string;
  timeoutMs: number;
}): Promise<PreparedGrounding> {
  if (!params.hasModel) {
    return {
      sources: [],
      notice:
        "Capsule search needs its model — download it in Models → Capsule search. Answered without your capsules.",
    };
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<"timeout">((resolve) => {
    timer = setTimeout(() => resolve("timeout"), params.timeoutMs);
  });
  let context: CapsuleContext | null | "timeout";
  try {
    context = await Promise.race([
      // Promise.resolve().then(...) turns even a synchronous throw into a
      // rejection, so a broken retrieve can never lose the user's message.
      Promise.resolve()
        .then(() => params.retrieve(params.query))
        .catch(() => null),
      timedOut,
    ]);
  } finally {
    clearTimeout(timer);
  }

  if (context === "timeout" || context === null) {
    return {
      sources: [],
      notice:
        "Capsule search unavailable right now — answered without your capsules.",
    };
  }
  if (context.prompt === null || context.sources.length === 0) {
    return {
      sources: [],
      notice: "No relevant capsules found — answered without them.",
    };
  }
  const count = context.sources.length;
  return {
    groundingPrompt: context.prompt,
    sources: context.sources,
    notice: `Using ${count} capsule${count === 1 ? "" : "s"}: ${context.sources
      .map((s) => s.title)
      .join(", ")}`,
  };
}
