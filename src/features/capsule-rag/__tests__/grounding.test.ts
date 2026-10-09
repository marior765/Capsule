// Tests for 7.3 (grounding chat in capsules) — written before implementation (TDD)
import type { SQLiteDatabase } from "expo-sqlite";
import type { LlamaContext } from "@/shared/llm";
import { openDb, runMigrations, _resetDbForTesting } from "@/shared/db";
import {
  capsuleEmbeddingsMigration,
  capsuleParentIdMigration,
  capsulesMigration,
  capsuleValuesMigration,
  insertCapsule,
  upsertEmbedding,
} from "@/entities/capsule";
import { buildGroundingPrompt, retrieveCapsuleContext } from "../index";

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

describe("buildGroundingPrompt", () => {
  it("returns null when there's nothing to ground on", () => {
    expect(buildGroundingPrompt([], 2000)).toBeNull();
  });

  it("lists each capsule as a numbered, titled block after a short instruction", () => {
    const prompt = buildGroundingPrompt(
      [
        { title: "Dentist", text: "Dentist\nWhen: Tuesday 3pm" },
        { title: "Gym", text: "Gym\nDays: Mon, Thu" },
      ],
      2000,
    )!;
    expect(prompt).toMatch(/capsule/i);
    expect(prompt).toContain("[1] Dentist");
    expect(prompt).toContain("When: Tuesday 3pm");
    expect(prompt).toContain("[2] Gym");
    expect(prompt.indexOf("[1]")).toBeLessThan(prompt.indexOf("[2]"));
  });

  it("stays within the character budget, cutting the lowest-ranked capsules first", () => {
    const long = "x".repeat(900);
    const prompt = buildGroundingPrompt(
      [
        { title: "First", text: long },
        { title: "Second", text: long },
        { title: "Third", text: long },
      ],
      2000,
    )!;
    expect(prompt.length).toBeLessThanOrEqual(2000);
    expect(prompt).toContain("[1] First");
    expect(prompt).not.toContain("Third");
  });

  it("truncates a single oversized capsule rather than dropping everything", () => {
    const prompt = buildGroundingPrompt(
      [{ title: "Huge", text: "y".repeat(10_000) }],
      1000,
    )!;
    expect(prompt.length).toBeLessThanOrEqual(1000);
    expect(prompt).toContain("[1] Huge");
  });
});

describe("retrieveCapsuleContext", () => {
  function seed(id: string, title: string, vector: number[]) {
    insertCapsule(db, {
      id,
      capsuleTypeId: "t",
      title,
      parentCapsuleId: null,
      createdAt: 1,
      updatedAt: 1,
    });
    upsertEmbedding(db, {
      capsuleId: id,
      embedding: vector,
      content: `${title}\nindexed text for ${title}`,
      updatedAt: 1,
    });
  }

  const queryCtx = (vector: number[]) =>
    ({
      embedding: jest.fn(async () => ({ embedding: vector })),
    }) as unknown as LlamaContext;

  it("returns the most relevant capsules' indexed text as a prompt, plus sources for display", async () => {
    seed("dentist", "Dentist", [1, 0]);
    seed("gym", "Gym", [0, 1]);

    const result = await retrieveCapsuleContext(
      db,
      queryCtx([1, 0.1]),
      "teeth",
    );

    expect(result.sources.map((s) => s.capsuleId)).toEqual(
      ["dentist", "gym"].slice(0, result.sources.length),
    );
    expect(result.sources[0]).toMatchObject({
      capsuleId: "dentist",
      title: "Dentist",
    });
    expect(result.prompt).toContain("indexed text for Dentist");
  });

  it("drops matches below the similarity threshold", async () => {
    seed("dentist", "Dentist", [1, 0]);
    seed("gym", "Gym", [0, 1]);

    const result = await retrieveCapsuleContext(db, queryCtx([1, 0]), "teeth", {
      minScore: 0.5,
    });
    expect(result.sources.map((s) => s.capsuleId)).toEqual(["dentist"]);
    expect(result.prompt).not.toContain("Gym");
  });

  it("returns no prompt and no sources when nothing is relevant enough", async () => {
    seed("gym", "Gym", [0, 1]);
    const result = await retrieveCapsuleContext(db, queryCtx([1, 0]), "teeth", {
      minScore: 0.5,
    });
    expect(result).toEqual({ prompt: null, sources: [] });
  });

  it("skips an embedding whose capsule was deleted", async () => {
    upsertEmbedding(db, {
      capsuleId: "ghost",
      embedding: [1, 0],
      content: "Ghost",
      updatedAt: 1,
    });
    const result = await retrieveCapsuleContext(db, queryCtx([1, 0]), "x");
    expect(result.sources).toEqual([]);
    expect(result.prompt).toBeNull();
  });
});

describe("retrieveCapsuleContext — source accounting", () => {
  it("isn't fooled by capsule text that looks like a numbered block", async () => {
    insertCapsule(db, {
      id: "a",
      capsuleTypeId: "t",
      title: "A",
      parentCapsuleId: null,
      createdAt: 1,
      updatedAt: 1,
    });
    upsertEmbedding(db, {
      capsuleId: "a",
      embedding: [1, 0],
      content: "A\n\n[2] not a real block\n\n[3] neither",
      updatedAt: 1,
    });
    const ctx = {
      embedding: jest.fn(async () => ({ embedding: [1, 0] })),
    } as unknown as LlamaContext;
    const result = await retrieveCapsuleContext(db, ctx, "q");
    expect(result.sources.map((s) => s.capsuleId)).toEqual(["a"]);
  });
});
