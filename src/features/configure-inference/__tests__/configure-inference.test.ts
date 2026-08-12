// Tests for step 2.1 — written before implementation (TDD)
import type { SQLiteDatabase } from "expo-sqlite";
import {
  conversationsLeafMigration,
  conversationsMigration,
  conversationsPersonaMigration,
  getConversationById,
  insertConversation,
} from "@/entities/conversation";
import { insertPersona, personasMigration } from "@/entities/persona";
import { DEFAULT_INFERENCE } from "@/shared/config";
import { openDb, runMigrations, _resetDbForTesting } from "@/shared/db";
import { setString } from "@/shared/storage";
import {
  getInferenceSettings,
  requiresModelReload,
  resetInferenceSettings,
  selectPersona,
  updateInferenceSettings,
} from "../index";

let db: SQLiteDatabase;

beforeEach(() => {
  resetInferenceSettings();
  _resetDbForTesting();
  db = openDb();
  runMigrations(db, [
    conversationsMigration,
    personasMigration,
    conversationsPersonaMigration,
    conversationsLeafMigration,
  ]);
});

describe("inference settings — happy path", () => {
  it("returns the defaults when nothing has been stored", () => {
    expect(getInferenceSettings()).toEqual(DEFAULT_INFERENCE);
  });

  it("persists a partial patch and leaves other fields at their defaults", () => {
    updateInferenceSettings({ temperature: 0.2 });
    const settings = getInferenceSettings();
    expect(settings.temperature).toBe(0.2);
    expect(settings.topK).toBe(DEFAULT_INFERENCE.topK);
    expect(settings.seed).toBe(DEFAULT_INFERENCE.seed);
  });

  it("merges successive updates", () => {
    updateInferenceSettings({ temperature: 0.2 });
    updateInferenceSettings({ topP: 0.5 });
    const settings = getInferenceSettings();
    expect(settings.temperature).toBe(0.2);
    expect(settings.topP).toBe(0.5);
  });

  it("returns the merged settings from updateInferenceSettings", () => {
    const returned = updateInferenceSettings({ topK: 7 });
    expect(returned.topK).toBe(7);
    expect(returned).toEqual(getInferenceSettings());
  });

  it("resets back to the defaults", () => {
    updateInferenceSettings({ temperature: 0.1, topK: 1 });
    resetInferenceSettings();
    expect(getInferenceSettings()).toEqual(DEFAULT_INFERENCE);
  });
});

describe("inference settings — error handling", () => {
  it("falls back to the defaults when stored settings are corrupted", () => {
    setString("inference.settings", "{not json");
    expect(getInferenceSettings()).toEqual(DEFAULT_INFERENCE);
  });
});

describe("requiresModelReload", () => {
  it("is true when contextLength changes (n_ctx is an init param)", () => {
    expect(
      requiresModelReload({
        contextLength: DEFAULT_INFERENCE.contextLength * 2,
      }),
    ).toBe(true);
  });

  it("is false when contextLength is unchanged", () => {
    expect(
      requiresModelReload({ contextLength: DEFAULT_INFERENCE.contextLength }),
    ).toBe(false);
  });

  it("is false for sampling params, which apply per completion", () => {
    expect(requiresModelReload({ temperature: 0.1, topP: 0.5, seed: 42 })).toBe(
      false,
    );
  });

  it("is false for an empty patch", () => {
    expect(requiresModelReload({})).toBe(false);
  });
});

describe("selectPersona", () => {
  const conversation = {
    id: "conv-1",
    title: "Chat",
    modelId: "model-1",
    personaId: null,
    activeLeafId: null,
    createdAt: 0,
    updatedAt: 0,
  };

  beforeEach(() => {
    insertConversation(db, conversation);
    insertPersona(db, {
      id: "persona-1",
      name: "Pirate",
      systemPrompt: "Answer like a pirate.",
      createdAt: 0,
      updatedAt: 0,
    });
  });

  it("assigns a persona to a conversation", () => {
    selectPersona(db, "conv-1", "persona-1");
    expect(getConversationById(db, "conv-1")?.personaId).toBe("persona-1");
  });

  it("clears the persona when passed null", () => {
    selectPersona(db, "conv-1", "persona-1");
    selectPersona(db, "conv-1", null);
    expect(getConversationById(db, "conv-1")?.personaId).toBeNull();
  });

  it("does not throw for an unknown conversation", () => {
    expect(() => selectPersona(db, "missing", "persona-1")).not.toThrow();
  });
});
