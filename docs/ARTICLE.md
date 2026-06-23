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

### 2026-06-09 — Skills: custom slash commands

**What we did**

- Learned what skills (custom slash commands) are in Claude Code.
- User created `.claude/skills/explain.md` — wrong folder, doesn't work.
- Moved it to the correct location: `.claude/commands/explain.md`.
- Confirmed skills require a **restart** to be discovered — Claude Code scans
  `.claude/commands/` at startup only.
- Learned that `$ARGUMENTS` is the single placeholder for user input after the
  command name.

**Why it matters (article angle)**

- Skills are just Markdown files with a prompt — no special syntax, no registration,
  no config changes needed. The simplicity is the point.
- The wrong-folder mistake is easy to make and completely silent — no error, the
  command just doesn't appear. Worth calling out explicitly in the article.
- **The real power is custom workflows:** a `/check-privacy` or `/phase-status`
  command specific to your project is more valuable than a generic one. Skills
  let you encode your project's recurring checks as first-class commands.
- Takeaway: **skills are pre-saved prompts, nothing more — but that's enough.**
  The value is ergonomic: one short command instead of re-typing a prompt you
  use repeatedly.

---

### 2026-06-09 — Hooks: deterministic automation

**What we did**

- Learned the full hooks system: events, matchers, exit codes, scopes.
- Discussed the three best hooks for Capsule's hard rules.
- Implemented all three in `.claude/settings.json`:
  1. **Privacy guard** (`PostToolUse` / `Edit|Write`) — scans written content for
     network call patterns (`fetch(`, `axios`, `https?://`, analytics imports) and
     warns Claude via stderr. Enforces the "no network in core logic" rule.
  2. **Audit log** (`PostToolUse` / `Edit|Write|Bash`) — appends a timestamped
     line to `.claude/audit.log` for every file edit or shell command.
  3. **Stop notification + sound** (`Stop`) — fires an `osascript` macOS
     notification and plays a Glass chime (`afplay`) when Claude finishes.
- Pipe-tested every hook command before writing it to settings.
- Confirmed hooks cost **zero tokens** (`type: "command"` is pure shell).

**Why it matters (article angle)**

- **Hooks vs. CLAUDE.md instructions:** CLAUDE.md rules are behavioral guidance —
  the AI follows them by judgment and can miss them. Hooks are guarantees — the
  harness runs them unconditionally regardless of what the AI does. Use hooks
  when you need enforcement, not suggestions.
- **The privacy guard pattern:** Capsule's "no network calls in core logic" rule
  is important enough to be mechanically enforced, not just documented. A hook
  that scans every written file is a cheap, zero-token way to catch violations
  the moment they happen — before a PR review, before a build.
- **Pipe-testing before writing:** The skill showed the right workflow — synthesize
  the stdin payload, pipe it to the raw command, check exit code AND side effect.
  A hook that silently does nothing is worse than no hook.
- **Audit log as a project artifact:** The `.claude/audit.log` is a timestamped
  record of every file the AI touched and every command it ran. Useful for the
  article itself ("here's the full trace of an AI-built feature") and aligns with
  Capsule's own audit-log philosophy.
- Takeaway: **automate the rules you care most about at the harness level, not
  the prompt level.** The closer a constraint is to the metal, the harder it is
  to accidentally violate.

---

### 2026-06-09 — Loops: the anatomy of autonomous AI development

**What we did**

- Learned what loops are: a repeat wrapper that runs a prompt or `/command`
  on an interval or self-paced until cancelled or a stop condition is met.
- Established the three-question formula every loop prompt must answer:
  1. **What to do** — feature + architecture slice
  2. **What to check between iterations** — static checks (tsc) + tests (jest)
  3. **When to stop** — check passes, or max attempts reached
- Discussed parallel loop sessions: a watchdog loop in Chat 2 while directing
  work in Chat 1. Safe pattern: loop sessions *read and report*, main session *writes*.
- Reached the conclusion that **TDD is the natural fit for loop-driven development**.

**The TDD conclusion (article angle)**

This is one of the more valuable insights of the whole project:

The loop needs a binary exit signal — pass or fail, stop or continue. The only
reliable source of that signal is a test suite. Static checks (tsc, eslint) catch
structural mistakes but can't verify intent. Self-assessment ("looks good to me")
is unreliable. Tests are the only thing that give the loop an unambiguous definition
of done.

