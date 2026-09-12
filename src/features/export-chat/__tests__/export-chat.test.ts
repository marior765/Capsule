// Tests for step 8.3 — written before implementation (TDD)
import type { Conversation } from "@/entities/conversation";
import type { Message } from "@/entities/message";
import { exportConversationAsMarkdown } from "../index";

const conversation: Conversation = {
  id: "c-1",
  title: "Dune discussion",
  modelId: null,
  personaId: null,
  activeLeafId: null,
  createdAt: 1000,
  updatedAt: 1000,
};

const makeMessage = (overrides: Partial<Message> = {}): Message => ({
  id: `m-${Math.random().toString(36).slice(2)}`,
  conversationId: "c-1",
  parentId: null,
  role: "user",
  content: "Hello",
  tokenCount: 1,
  createdAt: 1000,
  ...overrides,
});

describe("exportConversationAsMarkdown", () => {
  it("includes the conversation title as a heading", () => {
    const markdown = exportConversationAsMarkdown(conversation, []);
    expect(markdown).toContain("# Dune discussion");
  });

  it("includes each message's content", () => {
    const messages = [
      makeMessage({ role: "user", content: "What is Dune about?" }),
      makeMessage({ role: "assistant", content: "It's a sci-fi novel." }),
    ];
    const markdown = exportConversationAsMarkdown(conversation, messages);
    expect(markdown).toContain("What is Dune about?");
    expect(markdown).toContain("It's a sci-fi novel.");
  });

  it("labels a user message as 'You'", () => {
    const markdown = exportConversationAsMarkdown(conversation, [
      makeMessage({ role: "user", content: "Hi" }),
    ]);
    expect(markdown).toContain("**You:**");
  });

  it("labels an assistant message as 'Assistant'", () => {
    const markdown = exportConversationAsMarkdown(conversation, [
      makeMessage({ role: "assistant", content: "Hi back" }),
    ]);
    expect(markdown).toContain("**Assistant:**");
  });

  it("labels a system message as 'System'", () => {
    const markdown = exportConversationAsMarkdown(conversation, [
      makeMessage({ role: "system", content: "Be terse." }),
    ]);
    expect(markdown).toContain("**System:**");
  });

  it("preserves message order", () => {
    const messages = [
      makeMessage({ content: "first" }),
      makeMessage({ content: "second" }),
      makeMessage({ content: "third" }),
    ];
    const markdown = exportConversationAsMarkdown(conversation, messages);
    expect(markdown.indexOf("first")).toBeLessThan(markdown.indexOf("second"));
    expect(markdown.indexOf("second")).toBeLessThan(markdown.indexOf("third"));
  });

  it("does not throw and still includes the title for a conversation with no messages", () => {
    expect(() => exportConversationAsMarkdown(conversation, [])).not.toThrow();
    expect(exportConversationAsMarkdown(conversation, [])).toContain(
      "# Dune discussion",
    );
  });

  it("preserves a message's own markdown content untouched (e.g. a code fence)", () => {
    const codeContent = "Here:\n```js\nconsole.log('hi');\n```";
    const markdown = exportConversationAsMarkdown(conversation, [
      makeMessage({ role: "assistant", content: codeContent }),
    ]);
    expect(markdown).toContain(codeContent);
  });

  it("falls back to a generic title for an untitled conversation", () => {
    const untitled = { ...conversation, title: "" };
    const markdown = exportConversationAsMarkdown(untitled, []);
    expect(markdown).toContain("# Untitled conversation");
  });

  // Regression: the first implementation called `.trimEnd()` on the whole
  // joined document to clean up its own trailing blank-line formatting —
  // which also silently ate any trailing whitespace the LAST message's
  // own content genuinely had, directly contradicting "passed through
  // completely untouched." Caught by the checker, not by this run's own
  // first pass — every prior "untouched" case (a code fence) happened not
  // to end in whitespace, so it never exercised this path.
  it("preserves trailing whitespace in the last message's content untouched", () => {
    const contentWithTrailingSpaces = "Ends with a hard break.  ";
    const markdown = exportConversationAsMarkdown(conversation, [
      makeMessage({ role: "assistant", content: contentWithTrailingSpaces }),
    ]);
    expect(markdown).toContain(contentWithTrailingSpaces);
  });

  it("preserves trailing whitespace in a message that isn't the last one", () => {
    const contentWithTrailingSpaces = "Middle message.  ";
    const markdown = exportConversationAsMarkdown(conversation, [
      makeMessage({ role: "user", content: contentWithTrailingSpaces }),
      makeMessage({ role: "assistant", content: "Last message" }),
    ]);
    expect(markdown).toContain(contentWithTrailingSpaces);
  });
});
