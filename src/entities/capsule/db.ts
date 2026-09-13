import type { Migration } from "@/shared/db";
import type { SQLiteDatabase, SQLiteVariadicBindParams } from "expo-sqlite";
import {
  rowToCapsule,
  rowToCapsuleEmbedding,
  rowToCapsuleValue,
  rowToCapsuleVersion,
  type Capsule,
  type CapsuleEmbedding,
  type CapsuleEmbeddingRow,
  type CapsuleRow,
  type CapsuleValue,
  type CapsuleValueRow,
  type CapsuleVersion,
  type CapsuleVersionRow,
} from "./model";

export const capsulesMigration: Migration = {
  version: 11,
  up: (db: SQLiteDatabase) => {
    db.execSync(`
      CREATE TABLE IF NOT EXISTS capsules (
        id TEXT PRIMARY KEY,
        capsule_type_id TEXT NOT NULL,
        title TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);
  },
};

/**
 * `UNIQUE(capsule_id, field_id)` is what makes `upsertCapsuleValue`'s
 * `ON CONFLICT` clause work — it's the invariant this whole table exists
 * to enforce: at most one value row per (capsule, field) pair.
 */
export const capsuleValuesMigration: Migration = {
  version: 12,
  up: (db: SQLiteDatabase) => {
    db.execSync(`
      CREATE TABLE IF NOT EXISTS capsule_values (
        id TEXT PRIMARY KEY,
        capsule_id TEXT NOT NULL,
        field_id TEXT NOT NULL,
        value TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        UNIQUE(capsule_id, field_id)
      );
    `);
  },
};

/**
 * Adds `parent_capsule_id` for 8.5 "capsule nesting" — a plain nullable
 * column rather than a new table, since (per `model.ts`'s doc comment)
 * this is a single-parent tree field on the capsule itself, not a
 * many-to-many relation. No FK constraint, matching every other
 * capsule-to-capsule reference in this codebase — a parent can be
 * deleted (see `orphanChildCapsules` in `features/delete-capsule`) and
 * children degrade gracefully to root-level rather than becoming invalid.
 */
export const capsuleParentIdMigration: Migration = {
  version: 20,
  up: (db: SQLiteDatabase) => {
    db.execSync(`ALTER TABLE capsules ADD COLUMN parent_capsule_id TEXT;`);
  },
};

// --- Capsule ---

export function getAllCapsules(db: SQLiteDatabase): Capsule[] {
  const rows = db.getAllSync(
    "SELECT * FROM capsules ORDER BY updated_at DESC;",
  ) as CapsuleRow[];
  return rows.map(rowToCapsule);
}

export function getCapsulesByType(
  db: SQLiteDatabase,
  capsuleTypeId: string,
): Capsule[] {
  const rows = db.getAllSync(
    `SELECT * FROM capsules
     WHERE capsule_type_id = ?
     ORDER BY updated_at DESC;`,
    capsuleTypeId,
  ) as CapsuleRow[];
  return rows.map(rowToCapsule);
}

export function getCapsuleById(db: SQLiteDatabase, id: string): Capsule | null {
  const row = db.getFirstSync(
    "SELECT * FROM capsules WHERE id = ?;",
    id,
  ) as CapsuleRow | null;
  return row ? rowToCapsule(row) : null;
}

export function insertCapsule(db: SQLiteDatabase, capsule: Capsule): void {
  db.runSync(
    `INSERT INTO capsules (id, capsule_type_id, title, parent_capsule_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?);`,
    capsule.id,
    capsule.capsuleTypeId,
    capsule.title,
    capsule.parentCapsuleId,
    capsule.createdAt,
    capsule.updatedAt,
  );
}

/** Every capsule whose `parentCapsuleId` is this one — the "children of X" query nesting exists for. */
export function getChildCapsules(
  db: SQLiteDatabase,
  parentId: string,
): Capsule[] {
  const rows = db.getAllSync(
    `SELECT * FROM capsules WHERE parent_capsule_id = ? ORDER BY updated_at DESC;`,
    parentId,
  ) as CapsuleRow[];
  return rows.map(rowToCapsule);
}

export function updateCapsule(
  db: SQLiteDatabase,
  id: string,
  patch: Partial<Omit<Capsule, "id" | "capsuleTypeId">>,
): void {
  const fields: string[] = [];
  const values: unknown[] = [];

  if (patch.title !== undefined) {
    fields.push("title = ?");
    values.push(patch.title);
  }
  if (patch.parentCapsuleId !== undefined) {
    fields.push("parent_capsule_id = ?");
    values.push(patch.parentCapsuleId);
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
    `UPDATE capsules SET ${fields.join(", ")} WHERE id = ?;`,
    ...(values as SQLiteVariadicBindParams),
  );
}

export function deleteCapsule(db: SQLiteDatabase, id: string): void {
  db.runSync("DELETE FROM capsules WHERE id = ?;", id);
}

/**
 * Clears `parent_capsule_id` on every direct child of `parentId`, promoting
 * them back to root-level capsules — called from `features/delete-capsule`'s
 * cascade before the parent record itself is removed. Active cleanup, not
 * graceful degradation: unlike cross-entity references (CapsuleType,
 * CapsuleLink target), nesting is a same-entity structural field, so a
 * dangling `parent_capsule_id` would silently orphan a child from every
 * "children of X" query rather than just degrading one display.
 */
export function orphanChildCapsules(
  db: SQLiteDatabase,
  parentId: string,
): void {
  db.runSync(
    "UPDATE capsules SET parent_capsule_id = NULL WHERE parent_capsule_id = ?;",
    parentId,
  );
}

// --- CapsuleValue ---

export function getValuesByCapsule(
  db: SQLiteDatabase,
  capsuleId: string,
): CapsuleValue[] {
  const rows = db.getAllSync(
    "SELECT * FROM capsule_values WHERE capsule_id = ?;",
    capsuleId,
  ) as CapsuleValueRow[];
  return rows.map(rowToCapsuleValue);
}

export function getValueByCapsuleAndField(
  db: SQLiteDatabase,
  capsuleId: string,
  fieldId: string,
): CapsuleValue | null {
  const row = db.getFirstSync(
    "SELECT * FROM capsule_values WHERE capsule_id = ? AND field_id = ?;",
    capsuleId,
    fieldId,
  ) as CapsuleValueRow | null;
  return row ? rowToCapsuleValue(row) : null;
}

/**
 * Sets a field's value on a capsule — inserts a new row if none exists yet
 * for this (capsule, field) pair, otherwise updates the existing row's
 * `value`/`updated_at` in place. The existing row's own `id` and
 * `created_at` are preserved on an update (never overwritten by the
 * caller-supplied ones) — a value's identity shouldn't change just because
 * its content did.
 */
export function upsertCapsuleValue(
  db: SQLiteDatabase,
  value: CapsuleValue,
): void {
  db.runSync(
    `INSERT INTO capsule_values (id, capsule_id, field_id, value, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(capsule_id, field_id) DO UPDATE SET
       value = excluded.value,
       updated_at = excluded.updated_at;`,
    value.id,
    value.capsuleId,
    value.fieldId,
    value.value,
    value.createdAt,
    value.updatedAt,
  );
}

/** Removes every value belonging to one capsule — e.g. before deleting the capsule itself (composed by the feature layer, not automatic here). */
export function deleteValuesByCapsule(
  db: SQLiteDatabase,
  capsuleId: string,
): void {
  db.runSync("DELETE FROM capsule_values WHERE capsule_id = ?;", capsuleId);
}

// --- CapsuleEmbedding (7.2) ---

export const capsuleEmbeddingsMigration: Migration = {
  version: 18,
  up: (db: SQLiteDatabase) => {
    db.execSync(`
      CREATE TABLE IF NOT EXISTS capsule_embeddings (
        capsule_id TEXT PRIMARY KEY,
        embedding TEXT NOT NULL,
        content TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);
  },
};

export function getEmbeddingByCapsule(
  db: SQLiteDatabase,
  capsuleId: string,
): CapsuleEmbedding | null {
  const row = db.getFirstSync(
    "SELECT * FROM capsule_embeddings WHERE capsule_id = ?;",
    capsuleId,
  ) as CapsuleEmbeddingRow | null;
  return row ? rowToCapsuleEmbedding(row) : null;
}

export function getAllEmbeddings(db: SQLiteDatabase): CapsuleEmbedding[] {
  const rows = db.getAllSync(
    "SELECT * FROM capsule_embeddings;",
  ) as CapsuleEmbeddingRow[];
  return rows.map(rowToCapsuleEmbedding);
}

/**
 * Replaces one capsule's embedding wholesale — `PRIMARY KEY(capsule_id)`
 * plus `ON CONFLICT` means a re-index never leaves a stale second row
 * behind, mirroring `upsertCapsuleValue`'s own "callers don't need to
 * check first" ergonomics.
 */
export function upsertEmbedding(
  db: SQLiteDatabase,
  embedding: CapsuleEmbedding,
): void {
  db.runSync(
    `INSERT INTO capsule_embeddings (capsule_id, embedding, content, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(capsule_id) DO UPDATE SET
       embedding = excluded.embedding,
       content = excluded.content,
       updated_at = excluded.updated_at;`,
    embedding.capsuleId,
    JSON.stringify(embedding.embedding),
    embedding.content,
    embedding.updatedAt,
  );
}

export function deleteEmbedding(db: SQLiteDatabase, capsuleId: string): void {
  db.runSync("DELETE FROM capsule_embeddings WHERE capsule_id = ?;", capsuleId);
}

// --- CapsuleVersion (8.5, "version history") ---

/**
 * Column is `values_json`, not `values` — SQLite tolerates `VALUES` as an
 * identifier in most contexts, but it's a real SQL keyword and not worth
 * the ambiguity risk for a column name that will live in raw SQL strings
 * for the life of this table.
 */
export const capsuleVersionsMigration: Migration = {
  version: 21,
  up: (db: SQLiteDatabase) => {
    db.execSync(`
      CREATE TABLE IF NOT EXISTS capsule_versions (
        id TEXT PRIMARY KEY,
        capsule_id TEXT NOT NULL,
        title TEXT NOT NULL,
        values_json TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
    `);
  },
};

export function insertCapsuleVersion(
  db: SQLiteDatabase,
  version: CapsuleVersion,
): void {
  db.runSync(
    `INSERT INTO capsule_versions (id, capsule_id, title, values_json, created_at)
     VALUES (?, ?, ?, ?, ?);`,
    version.id,
    version.capsuleId,
    version.title,
    JSON.stringify(version.values),
    version.createdAt,
  );
}

export function getVersionById(
  db: SQLiteDatabase,
  id: string,
): CapsuleVersion | null {
  const row = db.getFirstSync(
    "SELECT * FROM capsule_versions WHERE id = ?;",
    id,
  ) as CapsuleVersionRow | null;
  return row ? rowToCapsuleVersion(row) : null;
}

/** Every past version of one capsule, most recent first. */
export function getVersionsByCapsule(
  db: SQLiteDatabase,
  capsuleId: string,
): CapsuleVersion[] {
  const rows = db.getAllSync(
    `SELECT * FROM capsule_versions WHERE capsule_id = ? ORDER BY created_at DESC;`,
    capsuleId,
  ) as CapsuleVersionRow[];
  return rows.map(rowToCapsuleVersion);
}

/** Removes every version belonging to one capsule — e.g. before deleting the capsule itself (composed by the feature layer, not automatic here). */
export function deleteVersionsByCapsule(
  db: SQLiteDatabase,
  capsuleId: string,
): void {
  db.runSync("DELETE FROM capsule_versions WHERE capsule_id = ?;", capsuleId);
}