TDD flips the loop into a clean cycle:
- Write failing tests that describe the expected behavior (the spec)
- Start the loop: implement until tests pass
- Loop exits on green; human reviews the diff

There's a deeper benefit specific to AI development: **tests constrain the AI's
solution space**. Without tests, a loop can implement something that compiles but
misses the intent entirely. With failing tests written upfront, the only valid exit
is code that satisfies the spec you defined.

The article conclusion this points to: *the most effective AI development loop is
TDD — not just because it's good software practice, but because it gives the AI
an unambiguous, machine-readable definition of done. The loop doesn't need to
understand what "done" means. It just reads the exit code.*

**Verification hierarchy for mobile**

Also established the honest limits of loop verification for React Native:

| Layer | Tool | Confidence | Cost |
|---|---|---|---|
| Types | `tsc --noEmit` | High (structure) | Zero |
| Logic | `jest` | High (behavior) | Low |
| UI / runtime | Simulator + `/verify` | Real | High |

The practical approach: tsc + jest gets through Phases 0–3. Simulator verification
is a manual gate before each phase ships. A Detox + Claude AI testing library
(discussed as a future open source project) would close the last gap.

---

### 2026-06-09 — The safe-loop pattern: audit files as loop memory

**What we did**

- Identified a key weakness in raw loops: no persistent context between iterations.
  If a loop runs 5 iterations, iteration 5 has no memory of what iterations 1–4 did.
- Designed and implemented the **safe-loop pattern** as a custom skill:
  `.claude/commands/safe-loop.md`
- The pattern: create `.claude/loop-audit.md` at loop start, update it before and
  after every iteration, delete it on loop exit.
- Usage: `/safe-loop "Phase 0 tasks from docs/DEVELOPMENT_PLAN.md"`

**What the audit file solves**

A loop without shared memory is stateless — each iteration re-reads the codebase
from scratch and has no record of what previous iterations attempted or why they
failed. The audit file acts as a **scratchpad visible to both the loop and the
developer**:

- The loop writes its intent *before* each task — so if it crashes mid-iteration
  you know what it was doing
- The loop writes the result *after* — so the next iteration has context on what
  already passed or failed
- The developer can open it in a side tab and watch the loop work in real time

Deleting it on exit keeps the repo clean — it's ephemeral working memory, not
a permanent artifact.

**Why it matters (article angle)**

- **Loops are stateless by default** — this is a fundamental constraint worth
  calling out. Each iteration is a fresh model call with no memory of prior ones.
  Any state that needs to persist across iterations must be written to a file.
- **The audit file is a general pattern** — not just for loops. Any long-running
  AI task benefits from a scratchpad that externalizes working memory. The model's
  context window is finite and ephemeral; the filesystem is not.
- **Observability matters for autonomous work** — when the AI is working
  unsupervised, you need a window into what it's doing. The audit file is that
  window. Without it, a loop is a black box.
- Takeaway: **treat the filesystem as the AI's working memory for long-running
  tasks.** Write state to files, read it back next iteration. Delete when done.

---

### 2026-06-09 — Closing the loop: tests, testIDs, and a complete AI dev workflow

**What we did**

- Created `/create-tests` skill: takes a step number + coverage depth (`light` /
  `medium` / `hard`), reads the plan and architecture, writes failing tests before
  implementation. TDD enforced by convention.
- Defined coverage depth levels:
  - `light` — happy path + edge cases
  - `medium` — happy path + edge cases + error handling
  - `hard` — all of the above + constraint violations + boundary/impossible cases
- Established a strict testID system in `CLAUDE.md` based on a real production
  pattern: `createComponentTestIDs`, typed categories, static `.testIDs` property
  on every component, no hardcoded strings.
- Added step `0.9` to Phase 0: `shared/testing` utilities must exist before any
  widget is written.
- Numbered every phase step (0.1, 0.2 … 9.4) so loop commands can target
  individual tasks precisely.

**The complete AI development workflow we arrived at**

By the end of this session, the full loop-driven development cycle is defined:

```
1. /create-tests 0.2, medium     → write failing tests (TDD)
2. /safe-loop "implement step 0.2"  → implement until tsc + jest pass
3. /code-review                  → review the diff
4. mark [x] in DEVELOPMENT_PLAN.md → progress tracked
```

