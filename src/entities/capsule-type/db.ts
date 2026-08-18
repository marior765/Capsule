import type { Migration } from "@/shared/db";
import type { SQLiteDatabase, SQLiteVariadicBindParams } from "expo-sqlite";
import {
  rowToCapsuleType,
  type CapsuleType,
  type CapsuleTypeRow,
} from "./model";

export const capsuleTypesMigration: Migration = {
  version: 9,
  up: (db: SQLiteDatabase) => {
    db.execSync(`
      CREATE TABLE IF NOT EXISTS capsule_types (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);
  },
};

export function getAllCapsuleTypes(db: SQLiteDatabase): CapsuleType[] {
  const rows = db.getAllSync(
    "SELECT * FROM capsule_types ORDER BY updated_at DESC;",
  ) as CapsuleTypeRow[];
  return rows.map(rowToCapsuleType);
}

export function getCapsuleTypeById(
  db: SQLiteDatabase,
  id: string,
): CapsuleType | null {
  const row = db.getFirstSync(
    "SELECT * FROM capsule_types WHERE id = ?;",
    id,
  ) as CapsuleTypeRow | null;
  return row ? rowToCapsuleType(row) : null;
}

export function insertCapsuleType(
  db: SQLiteDatabase,
  capsuleType: CapsuleType,
): void {
  db.runSync(
    `INSERT INTO capsule_types (id, name, description, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?);`,
    capsuleType.id,
    capsuleType.name,
    capsuleType.description,
    capsuleType.createdAt,
    capsuleType.updatedAt,
  );
}

export function updateCapsuleType(
  db: SQLiteDatabase,
  id: string,
  patch: Partial<Omit<CapsuleType, "id">>,
): void {
  const fields: string[] = [];
  const values: unknown[] = [];

  if (patch.name !== undefined) {
    fields.push("name = ?");
    values.push(patch.name);
  }
  if (patch.description !== undefined) {
    fields.push("description = ?");
    values.push(patch.description);
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
    `UPDATE capsule_types SET ${fields.join(", ")} WHERE id = ?;`,
    ...(values as SQLiteVariadicBindParams),
  );
}

export function deleteCapsuleType(db: SQLiteDatabase, id: string): void {
  db.runSync("DELETE FROM capsule_types WHERE id = ?;", id);
}
