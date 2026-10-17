// Tests for step 10.15 — written before implementation (TDD)
//
// Found in the simulator: a conversation stayed "New chat" after several
// exchanges, so the chat list and Home showed a row of identical titles.
import { DEFAULT_CONVERSATION_TITLE, titleFromFirstMessage } from "../index";

describe("titleFromFirstMessage", () => {
  it("uses a short first message as-is", () => {
    expect(titleFromFirstMessage("Plan a trip to Lisbon")).toBe(
      "Plan a trip to Lisbon",
    );
  });

  it("collapses whitespace and newlines onto one line", () => {
    expect(titleFromFirstMessage("  Plan\n\na   trip \t to Lisbon  ")).toBe(
      "Plan a trip to Lisbon",
    );
  });

  it("cuts long messages at a word boundary with an ellipsis", () => {
    const title = titleFromFirstMessage(
      "What is the best way to organise a reading list for the next year of evenings",
    );
    expect(title.length).toBeLessThanOrEqual(41);
    expect(title.endsWith("…")).toBe(true);
    expect(title).not.toMatch(/\s…$/);
    expect(
      "What is the best way to organise a reading list for the next year of evenings".startsWith(
        title.slice(0, -1),
      ),
    ).toBe(true);
  });

  it("hard-cuts a single very long word", () => {
    const title = titleFromFirstMessage("x".repeat(100));
    expect(title).toBe(`${"x".repeat(40)}…`);
  });

  // Lengths count characters, not UTF-16 code units: slicing code units could
  // leave half an emoji (a lone surrogate) before the ellipsis.
  it("counts emoji as single characters and never splits one", () => {
    expect(titleFromFirstMessage(`a${"🙂".repeat(30)}`)).toBe(
      `a${"🙂".repeat(30)}`,
    );
    const cut = titleFromFirstMessage(`a${"🙂".repeat(50)}`);
    expect(cut).toBe(`a${"🙂".repeat(39)}…`);
    expect(cut).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/);
  });

  it("keeps the default for an empty or whitespace-only message", () => {
    expect(titleFromFirstMessage("")).toBe(DEFAULT_CONVERSATION_TITLE);
    expect(titleFromFirstMessage(" \n ")).toBe(DEFAULT_CONVERSATION_TITLE);
  });

  it("keeps the default title as 'New chat'", () => {
    expect(DEFAULT_CONVERSATION_TITLE).toBe("New chat");
  });
});
