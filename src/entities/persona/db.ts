import type { Migration } from "@/shared/db";
import type { SQLiteDatabase, SQLiteVariadicBindParams } from "expo-sqlite";
import { rowToPersona, type Persona, type PersonaRow } from "./model";

export const personasMigration: Migration = {
  version: 4,
  up: (db: SQLiteDatabase) => {
    db.execSync(`
      CREATE TABLE IF NOT EXISTS personas (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        system_prompt TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);
  },
};

export function getAllPersonas(db: SQLiteDatabase): Persona[] {
  const rows = db.getAllSync(
    "SELECT * FROM personas ORDER BY updated_at DESC;",
  ) as PersonaRow[];
  return rows.map(rowToPersona);
}

export function getPersonaById(db: SQLiteDatabase, id: string): Persona | null {
  const row = db.getFirstSync(
    "SELECT * FROM personas WHERE id = ?;",
    id,
  ) as PersonaRow | null;
  return row ? rowToPersona(row) : null;
}

export function insertPersona(db: SQLiteDatabase, persona: Persona): void {
  db.runSync(
    `INSERT INTO personas (id, name, system_prompt, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?);`,
    persona.id,
    persona.name,
    persona.systemPrompt,
    persona.createdAt,
    persona.updatedAt,
  );
}

export function updatePersona(
  db: SQLiteDatabase,
  id: string,
  patch: Partial<Omit<Persona, "id">>,
): void {
  const fields: string[] = [];
  const values: unknown[] = [];

  if (patch.name !== undefined) {
    fields.push("name = ?");
    values.push(patch.name);
  }
  if (patch.systemPrompt !== undefined) {
    fields.push("system_prompt = ?");
    values.push(patch.systemPrompt);
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
    `UPDATE personas SET ${fields.join(", ")} WHERE id = ?;`,
    ...(values as SQLiteVariadicBindParams),
  );
}

export function deletePersona(db: SQLiteDatabase, id: string): void {
  db.runSync("DELETE FROM personas WHERE id = ?;", id);
}
