import type { Migration } from "@/shared/db";
import type { SQLiteDatabase, SQLiteVariadicBindParams } from "expo-sqlite";
import {
  rowToCapsule,
  rowToCapsuleValue,
  type Capsule,
  type CapsuleRow,
  type CapsuleValue,
  type CapsuleValueRow,
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
    `INSERT INTO capsules (id, capsule_type_id, title, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?);`,
    capsule.id,
    capsule.capsuleTypeId,
    capsule.title,
    capsule.createdAt,
    capsule.updatedAt,
  );
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
