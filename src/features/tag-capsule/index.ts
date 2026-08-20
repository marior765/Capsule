import type { SQLiteDatabase } from "expo-sqlite";
import {
  addTagToCapsule,
  deleteCapsuleTagsByTag,
  deleteTag as deleteTagRecord,
  getTagByName,
  insertTag,
  removeTagFromCapsule,
  type Tag,
} from "@/entities/tag";
import { generateId } from "@/shared/lib";

/**
 * Attaches a tag, by name, to a capsule — creating the tag if none with
 * that (trimmed) name exists yet, reusing it otherwise. Cross-entity
 * composition lives here in the feature layer, mirroring `create-capsule`'s
 * own `createCapsule`. Get-or-create-by-name (rather than a DB-level
 * `UNIQUE(name)` constraint) matches `entities/capsule-type`'s own
 * precedent — `CapsuleType.name` isn't unique-constrained either — and
 * keeps the "does a tag with this name already exist" decision in one
 * place callers don't have to duplicate themselves.
 */
export function tagCapsule(
  db: SQLiteDatabase,
  capsuleId: string,
  tagName: string,
): Tag {
  const trimmed = tagName.trim();
  const now = Date.now();
  const existing = getTagByName(db, trimmed);
  const tag: Tag = existing ?? {
    id: generateId(),
    name: trimmed,
    createdAt: now,
    updatedAt: now,
  };
  if (!existing) {
    insertTag(db, tag);
  }
  addTagToCapsule(db, capsuleId, tag.id, now);
  return tag;
}

/** Detaches one tag from one capsule — the tag record itself, and its attachments to other capsules, are untouched. */
export function untagCapsule(
  db: SQLiteDatabase,
  capsuleId: string,
  tagId: string,
): void {
  removeTagFromCapsule(db, capsuleId, tagId);
}

/**
 * Deletes a tag and every capsule's attachment to it. Cross-entity cascade
 * lives here in the feature layer, mirroring `delete-capsule`'s own
 * `deleteCapsule` (`deleteValuesByCapsule` then the record) — the entities
 * themselves (`deleteCapsuleTagsByTag`/`deleteTag`) stay independent.
 */
export function deleteTag(db: SQLiteDatabase, tagId: string): void {
  deleteCapsuleTagsByTag(db, tagId);
  deleteTagRecord(db, tagId);
}
