// Tests for step 7.2 — written before implementation (TDD)
import type { SQLiteDatabase } from "expo-sqlite";
import { openDb, runMigrations, _resetDbForTesting } from "@/shared/db";
import {
  capsuleEmbeddingsMigration,
  deleteEmbedding,
  getAllEmbeddings,
  getEmbeddingByCapsule,
  upsertEmbedding,
  type CapsuleEmbedding,
} from "../index";

const makeEmbedding = (
  overrides: Partial<CapsuleEmbedding> = {},
): CapsuleEmbedding => ({
  capsuleId: "c-1",
  embedding: [0.1, 0.2, 0.3],
  content: "Dune — sci-fi novel by Frank Herbert",
  updatedAt: 1000,
  ...overrides,
});

let db: SQLiteDatabase;

beforeEach(() => {
  _resetDbForTesting();
  db = openDb();
  runMigrations(db, [capsuleEmbeddingsMigration]);
});

describe("entities/capsule — embedding CRUD", () => {
  it("upserts and retrieves an embedding by capsule id", () => {
    upsertEmbedding(db, makeEmbedding());
    const found = getEmbeddingByCapsule(db, "c-1");
    expect(found?.embedding).toEqual([0.1, 0.2, 0.3]);
    expect(found?.content).toBe("Dune — sci-fi novel by Frank Herbert");
  });

  it("getEmbeddingByCapsule returns null when no embedding exists yet", () => {
    expect(getEmbeddingByCapsule(db, "missing")).toBeNull();
  });

  it("upserting again for the same capsule replaces the embedding rather than duplicating it", () => {
    upsertEmbedding(
      db,
      makeEmbedding({ content: "old text", updatedAt: 1000 }),
    );
    upsertEmbedding(
      db,
      makeEmbedding({
        embedding: [0.9, 0.9, 0.9],
        content: "new text",
        updatedAt: 2000,
      }),
    );
    const found = getEmbeddingByCapsule(db, "c-1");
    expect(found?.content).toBe("new text");
    expect(found?.embedding).toEqual([0.9, 0.9, 0.9]);
    expect(getAllEmbeddings(db)).toHaveLength(1);
  });

  it("getAllEmbeddings returns every stored embedding", () => {
    upsertEmbedding(db, makeEmbedding({ capsuleId: "c-1" }));
    upsertEmbedding(db, makeEmbedding({ capsuleId: "c-2" }));
    expect(
      getAllEmbeddings(db)
        .map((e) => e.capsuleId)
        .sort(),
    ).toEqual(["c-1", "c-2"]);
  });

  it("getAllEmbeddings returns an empty array when nothing has been indexed yet", () => {
    expect(getAllEmbeddings(db)).toEqual([]);
  });

  it("deleteEmbedding removes one capsule's embedding", () => {
    upsertEmbedding(db, makeEmbedding({ capsuleId: "c-1" }));
    deleteEmbedding(db, "c-1");
    expect(getEmbeddingByCapsule(db, "c-1")).toBeNull();
  });

  it("deleting an embedding that doesn't exist does not throw", () => {
    expect(() => deleteEmbedding(db, "missing")).not.toThrow();
  });

  it("round-trips an embedding vector losslessly, including negative and fractional values", () => {
    const vector = [-0.123456, 0, 1, -1, 0.999999];
    upsertEmbedding(db, makeEmbedding({ embedding: vector }));
    expect(getEmbeddingByCapsule(db, "c-1")?.embedding).toEqual(vector);
  });
});
