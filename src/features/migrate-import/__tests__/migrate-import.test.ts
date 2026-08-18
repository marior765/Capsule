// Tests for step 5.4 — written before implementation (TDD)
// ChatGPT export scope only this beat — see the module doc comment and
// .claude/loop/BLOCKED.md for why Claude export/CSV/generic JSON/Markdown
// are deferred, and for the field-schema caveat on this parser.
import type { SQLiteDatabase } from "expo-sqlite";
import { openDb, runMigrations, _resetDbForTesting } from "@/shared/db";
import {
  conversationsLeafMigration,
  conversationsMigration,
  conversationsPersonaMigration,
  getAllConversations,
  getConversationById,
} from "@/entities/conversation";
import {
  getMessagesByConversation,
  messagesMigration,
  messagesParentMigration,
} from "@/entities/message";
import { parseChatGptExport, importChatGptExport } from "../index";

let db: SQLiteDatabase;

beforeEach(() => {
  _resetDbForTesting();
  db = openDb();
  runMigrations(db, [
    conversationsMigration,
    conversationsPersonaMigration,
    conversationsLeafMigration,
    messagesMigration,
    messagesParentMigration,
  ]);
});

// A minimal but structurally realistic ChatGPT `conversations.json` export:
// an array of conversations, each with a `mapping` of node id -> node
// (a synthetic null-message root, then a user message, then two branching
// assistant replies — an edit/regenerate scenario), plus a `current_node`
// pointing at the active leaf.
function chatGptFixture(): string {
  return JSON.stringify([
    {
      title: "Trip planning",
      create_time: 1700000000.123,
      update_time: 1700000100.456,
      current_node: "assistant-2",
      mapping: {
        root: {
          id: "root",
          message: null,
          parent: null,
          children: ["user-1"],
        },
        "user-1": {
          id: "user-1",
          message: {
            id: "msg-user-1",
            author: { role: "user" },
            content: { content_type: "text", parts: ["Where should I go?"] },
            create_time: 1700000000.5,
          },
          parent: "root",
          children: ["assistant-1", "assistant-2"],
        },
        "assistant-1": {
          id: "assistant-1",
          message: {
            id: "msg-assistant-1",
            author: { role: "assistant" },
            content: { content_type: "text", parts: ["How about Kyoto?"] },
            create_time: 1700000001,
          },
          parent: "user-1",
          children: [],
        },
        "assistant-2": {
          id: "assistant-2",
          message: {
            id: "msg-assistant-2",
            author: { role: "assistant" },
            content: { content_type: "text", parts: ["How about Lisbon?"] },
            create_time: 1700000002,
          },
          parent: "user-1",
          children: [],
        },
      },
    },
  ]);
}

describe("parseChatGptExport — happy path", () => {
  it("parses the conversation's title and timestamps (converted to milliseconds)", () => {
    const [conversation] = parseChatGptExport(chatGptFixture());
    expect(conversation.title).toBe("Trip planning");
    expect(conversation.createdAt).toBe(1700000000123);
    expect(conversation.updatedAt).toBe(1700000100456);
  });

  it("skips the synthetic null-message root node", () => {
    const [conversation] = parseChatGptExport(chatGptFixture());
    expect(conversation.messages.every((m) => m.content !== "")).toBe(true);
    expect(conversation.messages).toHaveLength(3);
  });

  it("preserves message roles and content", () => {
    const [conversation] = parseChatGptExport(chatGptFixture());
    const contents = conversation.messages.map((m) => `${m.role}:${m.content}`);
    expect(contents).toContain("user:Where should I go?");
    expect(contents).toContain("assistant:How about Kyoto?");
    expect(contents).toContain("assistant:How about Lisbon?");
  });

  it("preserves the branching structure — both replies point at the same user message", () => {
    const [conversation] = parseChatGptExport(chatGptFixture());
    const userIndex = conversation.messages.findIndex((m) => m.role === "user");
    const assistantIndices = conversation.messages
      .map((m, i) => (m.role === "assistant" ? i : null))
      .filter((i): i is number => i !== null);
    expect(assistantIndices).toHaveLength(2);
    for (const i of assistantIndices) {
      expect(conversation.messages[i].parentIndex).toBe(userIndex);
    }
  });

  it("resolves current_node to the correct active leaf index", () => {
    const [conversation] = parseChatGptExport(chatGptFixture());
    expect(conversation.activeLeafIndex).not.toBeNull();
    expect(conversation.messages[conversation.activeLeafIndex!].content).toBe(
      "How about Lisbon?",
    );
  });
});