Every piece is a custom skill or standing instruction. The developer's job is to
direct — pick the step, choose the coverage depth, review the output. The AI
does the writing.

**Why it matters (article angle)**

- **testIDs as a first-class concern:** In AI-generated UI code, testIDs are
  easy to forget or apply inconsistently — the model has no memory of what it
  named things two components ago. Encoding the full convention in `CLAUDE.md`
  (category table, prefix table, static property pattern, no hardcoded strings)
  makes it impossible to get wrong. The AI follows the spec on every component
  without being reminded.
- **The `/create-tests` skill inverts the loop dependency:** The loop needs a
  binary exit signal. Tests provide that. The skill makes writing those tests
  a one-command operation — you specify intent (step + depth), the AI writes
  the spec. This is the practical implementation of TDD in an AI-first workflow.
- **Skills as workflow primitives:** By the end of Phase 0 setup, we have
  `/create-tests`, `/safe-loop`, `/explain`, `/update-article`, `/update-cheetsheet`
  — a vocabulary of reusable commands that encode the entire development process.
  Each session starts with these already available. The AI doesn't need to be
  taught the workflow each time; it's in the skills.
- Takeaway: **the goal of AI workspace setup is to make the right workflow the
  path of least resistance.** Every convention in `CLAUDE.md`, every skill in
  `.claude/commands/`, every hook in `settings.json` reduces the cost of doing
  things correctly and raises the cost of doing them wrong.

---

### 2026-06-09 — Token tracking hook + audit log finalized

**What we did**

- Investigated how to track token usage per request. Discovered Claude Code writes
  full session transcripts to `~/.claude/projects/<project>/` as JSONL, each
  assistant turn containing a `message.usage` object with `input_tokens`,
  `output_tokens`, `cache_read_input_tokens`, `cache_creation_input_tokens`.
- Added a second Stop hook that parses the latest transcript, aggregates session
  token totals, and appends them to `.claude/audit.log` on every response.
- Removed the privacy guard hook — premature for the current stage.
- Restored the `Edit|Write` audit log hook that had been accidentally dropped.

**Final hook set in `.claude/settings.json`:**
1. `PostToolUse / Edit|Write` — logs file path to `audit.log`
2. `PostToolUse / Bash` — logs command to `audit.log`
3. `Stop` — macOS notification + Glass chime + session token totals to `audit.log`

**audit.log entry format:**
```
[2026-06-09 13:42:11] Edit: src/shared/db/index.ts
[2026-06-09 13:42:11] Bash: npx tsc --noEmit
[2026-06-09 13:42:11] TOKENS session-total — in:6076 out:108741 cache_read:15722742 cache_created:717809
```

**Why it matters (article angle)**

- **Transcripts as a data source:** Claude Code's JSONL transcripts are an
  underused artifact. They contain the full record of a session — every turn,
  every tool call, every token count. Parsing them unlocks observability that
  the UI doesn't surface: cost per loop iteration, cost per feature, cache
  efficiency over time.
- **Build the data pipe before you need the graph:** the hook costs nothing to
  run and produces a flat log that's trivially parseable later. When you do want
  the graph, the data is already there. This is the right order — instrument
  early, visualize when the signal is worth reading.
- **Hooks as zero-cost observability:** all three active hooks are `async: true`
  and `type: command` — pure shell, zero tokens, zero latency impact on Claude.
  The entire audit + notification system costs nothing to operate.

---

### 2026-06-09 — Scheduled agents: async, unattended work

**What we did**

- Learned what scheduled agents are: cloud-hosted Claude Code sessions running
  on a cron schedule without the developer present.
- Understood the key distinction from loops: loops are manual + local + for
  implementation; scheduled agents are clock-triggered + cloud + for reports
  and checks.
- Identified best use cases for Capsule: daily standup digest, weekly token
  cost report from `audit.log`, dependency audits, pre-session summaries.

**Why it matters (article angle)**

- **The async layer of an AI workspace:** hooks automate reactions to events,
  loops automate implementation sprints, scheduled agents automate the
  recurring background work that doesn't need your attention — reports,
  digests, audits. Together they form a complete automation stack.
