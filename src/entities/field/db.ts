import type { Migration } from "@/shared/db";
import type { SQLiteDatabase, SQLiteVariadicBindParams } from "expo-sqlite";
import {
  rowToCapsuleField,
  type CapsuleField,
  type CapsuleFieldRow,
} from "./model";

export const capsuleFieldsMigration: Migration = {
  version: 10,
  up: (db: SQLiteDatabase) => {
    db.execSync(`
      CREATE TABLE IF NOT EXISTS capsule_fields (
        id TEXT PRIMARY KEY,
        capsule_type_id TEXT NOT NULL,
        name TEXT NOT NULL,
        field_type TEXT NOT NULL,
        config TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        required INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);
  },
};

/** Fields belonging to one CapsuleType, in display order (not recency). */
export function getFieldsByCapsuleType(
  db: SQLiteDatabase,
  capsuleTypeId: string,
): CapsuleField[] {
  const rows = db.getAllSync(
    `SELECT * FROM capsule_fields
     WHERE capsule_type_id = ?
     ORDER BY sort_order ASC;`,
    capsuleTypeId,
  ) as CapsuleFieldRow[];
  return rows.map(rowToCapsuleField);
}

export function getCapsuleFieldById(
  db: SQLiteDatabase,
  id: string,
): CapsuleField | null {
  const row = db.getFirstSync(
    "SELECT * FROM capsule_fields WHERE id = ?;",
    id,
  ) as CapsuleFieldRow | null;
  return row ? rowToCapsuleField(row) : null;
}

export function insertCapsuleField(
  db: SQLiteDatabase,
  field: CapsuleField,
): void {
  db.runSync(
    `INSERT INTO capsule_fields
       (id, capsule_type_id, name, field_type, config, sort_order, required, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    field.id,
    field.capsuleTypeId,
    field.name,
    field.fieldType,
    field.config,
    field.sortOrder,
    field.required ? 1 : 0,
    field.createdAt,
    field.updatedAt,
  );
}

export function updateCapsuleField(
  db: SQLiteDatabase,
  id: string,
  patch: Partial<Omit<CapsuleField, "id" | "capsuleTypeId">>,
): void {
  const fields: string[] = [];
  const values: unknown[] = [];

  if (patch.name !== undefined) {
    fields.push("name = ?");
    values.push(patch.name);
  }
  if (patch.fieldType !== undefined) {
    fields.push("field_type = ?");
    values.push(patch.fieldType);
  }
  if (patch.config !== undefined) {
    fields.push("config = ?");
    values.push(patch.config);
  }
  if (patch.sortOrder !== undefined) {
    fields.push("sort_order = ?");
    values.push(patch.sortOrder);
  }
  if (patch.required !== undefined) {
    fields.push("required = ?");
    values.push(patch.required ? 1 : 0);
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
    `UPDATE capsule_fields SET ${fields.join(", ")} WHERE id = ?;`,
    ...(values as SQLiteVariadicBindParams),
  );
}

export function deleteCapsuleField(db: SQLiteDatabase, id: string): void {
  db.runSync("DELETE FROM capsule_fields WHERE id = ?;", id);
}
