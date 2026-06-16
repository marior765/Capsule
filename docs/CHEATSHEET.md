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
| Hooks (settings.json) | ✅ Used | 2026-06-09 |
| Loops (`/loop`) | ✅ Learned | 2026-06-09 |
| `update-config` skill | ✅ Used | 2026-06-09 |
| Scheduled agents (`/schedule`) | ✅ Learned | 2026-06-09 |
| Memory (persistent) | ✅ Learned | 2026-06-17 |
| `/plan` custom skill | ✅ Used | 2026-06-17 |
| Plan mode (`defaultMode: plan`) | ✅ Learned | 2026-06-17 |
| Code review (`/code-review`) | ✅ Learned | 2026-06-17 |

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

### Hooks (settings.json)
- **What:** Shell commands (or HTTP/prompt/agent calls) that fire automatically on
  events in Claude Code's lifecycle — before/after tool calls, on session stop, etc.
  The harness runs them unconditionally; the AI cannot skip them.
- **How:** Add a `"hooks"` key to `.claude/settings.json`. Each event maps to an
  array of `{ matcher, hooks: [{ type, command }] }` entries.
  - `matcher` — regex/pipe-separated tool name filter (`"Edit|Write"`, `"Bash"`)
  - `type: "command"` — shell command; receives hook context as JSON on stdin
  - `exit 2` from a `PreToolUse` hook blocks the tool call
  - `async: true` — fire and forget, don't block Claude
- **Key events:** `PreToolUse` (can block), `PostToolUse`, `Stop`, `SessionStart`,
  `PermissionRequest`, `PreCompact`
- **Here:** Three hooks added to `.claude/settings.json`:
  1. **Privacy guard** (`PostToolUse` / `Edit|Write`) — scans written content for
     `fetch(`, `axios`, `XMLHttpRequest`, `https?://`, analytics imports. Warns
     Claude via stderr if found. Enforces the "no network in core logic" hard rule.
  2. **Audit log** (`PostToolUse` / `Edit|Write|Bash`) — appends a timestamped
     line to `.claude/audit.log` for every file edit or shell command. Async.
  3. **Stop notification** (`Stop`) — fires `osascript` to send a macOS system
     notification when Claude finishes a response. Async.
- **Gotcha:** Hooks are discovered at startup. After editing `settings.json` in an
  active session, open `/hooks` in the UI or restart to reload them.
- **The key distinction:** Hooks are deterministic guarantees. CLAUDE.md
  instructions are behavioral guidance. Use hooks when you need enforcement,
  not suggestions.

### Loops (`/loop`)
- **What:** Runs a prompt or `/command` repeatedly — on a fixed interval or
  self-paced (model decides the delay) — until cancelled or a stop condition is met.
- **How:**
  ```
  /loop 5m "check if build is passing"        ← fixed interval
  /loop /check-privacy                         ← self-paced, no interval
  /loop "implement X until tests pass. Stop when tsc + jest both pass cleanly."
  ```
- **Three questions every loop prompt must answer:**
  1. **What** — feature + architecture slice to work on
  2. **Check** — how to verify completion (tsc, jest, or both)
  3. **Stop** — when check passes, or after N failed attempts
- **TDD is the natural fit:** pre-written failing tests give the loop a binary,
  machine-readable exit signal. Without tests the loop has no reliable definition
  of done — it can only self-assess, which is unreliable.
- **Safety ceiling:** always add a max-attempts clause (`"or after 5 failed
  attempts, stop and report what's blocking"`) to prevent infinite retry loops
  on genuinely broken approaches.
- **Parallel sessions:** run a watchdog loop in a second chat window while
  directing work in the main session. Rule: loop sessions *read and report*,
  main session *writes* — avoids file conflicts.
- **Token cost:** every iteration is a full model call. Match interval to how
  fast the thing actually changes. Self-paced is more efficient than fixed for
  variable-length work.
- **Here:** Learned the full loop anatomy. Established TDD as the standard
  loop pattern for Capsule feature development. Not yet run on real code —
  pending Jest setup in Phase 0.

### `update-config` skill (built-in)
- **What:** A built-in Claude Code skill that configures `settings.json` — hooks,
  permissions, env vars, MCP servers. Handles merging with existing config safely.
- **How:** Invoke via the Skill tool with a description of what to configure.
  It reads the target file first, merges carefully, pipe-tests hook commands
  before writing, and validates JSON structure after.