- **The standup use case is underrated:** a scheduled agent that reads
  `DEVELOPMENT_PLAN.md` and `ARTICLE.md` every morning and writes a 3-bullet
  summary costs almost nothing and saves a cognitive load tax at the start of
  every session. You open your laptop knowing exactly where you are.
- **Cloud execution changes the model:** unlike loops, scheduled agents don't
  require your machine to be on or your session to be open. They're genuinely
  autonomous — closer to a CI job than a terminal command.
- Takeaway: **the full AI workspace automation stack is hooks (event-driven) +
  loops (implementation-driven) + scheduled agents (time-driven).** Each layer
  handles a different trigger type. Together they cover almost everything that
  would otherwise require manual attention.

---

### 2026-06-17 — Memory: the dynamic layer of AI context

**What we explored**

- Learned what Claude Code's persistent memory system is and how it differs from
  `CLAUDE.md`.
- Understood the file-per-fact structure: one `.md` file per memory entry, indexed
  in `MEMORY.md` (200-line cap). Selective loading — index always loaded, individual
  files pulled in when relevant.
- Confirmed memory is global across all projects, not scoped to Capsule.
- Established that memory files are created and maintained by Claude, not the
  developer — though you can instruct Claude to save, update, or delete specific
  entries at any time.
- Clarified that memory size affects token consumption the same way `CLAUDE.md`
  does — each loaded file occupies context window space.

**The one-line distinction:**
- `CLAUDE.md` — project-scoped, static, developer-maintained, loaded every session
- **Memory** — global, dynamic, Claude-maintained, selectively loaded per session

**Why it matters (article angle)**

- **Memory is the AI's running notes about you** — preferences learned mid-session,
  decisions made, your background, active work context. Without it, every session
  starts cold and you re-teach the same things repeatedly.
- **The file-per-fact structure is intentional:** selective loading is only possible
  because each fact is its own file. A monolithic memory file would be
  all-or-nothing. This is worth teaching — structure your AI's memory the same way
  you'd structure a database: normalized, not one big blob.
- **You can enforce memory explicitly:** "remember X", "forget Y", "update the
  memory about Z" — Claude acts immediately. The files are also plain Markdown,
  directly editable.
- **The context cost question:** global memory loads into every session, so the
  same trimming discipline applies as with `CLAUDE.md`. Write the signal, not the
  story. A 50-token entry beats a 500-token one with the same information.
- Takeaway: **the complete AI context stack is `CLAUDE.md` (project rules) +
  memory (dynamic facts about you) + reference docs (looked up on demand).** Each
  layer has a different owner, lifespan, and loading strategy. Understanding all
  three is what separates a well-configured AI workspace from one that starts
  fresh every session.

---

### 2026-06-17 — Plan mode, code review, and completing the skill vocabulary

**What we explored**

- Learned `/code-review` — built-in skill for reviewing diffs. Discussed honestly
  why running it on AI-generated code has limited value (same model, same blind
  spots). `ultra` mode has more value — independent agents with no memory of
  writing the code. Standard mode most useful when reviewing your own code.
- Learned Plan Mode — a harness-level permission lock that physically prevents
  Claude from writing files until released. Set via `defaultMode: "plan"` in
  settings, not a slash command.
- Discovered `/plan` and `/plan-mode` don't exist as built-in commands — I
  described them incorrectly. Corrected and created a custom `/plan` skill instead.
- Created `.claude/commands/plan.md` — read-only by instruction, produces a
  structured plan (files to create/modify, key decisions, risks, implementation
  order), ends with "Approve to proceed."

**The complete skill vocabulary for Capsule is now:**

| Skill | Purpose |
|---|---|
| `/plan` | Design before implementation — read-only, approval-gated |
| `/create-tests` | Write failing tests before implementation (TDD) |
| `/safe-loop` | Implement until tsc + jest pass, with audit file |
| `/explain` | Explain any concept with examples |
| `/update-article` | Append to development diary |
| `/update-cheetsheet` | Update AI features catalog |

**Why it matters (article angle)**

- **On self-review limitations:** this is an honest observation worth including
  in the article. AI code review on AI-generated code is largely theater — the
  model that wrote it will tend to approve it. The real review gate is human eyes
  on the diff, or `ultra` mode with genuinely independent agents. Don't cargo-cult
  `/code-review` into every workflow just because it exists.
