import type { Migration } from "@/shared/db";
import type { SQLiteDatabase } from "expo-sqlite";
import { rowToTag, type Tag, type TagRow } from "./model";

export const tagsMigration: Migration = {
  version: 13,
  up: (db: SQLiteDatabase) => {
    db.execSync(`
      CREATE TABLE IF NOT EXISTS tags (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);
  },
};

/**
 * The capsule<->tag junction — many-to-many, no separate id, `PRIMARY
 * KEY(capsule_id, tag_id)` both enforces "a capsule can't have the same
 * tag twice" and is what makes `addTagToCapsule`'s `INSERT OR IGNORE`
 * idempotent. Like `capsule_values` (entities/capsule/db.ts), this join
 * table lives alongside the entity that references *out* to the other
 * side (tags reference capsules, not the reverse) rather than as its own
 * top-level slice.
 */
export const capsuleTagsMigration: Migration = {
  version: 14,
  up: (db: SQLiteDatabase) => {
    db.execSync(`
      CREATE TABLE IF NOT EXISTS capsule_tags (
        capsule_id TEXT NOT NULL,
        tag_id TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        PRIMARY KEY (capsule_id, tag_id)
      );
    `);
  },
};

// --- Tag ---

export function getAllTags(db: SQLiteDatabase): Tag[] {
  const rows = db.getAllSync(
    "SELECT * FROM tags ORDER BY updated_at DESC;",
  ) as TagRow[];
  return rows.map(rowToTag);
}

export function getTagById(db: SQLiteDatabase, id: string): Tag | null {
  const row = db.getFirstSync(
    "SELECT * FROM tags WHERE id = ?;",
    id,
  ) as TagRow | null;
  return row ? rowToTag(row) : null;
}

export function getTagByName(db: SQLiteDatabase, name: string): Tag | null {
  const row = db.getFirstSync(
    "SELECT * FROM tags WHERE name = ?;",
    name,
  ) as TagRow | null;
  return row ? rowToTag(row) : null;
}

export function insertTag(db: SQLiteDatabase, tag: Tag): void {
  db.runSync(
    "INSERT INTO tags (id, name, created_at, updated_at) VALUES (?, ?, ?, ?);",
    tag.id,
    tag.name,
    tag.createdAt,
    tag.updatedAt,
  );
}

export function updateTag(
  db: SQLiteDatabase,
  id: string,
  updates: Partial<Pick<Tag, "name" | "updatedAt">>,
): void {
  const current = getTagById(db, id);
  if (!current) return;
  const next = { ...current, ...updates };
  db.runSync(
    "UPDATE tags SET name = ?, updated_at = ? WHERE id = ?;",
    next.name,
    next.updatedAt,
    id,
  );
}

export function deleteTag(db: SQLiteDatabase, id: string): void {
  db.runSync("DELETE FROM tags WHERE id = ?;", id);
}

// --- capsule/tag junction ---

/** Every tag attached to one capsule. Empty array, never an error, for an untagged capsule. */
export function getTagsByCapsule(db: SQLiteDatabase, capsuleId: string): Tag[] {
  const rows = db.getAllSync(
    `SELECT tags.* FROM tags
     JOIN capsule_tags ON capsule_tags.tag_id = tags.id
     WHERE capsule_tags.capsule_id = ?
     ORDER BY tags.name ASC;`,
    capsuleId,
  ) as TagRow[];
  return rows.map(rowToTag);
}

/** Every capsule id tagged with one tag. */
export function getCapsuleIdsByTag(
  db: SQLiteDatabase,
  tagId: string,
): string[] {
  const rows = db.getAllSync(
    "SELECT capsule_id FROM capsule_tags WHERE tag_id = ?;",
    tagId,
  ) as { capsule_id: string }[];
  return rows.map((row) => row.capsule_id);
}

/**
 * `INSERT OR IGNORE` — attaching a tag a capsule already has is a safe
 * no-op, not a constraint-violation error, matching `upsertCapsuleValue`'s
 * own "callers don't need to check first" ergonomics.
 */
export function addTagToCapsule(
  db: SQLiteDatabase,
  capsuleId: string,
  tagId: string,
  createdAt: number,
): void {
  db.runSync(
    "INSERT OR IGNORE INTO capsule_tags (capsule_id, tag_id, created_at) VALUES (?, ?, ?);",
    capsuleId,
    tagId,
    createdAt,
  );
}

export function removeTagFromCapsule(
  db: SQLiteDatabase,
  capsuleId: string,
  tagId: string,
): void {
  db.runSync(
    "DELETE FROM capsule_tags WHERE capsule_id = ? AND tag_id = ?;",
    capsuleId,
    tagId,
  );
}

/** Removes every tag attachment for one capsule — e.g. before deleting the capsule itself (composed by the feature layer, not automatic here). */
export function deleteCapsuleTagsByCapsule(
  db: SQLiteDatabase,
  capsuleId: string,
): void {
  db.runSync("DELETE FROM capsule_tags WHERE capsule_id = ?;", capsuleId);
}

/** Removes every capsule's attachment to one tag — e.g. before deleting the tag itself. */
export function deleteCapsuleTagsByTag(
  db: SQLiteDatabase,
  tagId: string,
): void {
  db.runSync("DELETE FROM capsule_tags WHERE tag_id = ?;", tagId);
}
