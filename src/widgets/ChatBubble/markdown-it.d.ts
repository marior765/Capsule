/**
 * markdown-it ships no types of its own, and `@types/markdown-it` is not
 * installed — installing a new package, even a types-only devDependency,
 * is a dependency decision this loop won't make unattended (see CLAUDE.md /
 * .claude/loop/BLOCKED.md). This declares only the surface this slice
 * actually calls: the constructor options `createMarkdownParser` passes,
 * and `.parse`/`.render` as exercised in `markdownParser.test.ts`. It is
 * not a faithful model of markdown-it's full API — if `@types/markdown-it`
 * is ever approved, delete this file in its favor.
 */
declare module "markdown-it" {
  export type Token = {
    type: string;
    children: Token[] | null;
  };

  export type MarkdownItOptions = {
    html?: boolean;
    typographer?: boolean;
  };

  export default class MarkdownIt {
    constructor(options?: MarkdownItOptions);
    parse(src: string, env: unknown): Token[];
    render(src: string, env?: unknown): string;
  }
}
