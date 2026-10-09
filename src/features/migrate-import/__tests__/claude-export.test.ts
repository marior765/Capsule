// Tests for step 5.4 (Claude export importer) — written before implementation (TDD).
// Fixture shape follows the publicly documented claude.ai data export
// (`conversations.json`); not verified against a real export file yet.
import type { SQLiteDatabase } from "expo-sqlite";
import { openDb, runMigrations, _resetDbForTesting } from "@/shared/db";
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
} from "@/entities/message";
import {
  parseClaudeExport,
  importClaudeExport,
  parseChatGptExport,
} from "../index";

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

type Msg = {
  uuid: string;
  sender: string;
  text?: string;
  content?: { type: string; text?: string }[];
  created_at?: string;
  parent_message_uuid?: string;
};

const msg = (
  uuid: string,
  sender: string,
  text: string,
  extra: Partial<Msg> = {},
): Msg => ({
  uuid,
  sender,
  text,
  content: [{ type: "text", text }],
  created_at: "2024-05-01T10:00:00.000Z",
  ...extra,
});

const conv = (chat_messages: Msg[], extra: Record<string, unknown> = {}) => ({
  uuid: "conv-1",
  name: "Trip planning",
  created_at: "2024-05-01T09:00:00.000Z",
  updated_at: "2024-05-02T09:00:00.000Z",
  chat_messages,
  ...extra,
});

describe("parseClaudeExport — happy path", () => {
  it("reads title and ISO timestamps (as epoch milliseconds)", () => {
    const [c] = parseClaudeExport(JSON.stringify([conv([])]));
    expect(c.title).toBe("Trip planning");
    expect(c.createdAt).toBe(Date.parse("2024-05-01T09:00:00.000Z"));
    expect(c.updatedAt).toBe(Date.parse("2024-05-02T09:00:00.000Z"));
  });

  it("maps human → user and assistant → assistant, chaining messages in order", () => {
    const [c] = parseClaudeExport(
      JSON.stringify([
        conv([
          msg("m1", "human", "Where should I go?"),
          msg("m2", "assistant", "Lisbon."),
          msg("m3", "human", "Why?"),
        ]),
      ]),
    );
    expect(c.messages.map((m) => [m.role, m.content, m.parentIndex])).toEqual([
      ["user", "Where should I go?", null],
      ["assistant", "Lisbon.", 0],
      ["user", "Why?", 1],
    ]);
    expect(c.activeLeafIndex).toBe(2);
    expect(c.messages[0].createdAt).toBe(
      Date.parse("2024-05-01T10:00:00.000Z"),
    );
  });

  it("joins multiple text blocks and skips non-text blocks (tool use, etc.)", () => {
    const [c] = parseClaudeExport(
      JSON.stringify([
        conv([
          msg("m1", "assistant", "", {
            content: [
              { type: "text", text: "Part one." },
              { type: "tool_use" },
              { type: "text", text: "Part two." },
            ],
          }),
        ]),
      ]),
    );
    expect(c.messages[0].content).toBe("Part one.\n\nPart two.");
  });

  it("falls back to the top-level `text` field when `content` is missing", () => {
    const [c] = parseClaudeExport(
      JSON.stringify([
        conv([{ uuid: "m1", sender: "human", text: "Old-style export" }]),
      ]),
    );
    expect(c.messages[0].content).toBe("Old-style export");
  });
});

describe("parseClaudeExport — branching via parent_message_uuid", () => {
  it("uses parent_message_uuid when present, preserving both branches", () => {
    const ROOT = "00000000-0000-4000-8000-000000000000";
    const [c] = parseClaudeExport(
      JSON.stringify([
        conv([
          msg("m1", "human", "Hi", { parent_message_uuid: ROOT }),
          msg("m2", "assistant", "Hello A", { parent_message_uuid: "m1" }),
          msg("m3", "assistant", "Hello B", { parent_message_uuid: "m1" }),
        ]),
      ]),
    );
    expect(c.messages.map((m) => m.parentIndex)).toEqual([null, 0, 0]);
  });

  it("resolves a parent that appears later in the array", () => {
    const [c] = parseClaudeExport(
      JSON.stringify([
        conv([
          msg("m2", "assistant", "reply", { parent_message_uuid: "m1" }),
          msg("m1", "human", "question", { parent_message_uuid: "root" }),
        ]),
      ]),
    );
    expect(c.messages.map((m) => [m.content, m.parentIndex])).toEqual([
      ["reply", 1],
      ["question", null],
    ]);
  });
});

/** True if following parentIndex from any node ever revisits a node. */
function hasCycle(parents: (number | null)[]): boolean {
  return parents.some((_, start) => {
    const seen = new Set<number>();
    let at: number | null = start;
    while (at !== null) {
      if (seen.has(at)) return true;
      seen.add(at);
      at = parents[at];
    }
    return false;
  });
}

