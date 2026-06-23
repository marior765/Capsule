import type { SQLiteDatabase, SQLiteVariadicBindParams } from "expo-sqlite";
import type { Migration } from "@/shared/db";
import { rowToModel, type Model, type ModelRow } from "./model";

export const modelsMigration: Migration = {
  version: 1,
  up: (db: SQLiteDatabase) => {
    db.execSync(`
      CREATE TABLE IF NOT EXISTS models (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        path TEXT NOT NULL UNIQUE,
        size INTEGER NOT NULL,
        parameters TEXT NOT NULL,
        quantization TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 0,
        downloaded_at INTEGER NOT NULL
      );
    `);
  },
};

export function getAllModels(db: SQLiteDatabase): Model[] {
  const rows = db.getAllSync(
    "SELECT * FROM models ORDER BY downloaded_at DESC;"
  ) as ModelRow[];
  return rows.map(rowToModel);
}

export function getModelById(
  db: SQLiteDatabase,
  id: string
): Model | null {
  const row = db.getFirstSync(
    "SELECT * FROM models WHERE id = ?;",
    id
  ) as ModelRow | null;
  return row ? rowToModel(row) : null;
}

export function getActiveModel(db: SQLiteDatabase): Model | null {
  const row = db.getFirstSync(
    "SELECT * FROM models WHERE is_active = 1 LIMIT 1;"
  ) as ModelRow | null;
  return row ? rowToModel(row) : null;
}

export function insertModel(db: SQLiteDatabase, model: Model): void {
  db.runSync(
    `INSERT INTO models (id, name, path, size, parameters, quantization, is_active, downloaded_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
    model.id,
    model.name,
    model.path,
    model.size,
    model.parameters,
    model.quantization,
    model.isActive ? 1 : 0,
    model.downloadedAt
  );
}

export function updateModel(
  db: SQLiteDatabase,
  id: string,
  patch: Partial<Omit<Model, "id">>
): void {
  const fields: string[] = [];
  const values: unknown[] = [];

  if (patch.name !== undefined) { fields.push("name = ?"); values.push(patch.name); }
  if (patch.path !== undefined) { fields.push("path = ?"); values.push(patch.path); }
  if (patch.size !== undefined) { fields.push("size = ?"); values.push(patch.size); }
  if (patch.parameters !== undefined) { fields.push("parameters = ?"); values.push(patch.parameters); }
  if (patch.quantization !== undefined) { fields.push("quantization = ?"); values.push(patch.quantization); }
  if (patch.isActive !== undefined) { fields.push("is_active = ?"); values.push(patch.isActive ? 1 : 0); }
  if (patch.downloadedAt !== undefined) { fields.push("downloaded_at = ?"); values.push(patch.downloadedAt); }

  if (fields.length === 0) return;

  values.push(id);
  db.runSync(
    `UPDATE models SET ${fields.join(", ")} WHERE id = ?;`,
    ...(values as SQLiteVariadicBindParams)
  );
}

export function deleteModel(db: SQLiteDatabase, id: string): void {
  db.runSync("DELETE FROM models WHERE id = ?;", id);
}

export function setActiveModel(db: SQLiteDatabase, id: string): void {
  db.execSync("UPDATE models SET is_active = 0;");
  db.runSync("UPDATE models SET is_active = 1 WHERE id = ?;", id);
}
