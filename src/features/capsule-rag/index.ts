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
