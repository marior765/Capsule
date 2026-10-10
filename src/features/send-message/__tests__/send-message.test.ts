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
  getSourcesByMessage,
  getImageByMessage,
  messageImagesMigration,
  messageSourcesMigration,
  messagesMigration,
  messagesParentMigration,
} from "@/entities/message";
import { insertPersona, personasMigration } from "@/entities/persona";
import { DEFAULT_INFERENCE } from "@/shared/config";
import { sendMessage } from "../index";
import { runCompletion } from "@/shared/llm";
import {
  File,
  __copiedFiles,
  __deletedUris,
  __resetFsMock,
} from "@/__mocks__/expo-file-system";

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

describe("sendMessage — capsule grounding (7.3)", () => {
  beforeEach(() => {
    insertPersona(db, {
      id: "persona-1",
      name: "Pirate",
      systemPrompt: "Answer like a pirate.",
      createdAt: 0,
      updatedAt: 0,
    });
  });

  it("sends the grounding prompt as the system turn when there's no persona", async () => {
    await sendMessage(db, ctx, {
      conversationId: "conv-1",
      text: "When is my dentist?",
      grounding: { prompt: "CAPSULES: Dentist — Tuesday 3pm", sources: [] },
    });
    expect(sentMessages()[0]).toEqual({
      role: "system",
      content: "CAPSULES: Dentist — Tuesday 3pm",
    });
  });

  it("appends the grounding prompt after the persona's prompt", async () => {
    updateConversation(db, "conv-1", { personaId: "persona-1" });
    await sendMessage(db, ctx, {
      conversationId: "conv-1",
      text: "Hello",
      grounding: { prompt: "CAPSULES: x", sources: [] },
    });
    expect(sentMessages()[0]).toEqual({
      role: "system",
      content: "Answer like a pirate.\n\nCAPSULES: x",
    });
  });

  it("never persists the grounding text — only the user's own words are stored", async () => {
    const { userMessage } = await sendMessage(db, ctx, {
      conversationId: "conv-1",
      text: "Hello",
      grounding: { prompt: "CAPSULES: secret capsule text", sources: [] },
    });
    expect(userMessage.content).toBe("Hello");
    const stored = getMessagesByConversation(db, "conv-1");
    expect(stored.some((m) => m.content.includes("secret capsule text"))).toBe(
      false,
    );
  });

  it("ignores an empty grounding prompt", async () => {
    await sendMessage(db, ctx, {
      conversationId: "conv-1",
      text: "Hello",
      grounding: { prompt: "   ", sources: [] },
    });
    expect(sentMessages().some((m) => m.role === "system")).toBe(false);
  });
});

describe("sendMessage — grounding sources (7.4)", () => {
  it("stores which capsules grounded the reply, against the assistant message", async () => {
    const { userMessage, assistantMessage } = await sendMessage(db, ctx, {
      conversationId: "conv-1",
      text: "When is my dentist?",
      grounding: {
        prompt: "CAPSULES: [1] Dentist",
        sources: [
          { capsuleId: "cap-1", title: "Dentist" },
          { capsuleId: "cap-2", title: "Insurance" },
        ],
      },
    });
    expect(
      getSourcesByMessage(db, assistantMessage.id).map((s) => s.title),
    ).toEqual(["Dentist", "Insurance"]);
    expect(getSourcesByMessage(db, userMessage.id)).toEqual([]);
  });

  it("stores no sources for an ungrounded reply, or when the completion fails", async () => {
    const { assistantMessage } = await sendMessage(db, ctx, {
      conversationId: "conv-1",
      text: "Hi",
    });
    expect(getSourcesByMessage(db, assistantMessage.id)).toEqual([]);

    mockRunCompletion.mockRejectedValueOnce(new Error("llm down"));
    await expect(
      sendMessage(db, ctx, {
        conversationId: "conv-1",
        text: "Hi",
        grounding: { prompt: "x", sources: [{ capsuleId: "c", title: "C" }] },
      }),
    ).rejects.toThrow();
    expect(
      db.getAllSync("SELECT * FROM message_sources;") as unknown[],
    ).toHaveLength(0);
  });
});

describe("sendMessage — blank grounding prompt", () => {
  it("stores no sources when the grounding prompt is blank (nothing actually grounded the reply)", async () => {
    const { assistantMessage } = await sendMessage(db, ctx, {
      conversationId: "conv-1",
      text: "Hi",
      grounding: { prompt: "   ", sources: [{ capsuleId: "c", title: "C" }] },
    });
    expect(getSourcesByMessage(db, assistantMessage.id)).toEqual([]);
  });
});

