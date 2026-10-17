// Tests for step 2.5 — written before implementation (TDD)
import type { SQLiteDatabase } from "expo-sqlite";
import {
  conversationsLeafMigration,
  conversationsMigration,
  conversationsPersonaMigration,
  getConversationById,
  insertConversation,
  updateConversation,
} from "@/entities/conversation";
import {
  getChildren,
  getMessagePath,
  getMessagesByConversation,
  getImageByMessage,
  getSourcesByMessage,
  insertMessage,
  insertMessageImage,
  messageImagesMigration,
  messageSourcesMigration,
  messagesMigration,
  messagesParentMigration,
  type Message,
} from "@/entities/message";
import { openDb, runMigrations, _resetDbForTesting } from "@/shared/db";
import type { ChatMessage, LlamaContext } from "@/shared/llm";
import { branchFromMessage, switchBranch } from "../index";
import { runCompletion } from "@/shared/llm";

jest.mock("@/shared/llm");
const mockRunCompletion = runCompletion as jest.Mock;

const ctx = {} as LlamaContext;

const makeMessage = (overrides: Partial<Message> = {}): Message => ({
  id: `m-${Math.random().toString(36).slice(2)}`,
  conversationId: "conv-1",
  parentId: null,
  role: "user",
  content: "…",
  tokenCount: 0,
  createdAt: 1000,
  ...overrides,
});

let db: SQLiteDatabase;

/**
 * Linear thread used by most tests:
 *   u1 → a1 → u2 → a2   (a2 is the active leaf)
 */