- **On correcting mistakes publicly:** I described `/plan` and `/plan-mode` as
  commands that don't exist. The user caught it immediately. Worth noting in the
  article: AI tools make confident factual errors. Verify claims about tool
  capabilities before building workflows around them.
- **The custom skill as a fix:** rather than abandoning the concept, we built
  what I described as a custom skill. This is the right response — when a built-in
  doesn't exist, `.claude/commands/` fills the gap in minutes.
- Takeaway: **the skill vocabulary is the interface to your AI workspace.** By the
  end of setup, a full feature cycle is: `/plan` → `/create-tests` → `/safe-loop`
  → human review. Each step is one command. The complexity is encoded, not repeated.

---

### 2026-06-17 — Phase 0: Foundation complete

**What we built**

Phase 0 is done. All 9 steps implemented, `tsc` clean, 63 tests passing. The
foundation the rest of the app will be built on:

| Step | What |
|---|---|
| 0.1 | FSD folder structure + `eslint-plugin-boundaries` — layer imports enforced at lint time |
| 0.2 | `shared/db` — SQLite client (expo-sqlite) + typed migration runner |
| 0.3 | `shared/storage` — MMKV typed wrapper (`getString`/`setString`/etc.) |
| 0.4 | `shared/ui` — design tokens + unistyles v3 theme configuration |
| 0.5 | `shared/llm` — llama.rn wrapper (`initLlm`, `runCompletion`, `abortCompletion`, `releaseLlm`) |
| 0.6 | `shared/config` — `FEATURE_FLAGS` + `APP_CONSTANTS` |
| 0.7 | expo-router shell — `Providers` component, root layout, 4-tab navigation |
| 0.8 | llama.rn Expo plugin config (pre-existing) |
| 0.9 | `shared/testing` — `buildTestID`, `createComponentTestIDs`, `extendIDs`, `getInputTestId` |

**How it was built**

The full TDD + safe-loop workflow was used for the first time on real code:

1. `/plan 0.X` — read-only plan, approved before any code written
2. `/create-tests 0.X, medium` — failing tests written first (the spec)
3. Direct implementation (steps were finite and known — no loop needed)
4. `tsc --noEmit + jest` — both must pass before marking `[x]`

Steps 0.2–0.5 were implemented in a single `/safe-loop` run that handled
4 steps consecutively, self-correcting on failures (MMKV v4 API change,
llama.rn type mismatch, missing Jest types in tsconfig).

**Things that surprised us along the way**

- `eslint-plugin-boundaries` v6 renamed the main rule from `element-types` to
  `dependencies`. The subagent that looked up the config syntax gave v5 syntax.
  Caught by running eslint and reading the error.
- `react-native-mmkv` v4 dropped the `MMKV` class constructor in favour of a
  `createMMKV()` factory. Our mock was written for the old API and needed updating.
- `unistyles` v3 removed `UnistylesRegistry` entirely — setup is now a side-effect
  import of a file that calls `StyleSheet.configure()`. No provider wrapper needed.
- The llama.rn public `CompletionParams` type strips `emit_partial_completion` —
  it's handled internally. TypeScript caught this immediately.

**Why it matters (article angle)**

- **TDD is the right default for AI-generated code**, not because the AI needs
  discipline, but because the tests give it an unambiguous exit signal. Without
  them, "done" is a judgment call. With them, it's an exit code.
- **The loop self-corrects.** The MMKV API mismatch, the type errors, the eslint
  rule rename — none of these required human intervention. The loop hit the error,
  read the message, fixed it, re-ran. This is the loop working as intended.
- **Plans before code saves more time than it costs.** Two of the steps (0.7, 0.9)
  had near-zero rework because the plan surfaced the decision points upfront
  (unistyles API, extendIDs signature). The 15 minutes on planning saved more
  than 15 minutes of debugging.
- **The foundation phase is where you pay down future complexity.** Every hard
  rule now enforced at lint time (FSD layers), every naming convention encoded
  in a utility (`createComponentTestIDs`), every wrapper abstracted away (`shared/llm`)
  — these reduce the surface area where Phase 1 can go wrong.
- Takeaway: **the AI's code quality is a function of the constraints you give it.**
  Lint rules, test suites, typed wrappers, and CLAUDE.md conventions are not
  overhead — they are the mechanism by which AI-generated code stays correct
  as the codebase grows.