describe("parent cycles from untrusted exports are broken, never imported", () => {
  it("turns a self-parented message into a root", () => {
    const [c] = parseClaudeExport(
      JSON.stringify([
        conv([msg("x", "human", "me", { parent_message_uuid: "x" })]),
      ]),
    );
    expect(c.messages.map((m) => m.parentIndex)).toEqual([null]);
  });

  it("breaks a two-node cycle so the result is a tree", () => {
    const [c] = parseClaudeExport(
      JSON.stringify([
        conv([
          msg("a", "human", "A", { parent_message_uuid: "b" }),
          msg("b", "assistant", "B", { parent_message_uuid: "a" }),
        ]),
      ]),
    );
    const parents = c.messages.map((m) => m.parentIndex);
    expect(hasCycle(parents)).toBe(false);
    expect(parents.filter((p) => p === null)).toHaveLength(1);
  });

  it("breaks a cycle created by mixing explicit parents with array-order chaining", () => {
    const [c] = parseClaudeExport(
      JSON.stringify([
        conv([
          msg("a", "human", "A"),
          msg("b", "assistant", "B", { parent_message_uuid: "c" }),
          msg("c", "human", "C"),
        ]),
      ]),
    );
    expect(hasCycle(c.messages.map((m) => m.parentIndex))).toBe(false);
  });

  it("keeps the active leaf reachable from a root after breaking a cycle", () => {
    const [c] = parseClaudeExport(
      JSON.stringify([
        conv([
          msg("a", "human", "A", { parent_message_uuid: "b" }),
          msg("b", "assistant", "B", { parent_message_uuid: "a" }),
          msg("c", "human", "C", { parent_message_uuid: "a" }),
        ]),
      ]),
    );
    const parents = c.messages.map((m) => m.parentIndex);
    expect(hasCycle(parents)).toBe(false);
    let at: number | null = c.activeLeafIndex;
    let steps = 0;
    while (at !== null && steps < 10) {
      at = parents[at];
      steps++;
    }
    expect(at).toBeNull();
  });

  it("applies the same protection to ChatGPT exports", () => {
    const node = (id: string, parent: string) => ({
      message: {
        author: { role: "user" },
        content: { content_type: "text", parts: [id] },
        create_time: 1,
      },
      parent,
      children: [],
    });
    const [c] = parseChatGptExport(
      JSON.stringify([
        {
          title: "t",
          create_time: 1,
          update_time: 1,
          mapping: { a: node("a", "b"), b: node("b", "a"), s: node("s", "s") },
        },
      ]),
    );
    expect(hasCycle(c.messages.map((m) => m.parentIndex))).toBe(false);
  });
});

describe("parseClaudeExport — active leaf", () => {
  it("prefers current_leaf_message_uuid when the export provides one", () => {
    const [c] = parseClaudeExport(
      JSON.stringify([
        conv(
          [
            msg("m1", "human", "Hi", { parent_message_uuid: "root" }),
            msg("m2", "assistant", "A", { parent_message_uuid: "m1" }),
            msg("m3", "assistant", "B", { parent_message_uuid: "m1" }),
          ],
          { current_leaf_message_uuid: "m2" },
        ),
      ]),
    );
    expect(c.activeLeafIndex).toBe(1);
  });
});

describe("parseClaudeExport — defensive handling", () => {
  it("skips messages with an unknown sender or empty text", () => {
    const [c] = parseClaudeExport(
      JSON.stringify([
        conv([
          msg("m1", "human", "keep"),
          msg("m2", "system-ish", "drop"),
          msg("m3", "assistant", "", { content: [] }),
          msg("m4", "assistant", "keep too"),
        ]),
      ]),
    );
    expect(c.messages.map((m) => [m.content, m.parentIndex])).toEqual([
      ["keep", null],
      ["keep too", 0],
    ]);
  });

  it("uses a default title for an unnamed conversation and tolerates missing messages", () => {
    const [c] = parseClaudeExport(
      JSON.stringify([{ uuid: "x", name: "", created_at: "bad-date" }]),
    );
    expect(c.title).toBe("Imported conversation");
    expect(c.messages).toEqual([]);
    expect(c.activeLeafIndex).toBeNull();
    expect(Number.isFinite(c.createdAt)).toBe(true);
  });

  it("throws clear errors for malformed JSON and a non-array top level", () => {
    expect(() => parseClaudeExport("{")).toThrow(/valid JSON/);
    expect(() => parseClaudeExport('{"a":1}')).toThrow(/array/);
  });
});

describe("importClaudeExport — inserts into the database", () => {
  it("creates conversations with fresh ids, remapped parents, and the last message as the active leaf", () => {
    const [created] = importClaudeExport(
      db,
      JSON.stringify([
        conv([msg("m1", "human", "Q"), msg("m2", "assistant", "A")]),
      ]),
    );

    expect(created.id).not.toBe("conv-1");
    expect(getAllConversations(db)).toHaveLength(1);
    const messages = getMessagesByConversation(db, created.id);
    const q = messages.find((m) => m.content === "Q")!;
    const a = messages.find((m) => m.content === "A")!;
    expect(q.id).not.toBe("m1");
    expect(q.parentId).toBeNull();
    expect(a.parentId).toBe(q.id);
    expect(created.activeLeafId).toBe(a.id);
  });

  it("imports every conversation in the export", () => {
    const result = importClaudeExport(
      db,
      JSON.stringify([
        conv([msg("m1", "human", "one")]),
        conv([msg("m1", "human", "two")], { uuid: "conv-2", name: "Other" }),
      ]),
    );
    expect(result.map((c) => c.title)).toEqual(["Trip planning", "Other"]);
    expect(getAllConversations(db)).toHaveLength(2);
  });
});
