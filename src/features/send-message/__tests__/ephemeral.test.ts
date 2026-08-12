// Tests for step 2.6 — written before implementation (TDD)
import type { SQLiteDatabase } from "expo-sqlite";
import {
  conversationsLeafMigration,
  conversationsMigration,
  conversationsPersonaMigration,
  getAllConversations,
} from "@/entities/conversation";
import {
  getMessagesByConversation,
  messagesMigration,
  messagesParentMigration,
  type Message,
} from "@/entities/message";
import { DEFAULT_INFERENCE } from "@/shared/config";
import { openDb, runMigrations, _resetDbForTesting } from "@/shared/db";
import type { ChatMessage, LlamaContext } from "@/shared/llm";
import { buildMessages, sendEphemeralMessage } from "../index";
import { runCompletion } from "@/shared/llm";

jest.mock("@/shared/llm");
const mockRunCompletion = runCompletion as jest.Mock;

const ctx = {} as LlamaContext;

/** The chat turns handed to the LLM on the first call. */
const sentMessages = () =>
  mockRunCompletion.mock.calls[0][1].messages as ChatMessage[];

const makeMessage = (overrides: Partial<Message> = {}): Message => ({
  id: `m-${Math.random().toString(36).slice(2)}`,
  conversationId: "eph-1",
  parentId: null,
  role: "user",
  content: "Hello",
  tokenCount: 0,
  createdAt: 1000,
  ...overrides,
});

let db: SQLiteDatabase;

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
  ]);
  mockRunCompletion.mockImplementation(
    async (
      _ctx: LlamaContext,
      _params: { messages: ChatMessage[] },
      onToken: (t: string) => void,
    ) => {
      onToken("Hi");
      onToken(" there");
      return { text: "Hi there" };
    },
  );
});

describe("buildMessages", () => {
  it("maps history to chat turns, preserving role and order", () => {
    expect(
      buildMessages([
        makeMessage({ role: "user", content: "Hi" }),
        makeMessage({ role: "assistant", content: "Hello" }),
      ]),
    ).toEqual([
      { role: "user", content: "Hi" },
      { role: "assistant", content: "Hello" },
    ]);
  });

  it("prepends the system prompt as a system turn when one is given", () => {
    const messages = buildMessages(
      [makeMessage({ content: "Hi" })],
      "Be terse.",
    );
    expect(messages[0]).toEqual({ role: "system", content: "Be terse." });
  });

  it("omits the system turn when none is given", () => {
    const messages = buildMessages([makeMessage({ content: "Hi" })]);
    expect(messages.some((m) => m.role === "system")).toBe(false);
  });

  it("emits no prompt markup of its own — templating belongs to the model", () => {
    const messages = buildMessages([makeMessage({ content: "Hi" })]);
    expect(messages).toEqual([{ role: "user", content: "Hi" }]);
  });

  it("handles empty history", () => {
    expect(buildMessages([])).toEqual([]);
  });
});

describe("sendEphemeralMessage — privacy guarantee (2.6)", () => {
  it("writes nothing to the database", async () => {
    await sendEphemeralMessage(ctx, {
      conversationId: "eph-1",
      history: [],
      text: "This must never touch disk",
    });

    expect(getMessagesByConversation(db, "eph-1")).toEqual([]);
    expect(getAllConversations(db)).toEqual([]);
  });
});

describe("sendEphemeralMessage — happy path", () => {
  it("returns the user and assistant messages without persisting them", async () => {
    const { userMessage, assistantMessage } = await sendEphemeralMessage(ctx, {
      conversationId: "eph-1",
      history: [],
      text: "Hello",
    });

    expect(userMessage.role).toBe("user");
    expect(userMessage.content).toBe("Hello");
    expect(assistantMessage.role).toBe("assistant");
    expect(assistantMessage.content).toBe("Hi there");
  });

  it("streams tokens through onToken", async () => {
    const tokens: string[] = [];
    await sendEphemeralMessage(
      ctx,
      { conversationId: "eph-1", history: [], text: "Hello" },
      (t) => tokens.push(t),
    );
    expect(tokens).toEqual(["Hi", " there"]);
  });

  it("records the assistant token count from the stream", async () => {
    const { assistantMessage } = await sendEphemeralMessage(ctx, {
      conversationId: "eph-1",
      history: [],
      text: "Hello",
    });
    expect(assistantMessage.tokenCount).toBe(2);
  });

  it("includes the in-memory history in the chat turns", async () => {
    await sendEphemeralMessage(ctx, {
      conversationId: "eph-1",
      history: [makeMessage({ role: "user", content: "Earlier turn" })],
      text: "Follow up",
    });
    expect(sentMessages()).toEqual([
      { role: "user", content: "Earlier turn" },
      { role: "user", content: "Follow up" },
    ]);
  });

  it("applies a system prompt when provided", async () => {
    await sendEphemeralMessage(ctx, {
      conversationId: "eph-1",
      history: [],
      text: "Hello",
      systemPrompt: "Answer like a pirate.",
    });
    expect(sentMessages()[0]).toEqual({
      role: "system",
      content: "Answer like a pirate.",
    });
  });
});

describe("sendEphemeralMessage — edge cases", () => {
  it("chains parentId onto the last message of the history", async () => {
    const previous = makeMessage({ id: "prev", role: "assistant" });
    const { userMessage, assistantMessage } = await sendEphemeralMessage(ctx, {
      conversationId: "eph-1",
      history: [previous],
      text: "Follow up",
    });
    expect(userMessage.parentId).toBe("prev");
    expect(assistantMessage.parentId).toBe(userMessage.id);
  });

  it("starts a root message when the history is empty", async () => {
    const { userMessage } = await sendEphemeralMessage(ctx, {
      conversationId: "eph-1",
      history: [],
      text: "Hello",
    });
    expect(userMessage.parentId).toBeNull();
  });

  it("forwards inference settings to runCompletion", async () => {
    await sendEphemeralMessage(
      ctx,
      { conversationId: "eph-1", history: [], text: "Hello" },
      undefined,
      { ...DEFAULT_INFERENCE, temperature: 0.11, seed: 42 },
    );
    const params = mockRunCompletion.mock.calls[0][1];
    expect(params.temperature).toBe(0.11);
    expect(params.seed).toBe(42);
  });
});

describe("sendEphemeralMessage — error handling", () => {
  it("propagates an LLM failure and still writes nothing", async () => {
    mockRunCompletion.mockRejectedValueOnce(new Error("llm failure"));
    await expect(
      sendEphemeralMessage(ctx, {
        conversationId: "eph-1",
        history: [],
        text: "Hello",
      }),
    ).rejects.toThrow();
    expect(getMessagesByConversation(db, "eph-1")).toEqual([]);
  });
});
