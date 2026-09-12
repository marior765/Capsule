/**
 * A reusable piece of text a user can insert into chat ("prompt/snippet
 * library" per docs/DEVELOPMENT_PLAN.md 8.2) — e.g. a common instruction
 * ("Summarize the following in three bullet points:") saved once and
 * reused across conversations. Fully local, no relation to any
 * conversation/message — a snippet is just text until inserted.
 */
export type Snippet = {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
};

export type SnippetRow = {
  id: string;
  title: string;
  content: string;
  created_at: number;
  updated_at: number;
};

export function rowToSnippet(row: SnippetRow): Snippet {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
