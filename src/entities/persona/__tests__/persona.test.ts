// Tests for step 2.3 — written before implementation (TDD)
import type { SQLiteDatabase } from "expo-sqlite";
import { openDb, runMigrations, _resetDbForTesting } from "@/shared/db";
import {
  deletePersona,
  getAllPersonas,
  getPersonaById,
  insertPersona,
  personasMigration,
  updatePersona,
  type Persona,
} from "../index";

const makePersona = (overrides: Partial<Persona> = {}): Persona => ({
  id: `p-${Math.random().toString(36).slice(2)}`,
  name: "Helpful Assistant",
  systemPrompt: "You are a helpful assistant.",
  createdAt: 1000,
  updatedAt: 1000,
  ...overrides,
});

let db: SQLiteDatabase;

beforeEach(() => {
  _resetDbForTesting();
  db = openDb();
  runMigrations(db, [personasMigration]);
});

describe("entities/persona — happy path", () => {
  it("inserts and retrieves a persona", () => {
    const persona = makePersona();
    insertPersona(db, persona);
    const found = getPersonaById(db, persona.id);
    expect(found?.id).toBe(persona.id);
    expect(found?.name).toBe("Helpful Assistant");
    expect(found?.systemPrompt).toBe("You are a helpful assistant.");
  });

  it("getAllPersonas orders by updatedAt descending", () => {
    insertPersona(db, makePersona({ id: "old", updatedAt: 100 }));
    insertPersona(db, makePersona({ id: "new", updatedAt: 300 }));
    insertPersona(db, makePersona({ id: "mid", updatedAt: 200 }));
    expect(getAllPersonas(db).map((p) => p.id)).toEqual(["new", "mid", "old"]);
  });

  it("updates name and systemPrompt", () => {
    const persona = makePersona();
    insertPersona(db, persona);
    updatePersona(db, persona.id, {
      name: "Pirate",
      systemPrompt: "Answer like a pirate.",
      updatedAt: 2000,
    });
    const found = getPersonaById(db, persona.id);
    expect(found?.name).toBe("Pirate");
    expect(found?.systemPrompt).toBe("Answer like a pirate.");
    expect(found?.updatedAt).toBe(2000);
  });

  it("deletes a persona", () => {
    const persona = makePersona();
    insertPersona(db, persona);
    deletePersona(db, persona.id);
    expect(getPersonaById(db, persona.id)).toBeNull();
  });
});

describe("entities/persona — edge cases", () => {
  it("getPersonaById returns null for unknown id", () => {
    expect(getPersonaById(db, "nope")).toBeNull();
  });

  it("getAllPersonas returns an empty array when none exist", () => {
    expect(getAllPersonas(db)).toEqual([]);
  });

  it("updatePersona with an empty patch leaves the persona unchanged", () => {
    const persona = makePersona();
    insertPersona(db, persona);
    expect(() => updatePersona(db, persona.id, {})).not.toThrow();
    expect(getPersonaById(db, persona.id)?.name).toBe(persona.name);
  });

  it("deleting an unknown id does not throw", () => {
    expect(() => deletePersona(db, "missing")).not.toThrow();
  });

  it("preserves multi-line system prompts", () => {
    const prompt = "Line one.\nLine two.\n\nLine four.";
    const persona = makePersona({ systemPrompt: prompt });
    insertPersona(db, persona);
    expect(getPersonaById(db, persona.id)?.systemPrompt).toBe(prompt);
  });
});

describe("entities/persona — error handling", () => {
  it("throws on duplicate id insert", () => {
    insertPersona(db, makePersona({ id: "dup" }));
    expect(() => insertPersona(db, makePersona({ id: "dup" }))).toThrow();
  });
});
