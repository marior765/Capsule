// Tests for step 8.2 — written before implementation (TDD)
import type { SQLiteDatabase } from "expo-sqlite";
import { openDb, runMigrations, _resetDbForTesting } from "@/shared/db";
import {
  deleteSnippet,
  getAllSnippets,
  getSnippetById,
  insertSnippet,
  snippetsMigration,
  updateSnippet,
  type Snippet,
} from "../index";

const makeSnippet = (overrides: Partial<Snippet> = {}): Snippet => ({
  id: `s-${Math.random().toString(36).slice(2)}`,
  title: "Summarize",
  content: "Summarize the following text in three bullet points:",
  createdAt: 1000,
  updatedAt: 1000,
  ...overrides,
});

let db: SQLiteDatabase;

beforeEach(() => {
  _resetDbForTesting();
  db = openDb();
  runMigrations(db, [snippetsMigration]);
});

describe("entities/snippet — CRUD", () => {
  it("inserts and retrieves a snippet", () => {
    const snippet = makeSnippet();
    insertSnippet(db, snippet);
    const found = getSnippetById(db, snippet.id);
    expect(found?.title).toBe("Summarize");
    expect(found?.content).toBe(
      "Summarize the following text in three bullet points:",
    );
  });

  it("getSnippetById returns null for an unknown id", () => {
    expect(getSnippetById(db, "missing")).toBeNull();
  });

  it("getAllSnippets orders by updatedAt descending", () => {
    insertSnippet(db, makeSnippet({ id: "old", updatedAt: 100 }));
    insertSnippet(db, makeSnippet({ id: "new", updatedAt: 300 }));
    insertSnippet(db, makeSnippet({ id: "mid", updatedAt: 200 }));
    expect(getAllSnippets(db).map((s) => s.id)).toEqual(["new", "mid", "old"]);
  });

  it("getAllSnippets returns an empty array when none exist", () => {
    expect(getAllSnippets(db)).toEqual([]);
  });

  it("updates a snippet's title and content", () => {
    const snippet = makeSnippet();
    insertSnippet(db, snippet);
    updateSnippet(db, snippet.id, {
      title: "Summarize (short)",
      content: "Summarize in one sentence:",
      updatedAt: 2000,
    });
    const found = getSnippetById(db, snippet.id);
    expect(found?.title).toBe("Summarize (short)");
    expect(found?.content).toBe("Summarize in one sentence:");
  });

  it("updating with an empty patch is a no-op, not an error", () => {
    const snippet = makeSnippet();
    insertSnippet(db, snippet);
    expect(() => updateSnippet(db, snippet.id, {})).not.toThrow();
    expect(getSnippetById(db, snippet.id)?.title).toBe("Summarize");
  });

  it("deleteSnippet removes the record", () => {
    const snippet = makeSnippet();
    insertSnippet(db, snippet);
    deleteSnippet(db, snippet.id);
    expect(getSnippetById(db, snippet.id)).toBeNull();
  });

  it("deleting an unknown id does not throw", () => {
    expect(() => deleteSnippet(db, "missing")).not.toThrow();
  });
});
