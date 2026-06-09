# Building Capsule with AI — A Development Diary

> Source material for an article: *How to set up your environment and workspace
> when building a mobile app (almost) entirely with AI.*

This document is a **running history record**. Every meaningful step we take while
building Capsule gets logged here — decisions, setups, AI workflows, mistakes,
and what worked. It is written chronologically and append-only. We mine it later
to write the actual article.

## The three goals driving this project

1. **Ship a fully secure, offline-first AI assistant** (Capsule).
2. **Build it ~100% with AI** — minimal hand-written code; AI does the work, the
   human directs.
3. **Document the journey** — turn this diary into an article for mobile
   developers about setting up an AI-first workspace.
4. **Learn every AI feature available** — loops, skills, subagents, MCP, hooks,
   scheduled agents, memory, and more. Tracked in [CHEATSHEET.md](CHEATSHEET.md).

---

## Timeline

### 2026-06-08 — Workspace & documentation scaffolding

**What we did**

- Established a dedicated `docs/` folder to separate project documentation from
  source and config.
- Moved `CLAUDE.md` (the full product/architecture/roadmap spec) and `AGENTS.md`
  (agent ground rules) into `docs/` using `git mv` to preserve history.
- Left a **thin root `CLAUDE.md`** that re-imports the moved files via Claude
  Code's `@import` syntax (`@docs/CLAUDE.md`, `@docs/AGENTS.md`).

**Why it matters (article angle)**

- Claude Code auto-loads `CLAUDE.md`/`AGENTS.md` from the **repo root** into every
  session. Naively moving them into a subfolder would silently stop that
  auto-loading — the AI would lose its project context.
- The fix is a pattern worth teaching: keep a minimal root `CLAUDE.md` whose only
  job is to `@import` the real docs. You get a tidy `docs/` folder *and* an AI
  that still wakes up fully briefed.
- Takeaway for the article: **understand how your AI tool discovers context
  before reorganizing files.** Folder structure is also an AI-context decision,
  not just a human-aesthetics one.

**Created**

- `docs/ARTICLE.md` (this file) — the development diary.
- `docs/CHEATSHEET.md` — a living catalog of AI features used and learned.

---

### 2026-06-08 — MCP servers & standing instructions

**What we did**

- Learned what MCP (Model Context Protocol) is and how it works.
- Discussed adding the Expo MCP server (`https://mcp.expo.dev/mcp`) — the CLI
  command to do it: `claude mcp add --transport http expo https://mcp.expo.dev/mcp`
- Added **standing instructions** to `docs/CLAUDE.md` so the AI automatically
  updates ARTICLE.md and CHEATSHEET.md without being reminded each session.

**Why it matters (article angle)**

- **MCP explained simply:** MCP is a standardized plugin protocol. Instead of
  copy-pasting context between your AI and external tools, you wire up an MCP
  server and the AI can query/act on those tools natively — same interface as its
  built-in tools. Think of it as giving the AI new senses.
- **Scope matters:** `claude mcp add` without a scope flag = local (your machine,
  this project). `--scope user` = all your projects. `--scope project` = checked
  into `.mcp.json` for the whole team. Choose deliberately.
- **The standing-instructions pattern:** Rather than repeating behavioral rules
  every session, encode them in `CLAUDE.md` once. The file is always loaded —
  the AI always knows. This is the core of building a productive, low-friction
  AI workspace: the model remembers your norms so you don't have to re-teach.
- Takeaway: **CLAUDE.md is not just documentation — it's your AI's persistent
  working memory for a project.** Invest in it early.

---

### 2026-06-08 — Trimming CLAUDE.md: context window as a resource

**What we did**

- Split `docs/CLAUDE.md` (~25KB, ~6000 tokens) into three files:
  - `docs/CLAUDE.md` — kept only behavioral content (philosophy, hard rules, stack, entity model, design tokens, conventions)
  - `docs/ARCHITECTURE.md` — FSD slice map + navigation structure (reference, not auto-loaded)
  - `docs/DEVELOPMENT_PLAN.md` — feature sets + phased roadmap (reference, not auto-loaded)
- Updated the root `CLAUDE.md` index to list all docs.

**Why it matters (article angle)**

- The context window is a finite, shared resource. Every token in `CLAUDE.md` occupies space that could be used for code, search results, or conversation. A bloated context file is a silent tax on every single prompt.
- The key insight: **not all documentation is behavioral.** The AI needs the hard rules and conventions every turn. It does *not* need a 90-line phase checklist or a 70-line slice map — those are reference material, looked up when relevant.
- `@import` loads files all-or-nothing, so decomposing for organization alone saves nothing. The savings come from *not importing* the reference docs — they stay on disk until needed.
- Takeaway for the article: **treat your CLAUDE.md the way you'd treat a hot code path** — profile it, trim the fat, keep only what earns its place. Every session you don't prune it, you pay the token cost.

---

<!-- Append new dated entries above this line as work progresses. -->
