// Tests for step 1.5 — written before implementation (TDD)
import type { SQLiteDatabase } from "expo-sqlite";
import type { ChatMessage, LlamaContext } from "@/shared/llm";
import { openDb, runMigrations, _resetDbForTesting } from "@/shared/db";
import {
  conversationsLeafMigration,
  conversationsMigration,
  conversationsPersonaMigration,
  getConversationById,
  insertConversation,
  updateConversation,
} from "@/entities/conversation";
import {
  getMessagesByConversation,
  messagesMigration,
  messagesParentMigration,
} from "@/entities/message";
import { insertPersona, personasMigration } from "@/entities/persona";
import { DEFAULT_INFERENCE } from "@/shared/config";
import { sendMessage } from "../index";
import { runCompletion } from "@/shared/llm";

jest.mock("@/shared/llm");
const mockRunCompletion = runCompletion as jest.Mock;

const ctx = {} as LlamaContext;

let db: SQLiteDatabase;

beforeEach(() => {
  _resetDbForTesting();
  jest.clearAllMocks();
  db = openDb();
  runMigrations(db, [
    conversationsMigration,
    messagesMigration,
    personasMigration,
    conversationsPersonaMigration,
    messagesParentMigration,
    conversationsLeafMigration,
  ]);
  insertConversation(db, {
    id: "conv-1",
    title: "Chat",
    modelId: "model-1",
    personaId: null,
    activeLeafId: null,
    createdAt: 0,
    updatedAt: 0,
  });
  mockRunCompletion.mockImplementation(
    async (
      _ctx: LlamaContext,
      _params: { messages: ChatMessage[]; maxTokens: number },
      onToken: (t: string) => void,
    ) => {
      onToken("Hi");
      onToken(" there");
      return { text: "Hi there" };
    },
  );
});

describe("sendMessage — happy path", () => {
  it("persists the user message then the assistant message in order", async () => {
    await sendMessage(db, ctx, { conversationId: "conv-1", text: "Hello" });
    const messages = getMessagesByConversation(db, "conv-1");
    expect(messages.map((m) => m.role)).toEqual(["user", "assistant"]);
    expect(messages[0].content).toBe("Hello");
    expect(messages[1].content).toBe("Hi there");
  });

  it("returns both the user and assistant messages", async () => {
    const { userMessage, assistantMessage } = await sendMessage(db, ctx, {
      conversationId: "conv-1",
      text: "Hello",
    });
    expect(userMessage.role).toBe("user");
    expect(assistantMessage.role).toBe("assistant");
    expect(assistantMessage.content).toBe("Hi there");
  });

  it("streams tokens through onToken", async () => {
    const tokens: string[] = [];
    await sendMessage(
      db,
      ctx,
      { conversationId: "conv-1", text: "Hello" },
      (t) => tokens.push(t),
    );
    expect(tokens).toEqual(["Hi", " there"]);
  });

  it("bumps the conversation updatedAt", async () => {
    await sendMessage(db, ctx, { conversationId: "conv-1", text: "Hello" });
    expect(getConversationById(db, "conv-1")?.updatedAt).toBeGreaterThan(0);
  });
});

describe("sendMessage — edge cases", () => {
  it("records the assistant token count from the stream", async () => {
    const { assistantMessage } = await sendMessage(db, ctx, {
      conversationId: "conv-1",
      text: "Hello",
    });
    expect(assistantMessage.tokenCount).toBe(2);
  });
});

describe("sendMessage — error handling", () => {
  it("keeps the user message and persists no assistant message when the LLM fails", async () => {
    mockRunCompletion.mockRejectedValueOnce(new Error("llm failure"));
    await expect(
      sendMessage(db, ctx, { conversationId: "conv-1", text: "Hello" }),
    ).rejects.toThrow();
    const messages = getMessagesByConversation(db, "conv-1");
    expect(messages.map((m) => m.role)).toEqual(["user"]);
  });
});

// --- step 2.1 / 2.3 wiring ---

/** The chat turns handed to the LLM on the first call. */
const sentMessages = () =>
  mockRunCompletion.mock.calls[0][1].messages as ChatMessage[];

describe("sendMessage — persona system prompt (2.3)", () => {
  beforeEach(() => {
    insertPersona(db, {
      id: "persona-1",
      name: "Pirate",
      systemPrompt: "Answer like a pirate.",
      createdAt: 0,
      updatedAt: 0,
    });
  });

  it("prepends the persona's system prompt when the conversation has one", async () => {
    updateConversation(db, "conv-1", { personaId: "persona-1" });
    await sendMessage(db, ctx, { conversationId: "conv-1", text: "Hello" });
    expect(sentMessages()[0]).toEqual({
      role: "system",
      content: "Answer like a pirate.",
    });
  });

  it("sends no system turn when the conversation has no persona", async () => {
    await sendMessage(db, ctx, { conversationId: "conv-1", text: "Hello" });
    expect(sentMessages().some((m) => m.role === "system")).toBe(false);
  });

  it("degrades gracefully when the persona was deleted (dangling personaId)", async () => {
    updateConversation(db, "conv-1", { personaId: "deleted-persona" });
    await expect(
      sendMessage(db, ctx, { conversationId: "conv-1", text: "Hello" }),
    ).resolves.toBeDefined();
    expect(sentMessages()).toEqual([{ role: "user", content: "Hello" }]);
  });
});

describe("sendMessage — inference settings (2.1)", () => {
  it("forwards the provided settings to runCompletion", async () => {
    await sendMessage(
      db,
      ctx,
      { conversationId: "conv-1", text: "Hello" },
      undefined,
      { ...DEFAULT_INFERENCE, temperature: 0.11, topK: 7, seed: 42 },
    );
    const params = mockRunCompletion.mock.calls[0][1];
    expect(params.temperature).toBe(0.11);
    expect(params.topK).toBe(7);
    expect(params.seed).toBe(42);
  });

  it("falls back to the default settings when none are provided", async () => {
    await sendMessage(db, ctx, { conversationId: "conv-1", text: "Hello" });
    const params = mockRunCompletion.mock.calls[0][1];
    expect(params.temperature).toBe(DEFAULT_INFERENCE.temperature);
    expect(params.topP).toBe(DEFAULT_INFERENCE.topP);
  });
});
