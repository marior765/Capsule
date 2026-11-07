// Tests for step 10.49 — written before implementation (TDD)
//
// An exported conversation kept its personaId, but the persona itself wasn't
// in the file, so on another device the id dangled (the chat still worked;
// its system prompt just stopped applying). Now the export carries the
// persona and the import adds it if this device lacks it. Files from before
// 10.49 still import; an unknown personaId without a persona is cleared
// rather than left dangling.
import type { SQLiteDatabase } from "expo-sqlite";
import { openDb, runMigrations, _resetDbForTesting } from "@/shared/db";
import {
  conversationsLeafMigration,
  conversationsMigration,
  conversationsPersonaMigration,
  insertConversation,
  type Conversation,
} from "@/entities/conversation";
import {
  messagesMigration,
  messagesParentMigration,
  messageSourcesMigration,
} from "@/entities/message";
import { auditMigration, getAllAuditEntries } from "@/entities/audit";
import { getAllConversations } from "@/entities/conversation";
import {
  getAllPersonas,
  getPersonaById,
  insertPersona,
  personasMigration,
  updatePersona,
  type Persona,
} from "@/entities/persona";
import { serializePortable } from "@/shared/format";
import {
  exportAllConversations,
  exportConversation,
  importAllConversations,
  importConversation,
} from "../index";

let db: SQLiteDatabase;

/** A fresh, empty device. */
function freshDevice(): void {
  _resetDbForTesting();
  db = openDb();
  runMigrations(db, [
    conversationsMigration,
    conversationsPersonaMigration,
    conversationsLeafMigration,
    messagesMigration,
    messagesParentMigration,
    auditMigration,
    messageSourcesMigration,
    personasMigration,
  ]);
}

const pirate: Persona = {
  id: "persona-pirate",
  name: "Pirate",
  systemPrompt: "Answer like a pirate.",
  createdAt: 1000,
  updatedAt: 1000,
};

const conversation = (id: string, personaId: string | null): Conversation => ({
  id,
  title: `Chat ${id}`,
  modelId: null,
  personaId,
  activeLeafId: null,
  createdAt: 1000,
  updatedAt: 1000,
});

beforeEach(freshDevice);

