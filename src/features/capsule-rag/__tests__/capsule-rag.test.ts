// Tests for step 7.2 — written before implementation (TDD)
import type { SQLiteDatabase } from "expo-sqlite";
import type { LlamaContext } from "@/shared/llm";
import { openDb, runMigrations, _resetDbForTesting } from "@/shared/db";
import {
  capsuleEmbeddingsMigration,
  capsuleParentIdMigration,
  capsulesMigration,
  capsuleValuesMigration,
  getEmbeddingByCapsule,
} from "@/entities/capsule";
import { createCapsule } from "@/features/create-capsule";
import { indexCapsule, retrieveRelevantCapsules } from "../index";

let db: SQLiteDatabase;

beforeEach(() => {
  _resetDbForTesting();
  db = openDb();
  runMigrations(db, [
    capsulesMigration,
    capsuleValuesMigration,
    capsuleEmbeddingsMigration,
    capsuleParentIdMigration,
  ]);
});

/**
 * Returns a specific, controllable vector per input text — unlike
 * llama.rn's own jest mock (a fixed placeholder regardless of input),
 * this is what lets these tests construct a real "capsule A is more
 * relevant than capsule B" scenario and prove `retrieveRelevantCapsules`
 * actually sorts on it, not just that it calls `embedText` at all.
 */
function fakeEmbeddingContext(vectorsByText: Record<string, number[]>) {
  const ctx = {
    embedding: jest.fn(async (text: string) => ({
      embedding: vectorsByText[text] ?? [0, 0, 0],
    })),
  };
  return ctx as unknown as LlamaContext;
}

describe("indexCapsule", () => {
  it("stores an embedding for a newly-indexed capsule", async () => {
    const capsule = createCapsule(db, {
      capsuleTypeId: "ct-1",
      title: "Dune",
    });
    const ctx = fakeEmbeddingContext({});
    await indexCapsule(db, ctx, capsule, null, [], {});
    expect(getEmbeddingByCapsule(db, capsule.id)).not.toBeNull();
  });

  it("re-embeds when the built text has actually changed", async () => {
    const capsule = createCapsule(db, {
      capsuleTypeId: "ct-1",
      title: "Dune",
    });
    const ctx = {
      embedding: jest
        .fn()
        .mockResolvedValueOnce({ embedding: [1, 0] })
        .mockResolvedValueOnce({ embedding: [0, 1] }),
    } as unknown as LlamaContext;
    await indexCapsule(db, ctx, capsule, null, [], {});
    const renamed = { ...capsule, title: "Dune Messiah" };
    await indexCapsule(db, ctx, renamed, null, [], {});
    expect(getEmbeddingByCapsule(db, capsule.id)?.embedding).toEqual([0, 1]);
    expect(ctx.embedding).toHaveBeenCalledTimes(2);
  });

  it("skips re-embedding when the built text is unchanged — no wasted embedding call", async () => {
    const capsule = createCapsule(db, {
      capsuleTypeId: "ct-1",
      title: "Dune",
    });
    const ctx = fakeEmbeddingContext({});
    await indexCapsule(db, ctx, capsule, null, [], {});
    await indexCapsule(db, ctx, capsule, null, [], {});
    expect(ctx.embedding).toHaveBeenCalledTimes(1);
  });
});

describe("retrieveRelevantCapsules", () => {
  it("returns capsules sorted by similarity to the query, most relevant first", async () => {
    const sciFi = createCapsule(db, {
      capsuleTypeId: "ct-1",
      title: "Dune",
    });
    const cooking = createCapsule(db, {
      capsuleTypeId: "ct-1",
      title: "Pasta Recipes",
    });
    // Call order, not exact text, drives which vector comes back — robust
    // to whatever exact string buildCapsuleText assembles internally.
    const indexCtx = {
      embedding: jest
        .fn()
        .mockResolvedValueOnce({ embedding: [1, 0] }) // sciFi
        .mockResolvedValueOnce({ embedding: [0, 1] }), // cooking
    } as unknown as LlamaContext;
    await indexCapsule(db, indexCtx, sciFi, null, [], {});
    await indexCapsule(db, indexCtx, cooking, null, [], {});

    const queryCtx = fakeEmbeddingContext({ "space travel": [0.9, 0.1] });
    const results = await retrieveRelevantCapsules(
      db,
      queryCtx,
      "space travel",
    );
    expect(results[0].capsuleId).toBe(sciFi.id);
    expect(results[0].score).toBeGreaterThan(results[1].score);
  });

  it("returns an empty array without calling embedText when nothing has been indexed yet", async () => {
    const ctx = fakeEmbeddingContext({});
    const results = await retrieveRelevantCapsules(db, ctx, "anything");
    expect(results).toEqual([]);
    expect(ctx.embedding).not.toHaveBeenCalled();
  });

  it("respects the topK limit", async () => {
    const ctx = fakeEmbeddingContext({});
    for (let i = 0; i < 5; i++) {
      const capsule = createCapsule(db, {
        capsuleTypeId: "ct-1",
        title: `Capsule ${i}`,
      });
      await indexCapsule(db, ctx, capsule, null, [], {});
    }
    const results = await retrieveRelevantCapsules(db, ctx, "query", 2);
    expect(results).toHaveLength(2);
  });
});