---

### 2026-06-19 — Phase 1 complete: a working offline AI chat app

**What we built**

Phase 1 (AI chat core) is done — 11 steps, the app now runs an end-to-end chat
loop: download a model → it loads into memory → send a message → stream a reply
→ everything persisted locally. `tsc` clean, 130 unit tests passing.

| Step | What |
|---|---|
| 1.1 | `entities/model` — model metadata + CRUD |
| 1.2 | `features/manage-models` — GGUF download (the one network action), list, delete, select |
| 1.3 | `ModelPicker` widget + hardware-aware recommendation logic |
| 1.4 | `entities/conversation` + `entities/message` — CRUD |
| 1.5 | `features/send-message` — persist user → stream completion → persist assistant |
| 1.6 | `ChatThread` + `ChatBubble` + `ChatInput` widgets (markdown deferred → 1.6.1) |
| 1.7 | `InferenceStats` widget |
| 1.8 | `features/manage-conversations` — create, rename, delete (cascade), search |
| 1.9 | chat routes (list, new, thread) |
| 1.10 | models route (download / select / delete) |
| 1.11 | onboarding (download first model → first chat) |

**The workflow that carried the whole phase**

Every step ran the same loop, and it held up across data layers, features, and UI:

```
/plan <step>            → read-only plan, approved before any code
/create-tests <step>    → failing tests = the spec (data/logic steps only)
/safe-loop <step>       → implement until tsc + jest pass, audit file tracks progress
mark [x] + tear down
```

For the final UI batch (1.6, 1.7, 1.9, 1.10, 1.11) we ran **one safe-loop over five
steps at once**. It completed in a single iteration. The loop self-corrected several
real errors without human help: an MMKV v4 API change, an `expo-file-system` types
mismatch (`moduleNameMapper` is jest-only, so mock helpers had to import from the
mock path while `File` stayed on the real module), a missing `Conversation`
re-export, and a `theme.spacing.xl` typo that didn't exist.

**Three things worth teaching in the article**

1. **The data/UI test split is the honest answer to "how do you test AI-built UI?"**
   We extracted every testable decision into pure functions (model recommendation,
   send-message orchestration, conversation cascade) and tested those hard. The
   `.tsx` components are tsc-checked and verified by a human in the simulator. The
   loop's gate proves *compilation*, not *appearance* — and we said so explicitly
   rather than pretending green tests meant the UI worked. 130 tests cover logic;
   zero cover pixels, by design.

2. **High-frequency state must stay out of React context.** The `LlmProvider`
   holds only the loaded model handle + status — stable, changes a few times per
   session. The streaming tokens (many updates/second) live in the chat screen's
   local state. Putting them in context would re-render every consumer on every
   token. The user caught this by asking "does the provider hold high-frequency
   state?" before approving — exactly the kind of design question that prevents a
   class of bug before it's written.

3. **The AI's correctness is a function of the constraints you give it.** Across
   Phase 1 the loop never produced a layering violation, because `eslint-plugin-
   boundaries` makes FSD layers mechanically enforced — when ChatThread needed to
   compose ChatBubble, the rule *forced a deliberate decision* (allow widgets →
   widgets) rather than letting it happen silently. testIDs are consistent because
   `createComponentTestIDs` makes the convention the path of least resistance. The
   scaffolding built in Phase 0 is what kept five steps of AI-generated UI coherent.

**Deferred, on purpose**
- **Markdown rendering + code-copy (1.6.1)** — needs two deps; split out so the core
  chat loop shipped and stays verifiable. A reminder that "done" can mean "the
  valuable 80% works and the polish is a tracked follow-up," not "every sub-clause
  of the plan line is satisfied."
- **Live inference verification** — the chat *shell* is verifiable in the simulator
  now; streaming a real reply needs a multi-GB GGUF on-device, which is the
  onboarding/models path the user will exercise.

**Takeaway:** by the end of Phase 1 the human's role was almost entirely *direction
and verification* — pick the step, choose coverage depth, approve the plan, review
the diff, verify the UI. The AI wrote the code; the workspace (CLAUDE.md rules,
skills, hooks, lint gates, test scaffolding) kept it correct. That division of
labor is the actual subject of the article.

---

<!-- Append new dated entries above this line as work progresses. -->
