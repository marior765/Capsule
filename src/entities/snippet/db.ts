import type { Migration } from "@/shared/db";
import type { SQLiteDatabase, SQLiteVariadicBindParams } from "expo-sqlite";
import { rowToSnippet, type Snippet, type SnippetRow } from "./model";

export const snippetsMigration: Migration = {
  version: 19,
  up: (db: SQLiteDatabase) => {
    db.execSync(`
      CREATE TABLE IF NOT EXISTS snippets (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);
  },
};

export function getAllSnippets(db: SQLiteDatabase): Snippet[] {
  const rows = db.getAllSync(
    "SELECT * FROM snippets ORDER BY updated_at DESC;",
  ) as SnippetRow[];
  return rows.map(rowToSnippet);
}

export function getSnippetById(db: SQLiteDatabase, id: string): Snippet | null {
  const row = db.getFirstSync(
    "SELECT * FROM snippets WHERE id = ?;",
    id,
  ) as SnippetRow | null;
  return row ? rowToSnippet(row) : null;
}

export function insertSnippet(db: SQLiteDatabase, snippet: Snippet): void {
  db.runSync(
    `INSERT INTO snippets (id, title, content, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?);`,
    snippet.id,
    snippet.title,
    snippet.content,
    snippet.createdAt,
    snippet.updatedAt,
  );
}

export function updateSnippet(
  db: SQLiteDatabase,
  id: string,
  patch: Partial<Omit<Snippet, "id">>,
): void {
  const fields: string[] = [];
  const values: unknown[] = [];

  if (patch.title !== undefined) {
    fields.push("title = ?");
    values.push(patch.title);
  }
  if (patch.content !== undefined) {
    fields.push("content = ?");
    values.push(patch.content);
  }
  if (patch.createdAt !== undefined) {
    fields.push("created_at = ?");
    values.push(patch.createdAt);
  }
  if (patch.updatedAt !== undefined) {
    fields.push("updated_at = ?");
    values.push(patch.updatedAt);
  }

  if (fields.length === 0) return;

  values.push(id);
  db.runSync(
    `UPDATE snippets SET ${fields.join(", ")} WHERE id = ?;`,
    ...(values as SQLiteVariadicBindParams),
  );
}

export function deleteSnippet(db: SQLiteDatabase, id: string): void {
  db.runSync("DELETE FROM snippets WHERE id = ?;", id);
}