- **Here:** Used to implement the three Capsule hooks (privacy guard, audit log,
  stop notification). Caught the pipe-test workflow — synthesize stdin payload,
  run raw command, verify exit code and side effect before writing to settings.

### Scheduled agents (`/schedule`)
- **What:** Cloud-hosted Claude Code sessions that run on a cron schedule without
  you being present. Defined with a prompt + schedule; run on Anthropic's
  infrastructure with full access to your repo and tools.
- **How:**
  ```
  /schedule "every day at 9am — summarize progress to docs/ARTICLE.md"
  /schedule "every Monday at 8am — parse audit.log and report token spend"
  /schedule "once at 3pm today — run /create-tests 0.2, medium"
  ```
- **vs. Loops:** loops need you present to start, run on your machine, best for
  implementation. Scheduled agents run on a clock, run in the cloud, best for
  reports/checks/reminders.
- **Best use cases for Capsule:**
  - Daily standup digest (what completed, what's next, blockers)
  - Weekly token cost report from `audit.log`
  - Weekly dependency audit
  - Pre-session progress summary
- **Here:** Learned the full model. Not yet set up a live schedule — weekly token
  report is the first candidate once real coding begins.

### Memory (persistent)
- **What:** Per-fact `.md` files stored at `~/.claude/projects/<project>/memory/`
  and indexed in `MEMORY.md`. Loaded selectively into each session — index always
  loads, individual files pulled in when relevant to the conversation.
- **Scope:** Global across all projects (unlike `CLAUDE.md` which is project-only).
- **Who writes:** Claude — on instruction ("remember X", "forget Y", "update Z")
  or proactively when learning something worth keeping.
- **Four types:** `user` (your profile/preferences), `feedback` (behavioral
  corrections), `project` (decisions, active work), `reference` (where things live)
- **How to enforce:**
  - Save: *"remember that I prefer X"*
  - Delete: *"forget the memory about Y"*
  - Update: *"update your memory — we switched from X to Y"*
  - Or edit the files directly in `~/.claude/projects/.../memory/`
- **Context cost:** same as `CLAUDE.md` — each loaded file occupies context window.
  Keep entries lean: write the signal, not the story. ~200 entry index cap.
- **vs. CLAUDE.md:**
  - `CLAUDE.md` — project-scoped, static, developer-maintained
  - Memory — global, dynamic, Claude-maintained
- **Here:** Learned the full model. First memory entries to be written: user
  profile (React Native background, new to llama.rn) and feedback from this session.

### `/plan` custom skill
- **What:** Read-only planning command — explores the codebase, identifies files
  to create/modify, key decisions, risks, and implementation order. Produces a
  structured plan for approval before any code is written.
- **How:** `/plan 0.2` or `/plan "step 1.5 — features/send-message"`
- **Rules encoded in the skill:** no `Edit`, `Write`, or `Bash` during planning.
  Ends with "Approve to proceed, or let me know what to change."
- **Why custom:** `/plan` doesn't exist as a built-in Claude Code command. Created
  as `.claude/commands/plan.md` to fill the gap.

### Plan Mode (`defaultMode: "plan"`)
- **What:** A harness-level permission mode that physically blocks `Edit`, `Write`,
  and `Bash`. Claude can only read. Not a slash command — set in `settings.json`
  or toggled in the Claude Code UI.
- **How:** `{ "permissions": { "defaultMode": "plan" } }` in `.claude/settings.json`
- **vs. `/plan` skill:** the skill is a convention (Claude chooses not to edit).
  Plan Mode is a guarantee (harness physically blocks it).
- **Here:** Learned but not enabled by default — `/plan` skill covers our needs.

### Code review (`/code-review`)
- **What:** Built-in skill that reviews the current diff for bugs, inefficiencies,
  simplification opportunities.
- **Modes:** default (high-confidence only), `high` (broader), `ultra` (multi-agent
  cloud review — most independent). `--fix` applies findings. `--comment` posts
  inline PR comments.
- **Honest limitation:** running it on AI-generated code has limited value — same
  model, same blind spots. `ultra` has more value (independent agents). Most
  useful on your own code, or as a final pass before committing.
- **Here:** Learned. Not yet in the standard workflow — human review of the diff
  is the primary gate after `/safe-loop`.

---

## To learn (Goal #4 backlog)

- **MCP servers (hands-on)** — actually wire up Expo MCP and use it in a task.

<!-- When you use one of the above for real, move it up into "Features" with a
how-we-used-it note, and flip its row in the status table. -->

