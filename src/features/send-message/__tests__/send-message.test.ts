// Tests for step 1.5 — written before implementation (TDD)
import type { SQLiteDatabase } from "expo-sqlite";
import type { LlamaContext } from "@/shared/llm";
import { openDb, runMigrations, _resetDbForTesting } from "@/shared/db";
import {
  conversationsMigration,
  getConversationById,
  insertConversation,
} from "@/entities/conversation";
import {
  getMessagesByConversation,
  messagesMigration,
} from "@/entities/message";
import { sendMessage } from "../index";

jest.mock("@/shared/llm");
import { runCompletion } from "@/shared/llm";
const mockRunCompletion = runCompletion as jest.Mock;

const ctx = {} as LlamaContext;

let db: SQLiteDatabase;

beforeEach(() => {
  _resetDbForTesting();
  jest.clearAllMocks();
  db = openDb();
  runMigrations(db, [conversationsMigration, messagesMigration]);
  insertConversation(db, {
    id: "conv-1",
    title: "Chat",
    modelId: "model-1",
    createdAt: 0,
    updatedAt: 0,
  });
  mockRunCompletion.mockImplementation(
    async (
      _ctx: LlamaContext,
      _params: { prompt: string; maxTokens: number },
      onToken: (t: string) => void
    ) => {
      onToken("Hi");
      onToken(" there");
      return { text: "Hi there" };
    }
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
      (t) => tokens.push(t)
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
      sendMessage(db, ctx, { conversationId: "conv-1", text: "Hello" })
    ).rejects.toThrow();
    const messages = getMessagesByConversation(db, "conv-1");
    expect(messages.map((m) => m.role)).toEqual(["user"]);
  });
});