describe("parseChatGptExport — tolerates real-world node shapes", () => {
  it("skips messages with a non-text content_type rather than crashing", () => {
    const raw = JSON.parse(chatGptFixture());
    raw[0].mapping["user-1"].children = ["weird-node"];
    raw[0].mapping["weird-node"] = {
      id: "weird-node",
      message: {
        id: "msg-weird",
        author: { role: "assistant" },
        content: { content_type: "code", text: "print('hi')" },
        create_time: 1700000003,
      },
      parent: "user-1",
      children: [],
    };
    const [conversation] = parseChatGptExport(JSON.stringify(raw));
    expect(conversation.messages.some((m) => m.content.includes("print"))).toBe(
      false,
    );
  });

  it("skips tool-authored messages — this app's MessageRole has no 'tool'", () => {
    const raw = JSON.parse(chatGptFixture());
    raw[0].mapping["user-1"].children = ["tool-node"];
    raw[0].mapping["tool-node"] = {
      id: "tool-node",
      message: {
        id: "msg-tool",
        author: { role: "tool" },
        content: { content_type: "text", parts: ["tool output"] },
        create_time: 1700000003,
      },
      parent: "user-1",
      children: [],
    };
    const [conversation] = parseChatGptExport(JSON.stringify(raw));
    expect(conversation.messages.some((m) => m.content === "tool output")).toBe(
      false,
    );
  });

  it("treats a null create_time as the conversation's own create_time rather than crashing", () => {
    const raw = JSON.parse(chatGptFixture());
    raw[0].mapping["user-1"].message.create_time = null;
    expect(() => parseChatGptExport(JSON.stringify(raw))).not.toThrow();
  });

  it("skips a message with empty parts rather than importing blank content", () => {
    const raw = JSON.parse(chatGptFixture());
    raw[0].mapping["assistant-1"].message.content.parts = [];
    const [conversation] = parseChatGptExport(JSON.stringify(raw));
    expect(conversation.messages.some((m) => m.content === "")).toBe(false);
  });

  it("joins multiple content parts with newlines", () => {
    const raw = JSON.parse(chatGptFixture());
    raw[0].mapping["assistant-1"].message.content.parts = [
      "Line one",
      "Line two",
    ];
    const [conversation] = parseChatGptExport(JSON.stringify(raw));
    expect(
      conversation.messages.some((m) => m.content === "Line one\nLine two"),
    ).toBe(true);
  });

  it("resolves parentIndex correctly even when a child's key appears BEFORE its parent's key in the mapping object — JSON key order is not guaranteed to be parent-first", () => {
    // Hand-built (not derived from chatGptFixture, whose keys already
    // happen to be parent-first) so the ordering is unambiguous: the
    // reply is listed before the message it replies to.
    const raw = {
      title: "Reversed order",
      create_time: 1700000000,
      update_time: 1700000000,
      current_node: "reply",
      mapping: {
        reply: {
          id: "reply",
          message: {
            id: "msg-reply",
            author: { role: "assistant" },
            content: { content_type: "text", parts: ["I'm the reply"] },
            create_time: 1700000001,
          },
          parent: "root-msg",
          children: [],
        },
        "root-msg": {
          id: "root-msg",
          message: {
            id: "msg-root",
            author: { role: "user" },
            content: { content_type: "text", parts: ["I'm first"] },
            create_time: 1700000000,
          },
          parent: null,
          children: ["reply"],
        },
      },
    };

    const [conversation] = parseChatGptExport(JSON.stringify([raw]));

    const root = conversation.messages.find((m) => m.content === "I'm first")!;
    const reply = conversation.messages.find(
      (m) => m.content === "I'm the reply",
    )!;
    const rootIndex = conversation.messages.indexOf(root);
    expect(reply.parentIndex).toBe(rootIndex);
    expect(root.parentIndex).toBeNull();
  });
});

describe("parseChatGptExport — error handling", () => {
  it("throws a clear error for malformed JSON", () => {
    expect(() => parseChatGptExport("not json")).toThrow();
  });

  it("throws a clear error when the top level isn't an array", () => {
    expect(() =>
      parseChatGptExport(JSON.stringify({ not: "an array" })),
    ).toThrow();
  });
});

describe("importChatGptExport — inserts into the database", () => {
  it("creates a new conversation with fresh, generated ids", () => {
    const [conversation] = importChatGptExport(db, chatGptFixture());
    expect(conversation.id).not.toBe("root");
    expect(getConversationById(db, conversation.id)?.title).toBe(
      "Trip planning",
    );
  });

  it("inserts every parsed message under the new conversation, with remapped parent ids", () => {
    const [conversation] = importChatGptExport(db, chatGptFixture());
    const messages = getMessagesByConversation(db, conversation.id);
    expect(messages).toHaveLength(3);
    const user = messages.find((m) => m.content === "Where should I go?")!;
    const kyoto = messages.find((m) => m.content === "How about Kyoto?")!;
    expect(kyoto.parentId).toBe(user.id);
  });

  it("sets activeLeafId to the message id corresponding to current_node", () => {
    const [conversation] = importChatGptExport(db, chatGptFixture());
    const messages = getMessagesByConversation(db, conversation.id);
    const lisbon = messages.find((m) => m.content === "How about Lisbon?")!;
    expect(conversation.activeLeafId).toBe(lisbon.id);
  });

  it("importing the same export twice creates two independent conversations", () => {
    const json = chatGptFixture();
    const [first] = importChatGptExport(db, json);
    const [second] = importChatGptExport(db, json);
    expect(first.id).not.toBe(second.id);
    expect(getAllConversations(db)).toHaveLength(2);
  });

  it("imports every conversation in a multi-conversation export", () => {
    const raw = JSON.parse(chatGptFixture());
    const second = JSON.parse(chatGptFixture());
    second[0].title = "Second chat";
    const json = JSON.stringify([...raw, ...second]);

    const imported = importChatGptExport(db, json);

    expect(imported).toHaveLength(2);
    expect(
      getAllConversations(db)
        .map((c) => c.title)
        .sort(),
    ).toEqual(["Second chat", "Trip planning"]);
  });
});