describe("a conversation's persona travels with it (10.49)", () => {
  it("imports the persona on a device that doesn't have it", () => {
    insertPersona(db, pirate);
    insertConversation(db, conversation("c1", pirate.id));
    const json = exportConversation(db, "c1");

    freshDevice();
    const imported = importConversation(db, json);

    expect(imported.personaId).toBe(pirate.id);
    expect(getPersonaById(db, pirate.id)).toEqual(pirate);
  });

  it("keeps this device's version when the persona already exists (never overwrites)", () => {
    insertPersona(db, pirate);
    insertConversation(db, conversation("c1", pirate.id));
    const json = exportConversation(db, "c1");
    updatePersona(db, pirate.id, { systemPrompt: "Edited here." });

    const imported = importConversation(db, json);

    expect(imported.personaId).toBe(pirate.id);
    expect(getPersonaById(db, pirate.id)?.systemPrompt).toBe("Edited here.");
    expect(getAllPersonas(db)).toHaveLength(1);
  });

  it("importing the same file twice adds the persona once", () => {
    insertPersona(db, pirate);
    insertConversation(db, conversation("c1", pirate.id));
    const json = exportConversation(db, "c1");

    freshDevice();
    importConversation(db, json);
    importConversation(db, json);

    expect(getAllPersonas(db)).toHaveLength(1);
  });

  it("a conversation without a persona exports and imports without one", () => {
    insertConversation(db, conversation("c1", null));
    const json = exportConversation(db, "c1");

    freshDevice();
    expect(importConversation(db, json).personaId).toBeNull();
    expect(getAllPersonas(db)).toEqual([]);
  });

  it("the whole-vault export carries each conversation's persona", () => {
    const tutor: Persona = { ...pirate, id: "persona-tutor", name: "Tutor" };
    insertPersona(db, pirate);
    insertPersona(db, tutor);
    insertConversation(db, conversation("c1", pirate.id));
    insertConversation(db, conversation("c2", tutor.id));
    insertConversation(db, conversation("c3", pirate.id));
    const json = exportAllConversations(db);

    freshDevice();
    const imported = importAllConversations(db, json);

    expect(imported.map((c) => c.personaId).sort()).toEqual(
      [pirate.id, pirate.id, tutor.id].sort(),
    );
    expect(
      getAllPersonas(db)
        .map((p) => p.id)
        .sort(),
    ).toEqual([pirate.id, tutor.id].sort());
  });

  it("a persona deleted before export: the conversation imports without one", () => {
    insertConversation(db, conversation("c1", "persona-gone"));
    const json = exportConversation(db, "c1");

    freshDevice();
    expect(importConversation(db, json).personaId).toBeNull();
  });

  // Files exported before 10.49 have no persona in them.
  describe("older files (no persona inside)", () => {
    const oldFile = (personaId: string | null) =>
      serializePortable("conversation", {
        conversation: conversation("old", personaId),
        messages: [],
      });

    it("keep a personaId this device knows", () => {
      insertPersona(db, pirate);
      expect(importConversation(db, oldFile(pirate.id)).personaId).toBe(
        pirate.id,
      );
    });

    it("clear a personaId this device doesn't know (instead of dangling)", () => {
      expect(
        importConversation(db, oldFile("persona-elsewhere")).personaId,
      ).toBe(null);
    });
  });

  it("rejects a persona whose id doesn't match the conversation's personaId", () => {
    const tampered = serializePortable("conversation", {
      conversation: conversation("c1", "persona-a"),
      messages: [],
      persona: { ...pirate, id: "persona-b" },
    });
    const imported = importConversation(db, tampered);
    // The mismatched persona isn't added, and the id isn't left dangling.
    expect(getAllPersonas(db)).toEqual([]);
    expect(imported.personaId).toBeNull();
  });

  // Reviewer findings (10.49): a crafted file must not crash the import or
  // leave half of it behind.
  describe("crafted files", () => {
    const fileWith = (persona: unknown, personaId = "persona-x") =>
      serializePortable("conversation", {
        conversation: conversation("c1", personaId),
        messages: [],
        persona,
      });

    it.each([
      ["null", null],
      [
        "missing systemPrompt",
        { id: "persona-x", name: "X", createdAt: 1, updatedAt: 1 },
      ],
      [
        "wrong types",
        {
          id: "persona-x",
          name: 5,
          systemPrompt: 5,
          createdAt: "1",
          updatedAt: 1,
        },
      ],
    ])("ignores a malformed persona (%s) and clears the id", (_, persona) => {
      const imported = importConversation(db, fileWith(persona));
      expect(imported.personaId).toBeNull();
      expect(getAllPersonas(db)).toEqual([]);
    });

    it("imports a single conversation all-or-nothing", () => {
      const broken = serializePortable("conversation", {
        conversation: conversation("bad", null),
        messages: [{ conversationId: "bad" }],
      });
      expect(() => importConversation(db, broken)).toThrow();
      expect(getAllConversations(db)).toEqual([]);
    });

    it("imports a whole vault all-or-nothing", () => {
      const vault = serializePortable("vault", {
        conversations: [
          { conversation: conversation("ok", null), messages: [] },
          // A message that can't be inserted (no id) makes the import fail.
          {
            conversation: conversation("bad", null),
            messages: [{ conversationId: "bad" }],
          },
        ],
      });
      expect(() => importAllConversations(db, vault)).toThrow();
      expect(getAllConversations(db)).toEqual([]);
    });
  });

  it("the export's audit entry says a persona went with it", () => {
    insertPersona(db, pirate);
    insertConversation(db, conversation("c1", pirate.id));
    insertConversation(db, conversation("c2", null));
    exportConversation(db, "c1");
    exportConversation(db, "c2");
    exportAllConversations(db);
    const details = getAllAuditEntries(db).map((e) => e.detail ?? "");
    expect(details).toContain(
      'Conversation "Chat c1" (with its persona "Pirate")',
    );
    expect(details).toContain('Conversation "Chat c2"');
    expect(
      details.some((d) => /Whole vault \(2 conversations, 1 persona\)/.test(d)),
    ).toBe(true);
  });
});