describe("sendMessage — images (8.4)", () => {
  beforeEach(() => __resetFsMock());

  const image = {
    sourceUri: "file:///cache/ImagePicker/IMG_1.jpg",
    name: "IMG 1.jpg",
    sourceIsTemporaryCopy: true,
  };

  it("copies the image into app storage, records it on the user message, and sends it to the model", async () => {
    const { userMessage } = await sendMessage(db, ctx, {
      conversationId: "conv-1",
      text: "What is this?",
      image,
      withImages: true,
    });

    expect(__copiedFiles).toHaveLength(1);
    expect(__copiedFiles[0].from).toBe(image.sourceUri);
    const stored = getImageByMessage(db, userMessage.id)!;
    expect(stored.path).toMatch(/^chat-images\/conv-1\//);
    expect(stored.path).not.toContain("file://");
    expect(`file:///document/${stored.path}`).toBe(__copiedFiles[0].to);

    const last = sentMessages()[sentMessages().length - 1];
    expect(last).toEqual({
      role: "user",
      content: "What is this?",
      imageUrl: __copiedFiles[0].to,
    });
  });

  it("keeps sending earlier images in the conversation history", async () => {
    await sendMessage(db, ctx, {
      conversationId: "conv-1",
      text: "Look",
      image,
    });
    mockRunCompletion.mockClear();
    await sendMessage(db, ctx, {
      conversationId: "conv-1",
      text: "And now?",
      withImages: true,
    });
    const withImages = sentMessages().filter((m) => m.imageUrl);
    expect(withImages).toHaveLength(1);
    expect(withImages[0].content).toBe("Look");
  });

  it("deletes the picker's temporary copy after storing the image", async () => {
    await sendMessage(db, ctx, { conversationId: "conv-1", text: "x", image });
    expect(__deletedUris).toContain(image.sourceUri);
  });

  it("stores nothing if copying the image fails", async () => {
    const spy = jest
      .spyOn(File.prototype, "copy")
      .mockRejectedValueOnce(new Error("disk full"));
    await expect(
      sendMessage(db, ctx, { conversationId: "conv-1", text: "x", image }),
    ).rejects.toThrow("disk full");
    expect(getMessagesByConversation(db, "conv-1")).toEqual([]);
    expect(mockRunCompletion).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe("sendMessage — image storage failures leave nothing behind", () => {
  beforeEach(() => __resetFsMock());
  const image = { sourceUri: "file:///cache/ImagePicker/x.jpg", name: "x.jpg" };

  it("stores no user message (and deletes the copy) when the image row can't be written", async () => {
    _resetDbForTesting();
    db = openDb();
    runMigrations(db, [
      conversationsMigration,
      messagesMigration,
      personasMigration,
      conversationsPersonaMigration,
      messagesParentMigration,
      conversationsLeafMigration,
      messageSourcesMigration,
      // message_images deliberately missing → insertMessageImage throws
    ]);
    insertConversation(db, {
      id: "conv-1",
      title: "Chat",
      modelId: null,
      personaId: null,
      activeLeafId: null,
      createdAt: 0,
      updatedAt: 0,
    });

    await expect(
      sendMessage(db, ctx, { conversationId: "conv-1", text: "x", image }),
    ).rejects.toThrow(/no such table/);
    expect(getMessagesByConversation(db, "conv-1")).toEqual([]);
    expect(__deletedUris).toContain(__copiedFiles[0].to);
    expect(mockRunCompletion).not.toHaveBeenCalled();
  });
});

describe("sendMessage — images only go to a vision-capable model", () => {
  beforeEach(() => __resetFsMock());

  it("never sends stored images when withImages isn't set (e.g. the user switched to a text-only model)", async () => {
    await sendMessage(db, ctx, {
      conversationId: "conv-1",
      text: "Look",
      image: { sourceUri: "file:///cache/ImagePicker/a.jpg", name: "a.jpg" },
      withImages: true,
    });
    mockRunCompletion.mockClear();
    await sendMessage(db, ctx, {
      conversationId: "conv-1",
      text: "Later, text model",
    });
    expect(sentMessages().some((m) => m.imageUrl)).toBe(false);
  });
});