beforeEach(() => {
  _resetDbForTesting();
  jest.clearAllMocks();
  db = openDb();
  runMigrations(db, [
    conversationsMigration,
    messagesMigration,
    conversationsPersonaMigration,
    messagesParentMigration,
    conversationsLeafMigration,
    messageSourcesMigration,
    messageImagesMigration,
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

  insertMessage(
    db,
    makeMessage({
      id: "u1",
      parentId: null,
      role: "user",
      content: "First",
      createdAt: 1,
    }),
  );
  insertMessage(
    db,
    makeMessage({
      id: "a1",
      parentId: "u1",
      role: "assistant",
      content: "Reply one",
      createdAt: 2,
    }),
  );
  insertMessage(
    db,
    makeMessage({
      id: "u2",
      parentId: "a1",
      role: "user",
      content: "Original",
      createdAt: 3,
    }),
  );
  insertMessage(
    db,
    makeMessage({
      id: "a2",
      parentId: "u2",
      role: "assistant",
      content: "Reply two",
      createdAt: 4,
    }),
  );
  updateConversation(db, "conv-1", { activeLeafId: "a2" });

  mockRunCompletion.mockImplementation(
    async (
      _ctx: LlamaContext,
      _params: { messages: ChatMessage[] },
      onToken: (t: string) => void,
    ) => {
      onToken("New");
      onToken(" reply");
      return { text: "New reply" };
    },
  );
});

describe("branchFromMessage — happy path", () => {
  it("creates a sibling of the edited message rather than overwriting it", async () => {
    const { userMessage } = await branchFromMessage(db, ctx, "u2", "Edited");

    expect(userMessage.id).not.toBe("u2");
    expect(userMessage.parentId).toBe("a1"); // same parent → sibling
    expect(userMessage.content).toBe("Edited");
  });

  it("preserves the original branch", async () => {
    await branchFromMessage(db, ctx, "u2", "Edited");

    const ids = getMessagesByConversation(db, "conv-1").map((m) => m.id);
    expect(ids).toContain("u2");
    expect(ids).toContain("a2");
  });

  it("makes the new branch active", async () => {
    const { assistantMessage } = await branchFromMessage(
      db,
      ctx,
      "u2",
      "Edited",
    );
    expect(getConversationById(db, "conv-1")?.activeLeafId).toBe(
      assistantMessage.id,
    );
  });

  it("the active path follows the new branch, not the original", async () => {
    const { userMessage, assistantMessage } = await branchFromMessage(
      db,
      ctx,
      "u2",
      "Edited",
    );

    const path = getMessagePath(db, assistantMessage.id).map((m) => m.id);
    expect(path).toEqual(["u1", "a1", userMessage.id, assistantMessage.id]);
    expect(path).not.toContain("u2");
  });

  it("generates a reply on the new branch", async () => {
    const { assistantMessage } = await branchFromMessage(
      db,
      ctx,
      "u2",
      "Edited",
    );
    expect(assistantMessage.role).toBe("assistant");
    expect(assistantMessage.content).toBe("New reply");
    expect(assistantMessage.parentId).not.toBeNull();
  });

  it("builds the chat turns from the edited path, excluding the original text", async () => {
    await branchFromMessage(db, ctx, "u2", "Edited");
    const messages = mockRunCompletion.mock.calls[0][1]
      .messages as ChatMessage[];
    expect(messages.map((m) => m.content)).toContain("Edited");
    expect(messages.map((m) => m.content)).not.toContain("Original");
  });

  it("streams tokens through onToken", async () => {
    const tokens: string[] = [];
    await branchFromMessage(db, ctx, "u2", "Edited", (t) => tokens.push(t));
    expect(tokens).toEqual(["New", " reply"]);
  });
});

describe("branchFromMessage — edge cases", () => {
  it("exposes both branches as siblings", async () => {
    const { userMessage } = await branchFromMessage(db, ctx, "u2", "Edited");
    const siblings = getChildren(db, "a1").map((m) => m.id);
    expect(siblings).toEqual(expect.arrayContaining(["u2", userMessage.id]));
    expect(siblings).toHaveLength(2);
  });

  it("can branch from the first message (a root sibling)", async () => {
    const { userMessage } = await branchFromMessage(
      db,
      ctx,
      "u1",
      "Different start",
    );
    expect(userMessage.parentId).toBeNull();
    expect(getChildren(db, null)).toHaveLength(2);
  });
});

describe("branchFromMessage — error handling", () => {
  it("throws for an unknown message id", async () => {
    await expect(
      branchFromMessage(db, ctx, "missing", "Edited"),
    ).rejects.toThrow();
  });

  it("refuses to branch from an assistant message", async () => {
    await expect(branchFromMessage(db, ctx, "a1", "Edited")).rejects.toThrow();
  });

  it("leaves the original branch active when generation fails", async () => {
    mockRunCompletion.mockRejectedValueOnce(new Error("llm failure"));
    await expect(branchFromMessage(db, ctx, "u2", "Edited")).rejects.toThrow();
    expect(getMessagePath(db, "a2").map((m) => m.id)).toEqual([
      "u1",
      "a1",
      "u2",
      "a2",
    ]);
  });
});

describe("switchBranch", () => {
  it("moves the active leaf back to a previous branch", async () => {
    const { assistantMessage } = await branchFromMessage(
      db,
      ctx,
      "u2",
      "Edited",
    );
    expect(getConversationById(db, "conv-1")?.activeLeafId).toBe(
      assistantMessage.id,
    );

    switchBranch(db, "conv-1", "a2");
    expect(getConversationById(db, "conv-1")?.activeLeafId).toBe("a2");
    expect(getMessagePath(db, "a2").map((m) => m.id)).toEqual([
      "u1",
      "a1",
      "u2",
      "a2",
    ]);
  });

  it("does not throw for an unknown conversation", () => {
    expect(() => switchBranch(db, "missing", "a2")).not.toThrow();
  });
});

describe("branchFromMessage — capsule grounding (7.3)", () => {
  const sent = (): ChatMessage[] =>
    (mockRunCompletion.mock.calls[0][1] as { messages: ChatMessage[] })
      .messages;

  it("sends the grounding prompt as the system turn for an edited message too", async () => {
    await branchFromMessage(
      db,
      ctx,
      "u2",
      "Edited question",
      undefined,
      undefined,
      { prompt: "CAPSULES: [1] Dentist", sources: [] },
    );
    expect(sent()[0]).toEqual({
      role: "system",
      content: "CAPSULES: [1] Dentist",
    });
  });

  it("never stores the grounding text", async () => {
    await branchFromMessage(db, ctx, "u2", "Edited", undefined, undefined, {
      prompt: "CAPSULES: private",
      sources: [],
    });
    expect(
      getMessagesByConversation(db, "conv-1").some((m) =>
        m.content.includes("CAPSULES"),
      ),
    ).toBe(false);
  });
});

describe("branchFromMessage — grounding sources (7.4)", () => {
  it("stores the sources against the new assistant reply", async () => {
    const { assistantMessage } = await branchFromMessage(
      db,
      ctx,
      "u2",
      "Edited",
      undefined,
      undefined,
      {
        prompt: "CAPSULES",
        sources: [{ capsuleId: "cap-1", title: "Dentist" }],
      },
    );
    expect(
      getSourcesByMessage(db, assistantMessage.id).map((s) => s.capsuleId),
    ).toEqual(["cap-1"]);
  });
});

describe("branchFromMessage — blank grounding prompt", () => {
  it("stores no sources when the grounding prompt is blank", async () => {
    const { assistantMessage } = await branchFromMessage(
      db,
      ctx,
      "u2",
      "Edited",
      undefined,
      undefined,
      { prompt: "  ", sources: [{ capsuleId: "cap-1", title: "D" }] },
    );
    expect(getSourcesByMessage(db, assistantMessage.id)).toEqual([]);
  });
});

describe("branchFromMessage — images (8.4)", () => {
  it("an edited message keeps the original message's image, and sends it to the model", async () => {
    insertMessageImage(db, {
      messageId: "u2",
      conversationId: "conv-1",
      path: "chat-images/conv-1/u2-photo.jpg",
    });
    const { userMessage } = await branchFromMessage(
      db,
      ctx,
      "u2",
      "Edited question",
      undefined,
      undefined,
      undefined,
      { withImages: true },
    );
    expect(getImageByMessage(db, userMessage.id)?.path).toBe(
      "chat-images/conv-1/u2-photo.jpg",
    );
    const sent = (
      mockRunCompletion.mock.calls[0][1] as { messages: ChatMessage[] }
    ).messages;
    expect(sent[sent.length - 1]).toEqual({
      role: "user",
      content: "Edited question",
      imageUrl: "file:///document/chat-images/conv-1/u2-photo.jpg",
    });
  });
});

describe("branchFromMessage — images only for a vision-capable model", () => {
  it("keeps the image row but doesn't send it without withImages", async () => {
    insertMessageImage(db, {
      messageId: "u2",
      conversationId: "conv-1",
      path: "chat-images/conv-1/u2.jpg",
    });
    const { userMessage } = await branchFromMessage(db, ctx, "u2", "Edited");
    expect(getImageByMessage(db, userMessage.id)).not.toBeNull();
    const sent = (
      mockRunCompletion.mock.calls[0][1] as { messages: ChatMessage[] }
    ).messages;
    expect(sent.some((m) => m.imageUrl)).toBe(false);
  });
});

// Step 10.16 — an edited (branched) turn reports the context it now takes,
// same contract as sendMessage.
describe("branchFromMessage — context in use (10.16)", () => {
  it("returns prompt + generated tokens", async () => {
    mockRunCompletion.mockResolvedValueOnce({
      text: "Reply",
      promptTokens: 300,
      generatedTokens: 20,
    });
    const { contextTokens } = await branchFromMessage(db, ctx, "u2", "Edited");
    expect(contextTokens).toBe(320);
  });
});
