// Tests for 7.2 (indexing wiring) — written before implementation (TDD)
import type { SQLiteDatabase } from "expo-sqlite";
import type { LlamaContext } from "@/shared/llm";
import { openDb, runMigrations, _resetDbForTesting } from "@/shared/db";
import {
  capsuleEmbeddingsMigration,
  capsuleParentIdMigration,
  capsulesMigration,
  capsuleValuesMigration,
  getEmbeddingByCapsule,
  insertCapsule,
  upsertCapsuleValue,
} from "@/entities/capsule";
import {
  capsuleTypesMigration,
  insertCapsuleType,
} from "@/entities/capsule-type";
import { capsuleFieldsMigration, insertCapsuleField } from "@/entities/field";
import { indexAllCapsules, indexCapsuleById } from "../index";

let db: SQLiteDatabase;

beforeEach(() => {
  _resetDbForTesting();
  db = openDb();
  runMigrations(db, [
    capsuleTypesMigration,
    capsuleFieldsMigration,
    capsulesMigration,
    capsuleValuesMigration,
    capsuleEmbeddingsMigration,
    capsuleParentIdMigration,
  ]);
  insertCapsuleType(db, {
    id: "t1",
    name: "Book",
    description: null,
    createdAt: 1,
    updatedAt: 1,
  });
  insertCapsuleField(db, {
    id: "f1",
    capsuleTypeId: "t1",
    name: "Author",
    fieldType: "text",
    config: null,
    sortOrder: 0,
    required: false,
    createdAt: 1,
    updatedAt: 1,
  });
});

function addCapsule(id: string, title: string, author: string | null) {
  insertCapsule(db, {
    id,
    capsuleTypeId: "t1",
    title,
    parentCapsuleId: null,
    createdAt: 1,
    updatedAt: 1,
  });
  if (author !== null) {
    upsertCapsuleValue(db, {
      id: `v-${id}`,
      capsuleId: id,
      fieldId: "f1",
      value: author,
      createdAt: 1,
      updatedAt: 1,
    });
  }
}

function recordingContext() {
  const texts: string[] = [];
  const ctx = {
    embedding: jest.fn(async (text: string) => {
      texts.push(text);
      return { embedding: [texts.length, 1] };
    }),
  } as unknown as LlamaContext;
  return { ctx, texts };
}

describe("indexCapsuleById", () => {
  it("embeds the capsule using its stored type, fields, and values", async () => {
    addCapsule("c1", "Dune", "Herbert");
    const { ctx, texts } = recordingContext();

    await expect(indexCapsuleById(db, ctx, "c1")).resolves.toBe(true);

    expect(texts).toHaveLength(1);
    expect(texts[0]).toContain("Dune");
    expect(texts[0]).toContain("Book");
    expect(texts[0]).toContain("Herbert");
    expect(getEmbeddingByCapsule(db, "c1")?.content).toBe(texts[0]);
  });

  it("returns false and embeds nothing for a capsule that doesn't exist", async () => {
    const { ctx } = recordingContext();
    await expect(indexCapsuleById(db, ctx, "missing")).resolves.toBe(false);
    expect(ctx.embedding).not.toHaveBeenCalled();
  });

  it("returns false (skipped) when nothing changed since the last index", async () => {
    addCapsule("c1", "Dune", "Herbert");
    const { ctx } = recordingContext();
    await indexCapsuleById(db, ctx, "c1");
    await expect(indexCapsuleById(db, ctx, "c1")).resolves.toBe(false);
    expect(ctx.embedding).toHaveBeenCalledTimes(1);
  });
});

describe("indexAllCapsules", () => {
  it("embeds every capsule that needs it and reports counts", async () => {
    addCapsule("c1", "Dune", "Herbert");
    addCapsule("c2", "Emma", null);
    const { ctx } = recordingContext();

    await expect(indexAllCapsules(db, ctx)).resolves.toEqual({
      embedded: 2,
      skipped: 0,
      failed: 0,
    });
    await expect(indexAllCapsules(db, ctx)).resolves.toEqual({
      embedded: 0,
      skipped: 2,
      failed: 0,
    });
  });

  it("keeps going when one capsule fails, and reports the failure count", async () => {
    addCapsule("c1", "Dune", "Herbert");
    addCapsule("c2", "Emma", null);
    const ctx = {
      embedding: jest
        .fn()
        .mockRejectedValueOnce(new Error("context busy"))
        .mockResolvedValue({ embedding: [1, 0] }),
    } as unknown as LlamaContext;

    const result = await indexAllCapsules(db, ctx);
    expect(result.embedded).toBe(1);
    expect(result.failed).toBe(1);
  });
});
