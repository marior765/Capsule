import MarkdownIt from "markdown-it";

/**
 * The one markdown-it instance `ChatBubble` renders with.
 *
 * `html: false` is markdown-it's own default, so leaving it unset would work
 * today — but an *implicit* default is one dependency bump or one later
 * `markdownit` prop (added for, say, a GFM extension) away from silently
 * reopening a real hole: with HTML parsing on, a message containing raw
 * `<img src="https://...">` produces an `html_block`/`html_inline` token,
 * a different node type than `image`, which `ChatBubble`'s `image` rule
 * override never sees — the fetch this app must never make would go through
 * uncaught. Written out explicitly, and pinned by
 * `__tests__/markdownParser.test.ts` against the real engine, so a future
 * change that flips it gets caught rather than silently shipped.
 */
export function createMarkdownParser(): MarkdownIt {
  return new MarkdownIt({ html: false, typographer: true });
}
