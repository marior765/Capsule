/**
 * A lightweight, freeform label ("Tag / Collection" per CLAUDE.md's
 * Capsule domain model). This repo doesn't model "Collection" as a
 * separate entity — a tag applied consistently across capsules IS the
 * collection mechanism, matching this slice's single-folder placement in
 * docs/ARCHITECTURE.md (`entities/tag/  # tags / collections`). Optional
 * organization only, per CLAUDE.md: never required for a capsule to
 * function — a capsule with zero tags is fully valid.
 */
export type Tag = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
};

export type TagRow = {
  id: string;
  name: string;
  created_at: number;
  updated_at: number;
};

export function rowToTag(row: TagRow): Tag {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
