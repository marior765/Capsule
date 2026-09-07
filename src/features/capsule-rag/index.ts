import type { LlamaContext } from "@/shared/llm";
import { embedText } from "@/shared/llm";
import type { SQLiteDatabase } from "expo-sqlite";
import {
  getAllEmbeddings,
  getEmbeddingByCapsule,
  upsertEmbedding,
  type Capsule,
} from "@/entities/capsule";
import type { CapsuleType } from "@/entities/capsule-type";
import type { CapsuleField } from "@/entities/field";
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
 * `ctx: LlamaContext` — no live embedding context exists anywhere in the
 * app yet (Providers only loads a chat completion context); wiring this
 * to fire automatically on capsule create/edit waits on 7.1's own open
 * decision (llama.rn's built-in embedding vs. a dedicated small model),
 * tracked in `BLOCKED.md`. This function is complete and tested
 * independent of that decision — whichever model wins, it's still called
 * the same way, through the same `embedText` contract.
 */
export async function indexCapsule(
  db: SQLiteDatabase,
  ctx: LlamaContext,
  capsule: Capsule,
  capsuleType: CapsuleType | null,
  fields: CapsuleField[],
  values: Record<string, string | null>,
): Promise<void> {
  const content = buildCapsuleText(capsule, capsuleType, fields, values);
  const existing = getEmbeddingByCapsule(db, capsule.id);
  if (existing?.content === content) return;

  const { embedding } = await embedText(ctx, content);
  upsertEmbedding(db, {
    capsuleId: capsule.id,
    embedding,
    content,
    updatedAt: Date.now(),
  });
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
