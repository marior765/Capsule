# AI Features Cheatsheet

> A living catalog of every AI / Claude Code feature we use or learn while
> building Capsule. Goal #4: learn *everything* — loops, skills, subagents, MCP,
> hooks, memory, scheduled agents, and more.

Each entry: **what it is**, **how to use it**, and **how we used it here** (if we
have). Add a row to the status table when you adopt a feature for real.

## Status at a glance

| Feature | Status | First used |
|---|---|---|
| `CLAUDE.md` project context | ✅ Used | Project setup |
| `@import` in CLAUDE.md | ✅ Used | 2026-06-08 (docs reorg) |
| `AGENTS.md` | ✅ Used | Project setup |
| Standing instructions (CLAUDE.md) | ✅ Used | 2026-06-08 |
| MCP servers | ✅ Learned | 2026-06-08 |
| Subagents (Agent tool) | ✅ Used | 2026-06-08 |
| Custom skills (`.claude/commands/`) | ✅ Used | 2026-06-08 |
| Hooks (settings.json) | ⬜ Not yet | — |
| Loops (`/loop`) | ⬜ Not yet | — |
| Scheduled agents (`/schedule`) | ⬜ Not yet | — |
| Memory (persistent) | ⬜ Not yet | — |
| Plan mode | ⬜ Not yet | — |
| Code review (`/code-review`) | ⬜ Not yet | — |

---

## Features

### CLAUDE.md — project context file
- **What:** A Markdown file Claude Code auto-loads from the repo root into every
  session. Holds product spec, architecture, conventions, and rules. Its
  instructions override default behavior.
- **How:** Place `CLAUDE.md` at the repo root. Keep it current as the project
  evolves.
- **Here:** Holds the full Capsule spec — philosophy, FSD architecture, design
  tokens, navigation, phased roadmap.

### @import in CLAUDE.md
- **What:** `@path/to/file` lines inside `CLAUDE.md` pull other files' contents
  into the auto-loaded context.
- **How:** Add `@docs/CLAUDE.md` on its own line. Relative to the importing file.
- **Here:** Root `CLAUDE.md` is a thin stub that `@import`s `docs/CLAUDE.md` and
  `docs/AGENTS.md`, so the real docs can live in `docs/` without losing
  auto-load. See [ARTICLE.md](ARTICLE.md) 2026-06-08.

### AGENTS.md — agent ground rules
- **What:** A conventions file for AI agents (cross-tool standard). Claude Code
  reads it; so do other AI coding tools.
- **Here:** Pins us to the exact Expo SDK 56 versioned docs before writing code.

### Standing instructions in CLAUDE.md
- **What:** Behavioral rules written directly in `CLAUDE.md` that apply to every
  session automatically. The AI reads the file on startup and follows the rules
  without being reminded.
- **How:** Write clear imperative rules in a dedicated section at the top of
  `CLAUDE.md`. Be specific about triggers ("after any action worth including...")
  and outputs ("append a dated entry to...").
- **Here:** Added instructions to always update `ARTICLE.md` (journal) and
  `CHEATSHEET.md` (AI features) without the user needing to ask.
- **Why this matters:** CLAUDE.md is not just documentation — it's the AI's
  persistent working memory for a project. Encode your norms once, get them
  for free in every session.

### MCP servers — Model Context Protocol
- **What:** A standardized protocol for connecting AI tools to external systems
  (GitHub, databases, Expo, design tools, etc.) via small local or remote server
  processes. The AI discovers and calls MCP tools exactly like its built-in tools.
- **How to add (CLI):**
  ```bash
  # Local scope (this project only, your machine)
  claude mcp add --transport http expo https://mcp.expo.dev/mcp

  # User scope (all your projects)
  claude mcp add --transport http --scope user expo https://mcp.expo.dev/mcp

  # Project scope (checked into .mcp.json, shared with team)
  claude mcp add --transport http --scope project expo https://mcp.expo.dev/mcp
  ```
- **How to add (manual JSON):**
  ```json
  { "mcpServers": { "expo": { "type": "http", "url": "https://mcp.expo.dev/mcp" } } }
  ```
- **Here:** Learned while setting up the Expo MCP server. Noted that Expo MCP was
  already wired as a plugin (`expo@claude-plugins-official`) in project settings.
- **Capsule rule:** Audit any MCP for outbound requests. Dev-tooling MCPs (Expo,
  GitHub) are fine. Never let MCP touch Capsule's runtime data.

### Subagents (Agent tool)
- **What:** Isolated AI agents spawned mid-conversation to handle specific
  sub-tasks — research, code search, config lookup. They start fresh (no
  conversation context) so prompts must be self-contained.
- **How:** Claude Code spawns them automatically when the task matches (e.g.
  `claude-code-guide` for Claude API / Claude Code questions).
- **Here:** Used `claude-code-guide` subagent to look up the exact MCP server
  config syntax rather than guessing from training data.
- **When to use:** Research that spans many files, parallel independent queries,
  or tasks that need a specific agent type (Explore, Plan, code-review, etc.).

### Custom skills (`.claude/commands/`)
- **What:** Reusable slash commands backed by a plain Markdown file. Claude Code
  discovers any `.md` file in `.claude/commands/` at startup and surfaces it as
  a tab-completable `/command`.
- **How:** Create `.claude/commands/my-skill.md` with a prompt. Use `$ARGUMENTS`
  as a placeholder for whatever the user types after the command name.
  Restart Claude Code — commands are scanned at startup, not dynamically.
- **Here:** Created `.claude/commands/explain.md` — takes `$ARGUMENTS` and
  explains a concept (what, why, use cases, example).
- **Gotchas:**
  - Wrong folder (`.claude/skills/`) = not discovered. Must be `.claude/commands/`.
  - No `skills: []` in `settings.json` needed — file presence is enough.
  - Requires restart to pick up new files.
  - Single `$ARGUMENTS` placeholder only — no named params.
- **Built-in skills worth knowing:** `/code-review`, `/verify`, `/simplify`,
  `/security-review`, `/run` — these are Anthropic-backed, more powerful than
  plain prompt files.

---

## To learn (Goal #4 backlog)

- **MCP servers (hands-on)** — actually wire up Expo MCP and use it in a task.
- **Hooks** — run shell commands automatically on events (e.g. lint on save,
  format before commit). Configured in `settings.json`.
- **Loops** — run a prompt/command on an interval or self-paced.
- **Scheduled agents** — cron-style remote agents.
- **Memory** — persistent facts across sessions.
- **Plan mode** — design before editing; required by our conventions for
  multi-file changes.

<!-- When you use one of the above for real, move it up into "Features" with a
how-we-used-it note, and flip its row in the status table. -->
