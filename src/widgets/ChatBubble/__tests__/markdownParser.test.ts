// Tests for step 1.6.1 — written before implementation (TDD)
import { createMarkdownParser } from "../markdownParser";

/**
 * Pins the actual privacy invariant `ChatBubble` relies on: message content
 * is untrusted (the user's own text, or the model's own output) and must
 * never be able to trigger a network fetch just by being displayed. Raw
 * HTML in that content (`<img src="https://...">`) is the one path that
 * bypasses the `image` render-rule override entirely, since markdown-it
 * tokenizes it as `html_block`/`html_inline`, a different node type — the
 * override never sees it.
 *
 * This runs against the real `markdown-it` engine, not a mock: the claim
 * being tested is "this specific library, with this specific config,
 * produces no HTML token for this input" — a mock would only prove the
 * test author's belief about the library, not the library's real behavior.
 */
describe("createMarkdownParser — HTML is never tokenized", () => {
  it("does not produce an html_block token for a raw <img> tag", () => {
    const md = createMarkdownParser();
    const tokens = md.parse('<img src="https://evil.example/track.png">', {});
    expect(tokens.some((t) => t.type === "html_block")).toBe(false);
  });

  it("does not produce an html_inline token for inline raw HTML", () => {
    const md = createMarkdownParser();
    const tokens = md.parse(
      'Some text <img src="https://evil.example/track.png"> more text',
      {},
    );
    const inlineTypes = tokens
      .filter((t) => t.type === "inline")
      .flatMap((t) => t.children ?? [])
      .map((c) => c.type);
    expect(inlineTypes).not.toContain("html_inline");
  });

  it("still parses a normal markdown image into an image token (the case the image rule DOES see)", () => {
    const md = createMarkdownParser();
    const tokens = md.parse("![alt](https://example.com/x.png)", {});
    const inlineTypes = tokens
      .filter((t) => t.type === "inline")
      .flatMap((t) => t.children ?? [])
      .map((c) => c.type);
    expect(inlineTypes).toContain("image");
  });

  it("renders raw HTML as literal escaped text rather than dropping it silently", () => {
    // With html:false, markdown-it treats '<' as ordinary text rather than
    // a tag start — confirms the content is neither executed nor vanished,
    // just displayed inertly, which is what a chat bubble should do with it.
    const md = createMarkdownParser();
    const html = md.render('<img src="https://evil.example/x.png">');
    expect(html).toContain("&lt;img");
  });
});
