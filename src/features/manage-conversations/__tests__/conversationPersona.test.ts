// Tests for step 10.20 — written before implementation (TDD)
//
// Found in the simulator: once a chat was open there was no way to see or
// change its persona, and personas could seemingly only be deleted — editing
// hid behind an unlabelled tap on the row, with the form off-screen above.
import { readFileSync } from "fs";
import { join } from "path";
import type { SQLiteDatabase } from "expo-sqlite";
import { openDb, runMigrations, _resetDbForTesting } from "@/shared/db";
import {
  conversationsLeafMigration,
  conversationsMigration,
  conversationsPersonaMigration,
  getConversationById,
} from "@/entities/conversation";
import {
  deletePersona,
  insertPersona,
  personasMigration,
} from "@/entities/persona";
import {
  createConversation,
  getConversationPersona,
  setConversationPersona,
} from "../index";

let db: SQLiteDatabase;

const addPersona = (id: string, name: string) =>
  insertPersona(db, {
    id,
    name,
    systemPrompt: `You are ${name}.`,
    createdAt: 1,
    updatedAt: 1,
  });

beforeEach(() => {
  _resetDbForTesting();
  db = openDb();
  runMigrations(db, [
    conversationsMigration,
    conversationsPersonaMigration,
    conversationsLeafMigration,
    personasMigration,
  ]);
});

describe("setConversationPersona", () => {
  it("switches an open conversation to another persona and back to none", () => {
    addPersona("p1", "Reviewer");
    addPersona("p2", "Tutor");
    const conversation = createConversation(db, { personaId: "p1" });

    setConversationPersona(db, conversation.id, "p2");
    expect(getConversationById(db, conversation.id)?.personaId).toBe("p2");
    expect(getConversationPersona(db, conversation.id)?.name).toBe("Tutor");

    setConversationPersona(db, conversation.id, null);
    expect(getConversationById(db, conversation.id)?.personaId).toBeNull();
    expect(getConversationPersona(db, conversation.id)).toBeNull();
  });

  it("bumps updatedAt so the chat counts as recently touched", () => {
    addPersona("p1", "Reviewer");
    const conversation = createConversation(db);
    const before = getConversationById(db, conversation.id)!.updatedAt;
    jest.spyOn(Date, "now").mockReturnValue(before + 1000);
    setConversationPersona(db, conversation.id, "p1");
    jest.restoreAllMocks();
    expect(getConversationById(db, conversation.id)!.updatedAt).toBe(
      before + 1000,
    );
  });
});

describe("getConversationPersona", () => {
  it("is null when the persona was deleted (degrades, never throws)", () => {
    addPersona("p1", "Reviewer");
    const conversation = createConversation(db, { personaId: "p1" });
    deletePersona(db, "p1");
    expect(getConversationPersona(db, conversation.id)).toBeNull();
  });

  it("is null for an unknown conversation", () => {
    expect(getConversationPersona(db, "missing")).toBeNull();
  });
});

describe("chat screen persona control (static)", () => {
  const chat = readFileSync(
    join(__dirname, "../../../app/(app)/(tabs)/chat/[id].tsx"),
    "utf8",
  );

  it("shows the conversation's persona in the toolbar", () => {
    expect(chat).toMatch(/testIDs\.buttons\.persona/);
    expect(chat).toMatch(/Persona: /);
  });

  it("lets the user pick another one with the PersonaSelector", () => {
    expect(chat).toMatch(/<PersonaSelector/);
    expect(chat).toMatch(/setConversationPersona\(/);
  });
});

describe("personas screen (static)", () => {
  const screen = readFileSync(
    join(__dirname, "../../../app/(app)/personas/index.tsx"),
    "utf8",
  );

  it("has a visible Edit button on each persona", () => {
    expect(screen).toMatch(/testIDs\.buttons\.edit/);
    expect(screen).toMatch(/>Edit</);
  });

  it("brings the form into view when editing starts", () => {
    expect(screen).toMatch(/scrollTo\(\{ y: 0/);
  });
});
