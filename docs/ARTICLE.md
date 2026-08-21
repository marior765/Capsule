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

### 2026-06-19 — First device run: the bug that compiled perfectly

**What happened**

First simulator run of the Phase 1 build. The models screen worked, a model
started downloading — and the bottom tab bar had **~17 tabs** crammed with
truncated labels and placeholder triangle icons. It compiled clean, passed all
130 tests, and was completely wrong.

**Root cause:** expo-router `<Tabs>` turns every *leaf route* in the group into a
tab unless a folder has its own nested navigator. `chat/`, `capsules/`,
`settings/`, and `types/` had no `_layout`, so `chat/new`, `chat/[id]`,
`settings/privacy`, `settings/storage`, … each became its own tab. Fix: add a
`Stack` `_layout.tsx` to each multi-route folder, collapsing it to one tab with
its sub-routes as stack screens.

**Why it matters (article angle)**

This is the thesis made concrete. Nothing a type checker or a unit test could
catch — the code was valid, the routes existed, the imports resolved. It was only
*wrong on screen*. The entire Phase 1 UI batch shipped behind a "tsc + jest"
gate that is, by construction, blind to this class of error. The human running
the app for ten seconds found it instantly.

The lesson isn't "the AI made a mistake" — the navigation structure was a
reasonable first attempt. The lesson is **where the verification boundary sits**:
AI + a good test harness gets you compiling, correct *logic*. A human (or, later,
a Detox/vision loop) is still the gate for *does it look and behave right*. Any
workflow that treats green CI as "UI done" will ship exactly this bug. Naming that
boundary honestly — and building the human check into the loop deliberately — is
the difference between an AI workflow that works and one that just looks like it
does.

---

### 2026-06-19 — The stranded screen, and taking the session mobile

**1. A second UI bug tests could never catch**

Right after the tab-bar fix, the next question was: *"How do I download a model?
There's no place to do it — or is that expected?"*

It wasn't expected. The models route was `href: null` (deliberately hidden from
the tab bar, intended to be reached by navigation) — but **nothing ever linked to
it**. The download UI existed, was fully implemented, tested where testable… and
was unreachable from the running app. Onboarding had the other download path, but
it never auto-showed on first launch. Fixed by adding a **Models** button to the
chat list and making the *"Download a model to start chatting"* prompt tappable.

**Article angle:** this is a *different* class of invisible bug from the tab
explosion. That one rendered wrong; this one rendered *fine* and was simply
unreachable. Both share a root: **information architecture compiles regardless of
whether a human can navigate it.** A type checker proves a route *exists*. Only a
person opening the app proves it's *findable*. Two navigation bugs, found in
seconds of real use, with exactly zero possible test coverage under our gate. If
the article needs one concrete image for "where the verification boundary sits" —
it's a fully-working download screen that no user could ever reach.

**2. Remote control — driving Claude Code from a phone**

Needing to leave for a couple of hours mid-build surfaced a feature we hadn't
touched:

- `claude remote-control` → prints a QR code → scan with the Claude mobile app →
  the local session is now drivable from the phone. (Also `/remote-control`
  in-session, or auto-enable via `/config`.)
- `/config` → **"Push when actions required"** (ping on permission prompts /
  questions) and **"Push when Claude decides"** (ping when long tasks finish).
- Requires Pro/Max/Team, the same account signed in on the phone, CC v2.1.51+.

**Article angle:** this reframes what "autonomous" means. The bottleneck on a
multi-hour unattended loop was never the model's ability to keep working — it's
that a **permission prompt blocks forever with nobody there to answer it**. Remote
control + push turns a blocking prompt into a notification and a thumb tap from a
café. That's the difference between an agent that runs for two minutes and one
that runs for two hours. The enabling infrastructure for autonomy is
*notification plumbing*, not intelligence.

**3. The real question behind "can I leave this running?"**

Scoping the away-run produced the sharpest insight of the phase. Asked to pick
what the unattended loop should build, the honest answer wasn't about size or
difficulty — it's that **a loop is only as trustworthy as its gate**:

| Step type | Gate | Safe unattended? |
|---|---|---|
| Data / logic (with tests written first) | `tsc` + `jest` | **Yes** — the gate actually proves correctness |
| UI | `tsc` only | **No** — "it compiles" ≠ "it works" |

We had *just* watched a compile-gated UI batch ship two navigation bugs. That's
not a hypothetical risk; it's the evidence from the previous hour. So the choice
of what to run unsupervised isn't "what's most valuable" — it's "what has a real
exit signal."

**Takeaway:** *"Can I leave this running?"* is really *"does this step have a
binary, machine-checkable definition of done?"* If tests define correctness, walk
away. If the only gate is the compiler, you're not running a verified loop — you're
generating plausible code and hoping. Naming that distinction out loud, rather
than treating every step as equally loop-able, is what keeps the workflow honest.

**Status:** the Phase 2 loop was started and then interrupted — Phase 2 remains
unimplemented. Phase 1 stands complete (with 1.6.1 markdown deferred).

---

### 2026-07-17 — Phase 2 complete: privacy you can't accidentally break

**What shipped**

All six Phase 2 steps — inference settings, personas, conversation branching,
ephemeral chats, plus the settings/personas UI. `tsc` clean, 186 tests, zero FSD
boundary violations. Every loop completed on its **first iteration**.

**1. The best idea in this phase: a function that cannot break its promise**

*"Ephemeral chats — session-only, never written to disk"* is a Set 2 **privacy
guarantee**, not a feature. Three designs were on the table:

| Design | Why it fails |
|---|---|
| `conversation.ephemeral` flag; `sendMessage` branches on it | The guarantee reduces to *"we remembered the `if`"* — one refactor from silently persisting private chats |
| Abstract a storage layer (sqlite vs memory) | Needs abstracting three entities, and the guarantee still rests on wiring the right impl |
| **`sendEphemeralMessage` takes no `db` parameter** | ✅ |

```ts
sendMessage(db, ctx, input, onToken?, settings?)        // persists
sendEphemeralMessage(ctx, input, onToken?, settings?)   // no db — cannot persist
```

**The function can't write to disk because it has no handle to write with.** The
privacy property is enforced by the type system, not by discipline or review.
The test — `"writes nothing to the database"` — passes *trivially*, and that's the
point: it documents a property the signature already guarantees. The ephemeral
chat even gets its own route, so no screen that *can* persist is ever used for a
private chat.

**Article angle:** "verifiable privacy" is Capsule's differentiator, and this is
what makes it more than marketing. Most privacy bugs aren't malice — they're a
flag that didn't get checked on some path someone added later. The fix isn't more
vigilance; it's removing the capability. **If the code physically cannot do the
wrong thing, you don't need to trust that it won't.** That principle generalises
far past this app.

**2. The type system's blind spot — now confirmed twice**

Adding required fields (`personaId`, then `parentId` + `activeLeafId`) let the
compiler enumerate every fixture needing updates — it found 8 sites, including
two UI spots I'd have missed (an optimistic message, a synthetic streaming
bubble). Compiler-driven refactoring at its best.

But **every additive migration also broke test suites that `tsc` could not see.**
A suite that runs `runMigrations(db, [conversationsMigration])` without the new
`ALTER TABLE` compiles perfectly and then dies at runtime:
`SqliteError: table conversations has no column named persona_id`.

**Article angle:** the type system knows the shape of your *data*; it knows
nothing about the shape of your *database*. Those drift independently, and the
gap is invisible until something runs. Two phases in a row, same lesson —
worth stating as a rule: **schema changes need a runtime gate, not just a
compile gate.**

**3. The cost data inverted my own argument**

The user proposed a pipeline: switch to Fable 5 for planning → verify → switch to
Sonnet to implement. I argued it was backwards — planning needs accumulated
context (200 turns of decisions), while implementation against approved tests is
context-light because **the tests externalise the spec**. So delegate the
*implementation*, not the planning.

Then we actually read the token log we'd instrumented weeks earlier:

| | Volume |
|---|---|
| Output (generation) | 0.70 M |
| **Cache read (context re-reading)** | **217.55 M** |
| Cache created | 10.27 M |

**93% of the cost was re-reading context — ~300× the volume of everything we'd
generated.** That reframed the whole thing: the cold start I'd called a *downside*
for planning is the dominant *cost win* for implementation, because a fresh agent
reads ~40 K of context instead of dragging 200 turns into every request. The model
tier was worth ~2.5×; not carrying the conversation was worth ~13×. (Also: Fable 5
is 2× Opus per token — the premium tier, not a saving. The original plan would
have cost *more*.)

**Article angle:** two lessons stacked. First, **instrument early and read it
later** — the Stop hook that logged tokens cost nothing for weeks, then settled an
architecture debate with data instead of intuition. Second, and more uncomfortable:
I reached the right conclusion for the wrong reason, and only the measurement
showed it. Reasoning felt rigorous; it was still guessing.

**4. A third stranded screen**

The settings hub was an empty `<View />`. Every settings sub-screen — inference,
privacy, storage — was unreachable. The inference screen we were about to build
would have been **born stranded**, the same defect as the models route.

That's now three occurrences of one bug class: **information architecture compiles
regardless of whether a human can navigate it.** The response was to promote
reachability to an explicit plan checklist item — every new screen gets its link
in the same change — and to *not* link the empty Phase 4 stubs, because a link to
a blank screen is worse than no link.

**5. Recon before planning beat planning from the plan**

The request was "plan 2.1, 2.4, 2.5." Ten minutes of recon found 2.4 was
impossible: no `personas` entity existed (ARCHITECTURE.md never had one), and 2.4
is the *UI* for data 2.3 hadn't built yet. The batch had been cut across a
dependency.

Re-cutting by actual dependencies — logic slices first (real test gates), UI last
(compile gate, human verifies) — is the same shape that made Phase 1 go clean.

**Takeaway:** the plan document is a map, not the territory. It said
`configure-inference # …persona selection` but had no persona entity to select
from. **Plans encode intent; only the code encodes reality** — and the gap between
them is exactly what a recon pass is for.

**Deferred, on purpose: 2.7 prompt templating.** `buildPrompt` emits naive
`system:`/`user:`/`assistant:` lines and ignores each model's chat template
(Llama 3.2 wants `<|start_header_id|>`). Logged rather than fixed blind — it's the
one defect that will make everything else *look* broken on the first real model
run, and it's better diagnosed with a device in hand than guessed at.

---

## 2026-07-17 — The empty bubble, and a mock that lied

The deferred defect landed exactly where it was logged. First real model run:
messages sent, assistant bubbles came back **empty, 0 tokens**. Not a crash — a
polite nothing. The hand-rolled `system:`/`user:`/`assistant:` prompt is junk to
Llama 3.2, which wants `<|start_header_id|>`, so the model saw noise and emitted
end-of-sequence immediately. Predicted in the 2.6 entry, verified on device.

The fix worth having wasn't "write the Llama 3.2 markers." Every model family
wants different markup, and **every GGUF already ships its own chat template
inside the file**. So `runCompletion` now hands llama.rn structured `messages`
with `jinja: true` and lets the model's own template render the prompt. We write
no markup at all. `buildPrompt` (returns a string) became `buildMessages`
(returns turns) — the type change is the point: there is no longer a place in our
code where prompt markup *could* be written.

**Then the tests failed — and the failure was fiction.** Three `shared/llm` tests
started throwing `Prompt is required`. The product was fine. llama.rn's own jest
mock stubs the native chat formatter to return an empty prompt for *every* input
— reasonably, since there's no real GGUF and therefore no template — and its
`completion()` then rejects the empty prompt it just produced. Two attempts to
inject a stand-in template both failed: the library snapshots the JSI globals into
a private bindings object on first init and then `delete`s the globals, so there
is nothing left to override.

That dead end was the useful part, because it forced the real question: **what
were those tests testing?** "Returns a result", "streams tokens", "handles
maxTokens of 1" all asserted that *llama.rn's mock* returns text. That's the
library's job to test, not ours. The half that's actually ours — camelCase → the
snake_case sampling fields, `jinja: true`, turns passed through unmodified — needs
no llama.rn machinery at all, just a fake ctx that records what it was handed.
Rewritten that way the suite went from 3 failing tests that tested the library to
11 passing tests that test the wrapper, including two (`jinja` is on, no `prompt`
key is ever sent) that would have caught this bug in the first place.

**Article angle:** a mock is a claim about a dependency, and when it can't
represent reality it will fail your code for reasons your users never hit. The
reflex is to fight the mock. The better move is to read the failure as a question:
*if this test can only pass by simulating the library, was it ever testing me?*
The tests that survived the rewrite are the ones that only ever needed my own
code — which is another way of saying the mock's limitation drew the seam my test
boundary should have had all along. **Don't test through your dependency; test
up to it.**

---

## 2026-08-12 — Building the loop that builds the app

The ask was to stop driving development step by step and hand the whole
`DEVELOPMENT_PLAN.md` to an autonomous loop. The pieces looked like they were
already there: a `/safe-loop` command, a `/create-tests` command encoding TDD, and
an audit file for state. They weren't.

Auditing the existing `safe-loop.md` against the standard anatomy of an agent loop
— heartbeat, isolation, skill, checker, connector, spine — turned up three real
defects, and the smallest one was the most instructive. The command's teardown
step said: *delete `.claude/loop-audit.md`*. The spine was being destroyed at
exactly the moment it became valuable. That's a tidiness reflex applied to the one
artifact an unattended run produces. If nobody watched the run, the log **is** the
deliverable.

The second defect: the audit file was prose. Prose is fine for a human reading
afterward, useless for a fresh beat resuming. Each beat starts with no memory —
so "what did the last beat do" has to be answerable by parsing, not by
interpretation. The fix was to split the roles: `state.json` holds the cursor,
attempt counters, and failure signatures; `journal.md` holds the narrative;
`BLOCKED.md` holds everything needing a human. Notably, the step *registry* stays
in `DEVELOPMENT_PLAN.md` — copying the step list into the state file would have
created a second source of truth that drifts.

The third and biggest: there was no checker. The loop wrote the tests, wrote the
code, then ran its own tests and declared victory. That's a rubber stamp with
extra steps — and this project already has the scar to prove it. The 2026-07-17
entry is about a suite of tests that only asserted that llama.rn's mock returned
text. A maker-checker split with a reviewer that has no implementation context,
told to *refute* rather than assess, defaulting to `fail` when uncertain, is what
catches that class of bug.

The hardest design question wasn't loop mechanics at all — it was **what a green
test actually proves here**. Roughly half the remaining plan is native: whisper.rn,
SQLCipher, biometrics, a real model download. `jest` can prove the logic around
them and nothing about whether the app boots on a phone. A loop that treats mocked
green as done will hand back a fully-ticked plan and a broken app. So
classification became a first-class concept: `logic` and `ui` steps may tick their
own box; `native` steps get implemented, proven as far as they can be, then queued
to `BLOCKED.md` with their box deliberately **left unchecked**. The loop is not
allowed to certify what it cannot execute.

**Article angle:** the instinct when automating yourself is to make the loop
capable of more. The work that actually mattered was making it *honest about
less* — three stopping conditions instead of one, a reviewer empowered to reject
its own author's work, and a queue of things it must refuse to sign off on. The
limiting factor in delegation isn't how much the agent can do unattended; it's how
precisely you can state what counts as proof. Everything the loop can't prove has
to have somewhere to go, or it silently becomes a checked box that lies.

## 2026-08-13 — The first unattended beat, and the test that proved nothing

The loop ran for real: `/loop /safe-loop all`, self-paced, no human in the
iteration. Beat one picked step 3.1 — the whisper.rn wrapper — wrote 24 tests
first, confirmed they failed, implemented `shared/stt`, and drove the gate to
green. tsc clean, 220 tests passing, eslint clean. By every automated measure the
step was done.

The checker disagreed, and it was right.

Its lead finding: `releaseStt` calls `ctx.release()` to free the native whisper
context, and *no test asserted that*. One test checked the null guard, another
checked that the call resolved without throwing. Replace the entire function body
with `if (!ctx) return;` — never releasing anything, leaking a native context per
model load — and all 24 tests still pass. The sibling function `abortTranscription`
had the assertion; `releaseStt` had been left with a shape that looks like
coverage and isn't. This is the 2026-07-17 lesson wearing a different hat: that
time the tests asserted a mock's return value, this time they asserted that a
function didn't crash. Both feel like tests. Neither can fail for the right reason.

It found two more of the same species — a `toBeDefined()` that survives any
implementation returning anything, and a test named "omits params the caller left
unset" whose assertion (`toBeUndefined()`) cannot distinguish an absent key from a
key explicitly set to `undefined`, and so passes against an implementation that
does the exact opposite of its name.

Then the one that mattered most. The step text reads "init, **record**,
transcribe, abort". I'd shipped four functions, none of them recording, on the
argument that audio capture needs a dependency the project doesn't have. The
checker went and read `docs/ARCHITECTURE.md:109` — a file I hadn't consulted —
which independently assigns recording to `shared/stt`. Its verdict: *under-delivers*,
because the omission silently contradicts a spec document that was never amended.

The tempting fix was to edit that line of the architecture doc so the step would
be complete as built. That is the single most dangerous move available to an
unattended loop: when the work doesn't match the spec, quietly change the spec.
It converts every shortfall into a green checkbox and leaves no trace. So the
architecture doc stayed as written, `record` went to the human-gate queue as an
explicit either/or (approve `expo-audio`, or move recording to `features/voice-input`),
and step 3.1's checkbox stayed unticked.

One more thing worth recording: the checker also corrected a citation. I'd
justified converting whisper's timestamps by ×10 with a source comment reading
`// t0/t1 is 10ms unit` — which turns out to sit in the VAD code and describe VAD
segments, not transcription segments. The conversion was right; my evidence for it
was not. The checker verified it properly, down to `to_timestamp` in whisper.cpp
(`msec = t * 10`). Right answer, wrong reason, caught only because something with
no stake in my conclusion went and looked.

**Article angle:** a passing test suite is a claim that the code does something,
not a claim that it does the *right* something — and the gap between those is
invisible from inside the agent that wrote both halves. The useful question isn't
"do the tests pass?" but "which of these tests could still pass if I deleted the
function?" Every test that survives that deletion is decoration. An autonomous
loop can run that check on itself only in principle; in practice it takes a second
agent with no investment in the answer, explicitly instructed to refute rather than
confirm. The gate tells you the code compiles and runs. Only the checker tells you
the code is *doing its job* — and only a human gets to decide what the job was.

---

## 2026-08-13 — Catching a bug the test suite structurally cannot see

Step 3.4 was a small widget — a hold-to-record button — and it surfaced a limit
of the maker-checker setup worth naming: this project has no
`@testing-library/react-native`, so no `.tsx` component has ever been rendered
in a test here. The existing pattern (`ModelPicker.tsx` next to a pure,
fully-tested `recommend.ts`) works around this by pulling the one piece of real
logic out of the component and testing *that*. `VoiceRecordButton` followed
suit: `holdGesture.ts` decides whether a press-and-release counts as an
intentional hold, tested eight ways: happy path, an inclusive boundary, an
origin-independence check, out-of-order timestamps, invalid config. The
component itself stayed a thin thing wiring `Pressable` events to that
function, with zero tests of its own — same as every widget before it.

The checker's first pass failed the diff anyway, and the bug it found lived
entirely in the untestable half. `handlePressOut` had an early return —
`if (disabled || pressedAt === null) return;` — that looked like an
obviously-correct guard. It wasn't. If a press starts while the button is
enabled (`onHoldStart` fires, a ref records the timestamp) and something
disables the button *before* release — a permission revoked, a model busy —
that same guard now swallows the release event entirely. `onHoldStart` had
already told the caller "a recording is starting." Nothing ever tells it the
recording ended. The caller is left holding a hold that will never resolve, and
no test in the eight-case suite could have caught it, because the suite tests
`evaluateHold`, a pure function with no concept of `disabled` or of two
sequential events sharing mutable state.

The checker couldn't write a new test to prove the fix either — same missing
tooling. What it did instead was hand-trace every reachable branch: confirmed
`pressedAt !== null` only holds after `onHoldStart` already fired in the same
closure, confirmed the ref is nulled before the `disabled` check so a
duplicate event is idempotent, confirmed no path produces two resolutions or
zero resolutions for one start. Asked directly whether an unverified-by-test
fix should count as still failing, it declined the reflex: judged it as a
limitation of the codebase's infrastructure, not a defect in the diff, since
*every* prior `.tsx` change in this project shares the same gap and none of
them had been held to a different standard.

**Article angle:** "make it testable" is usually good advice, and it was
followed here — the pure logic *was* tested, thoroughly. But the bug wasn't in
the pure logic. It was in the exact seam that testing strategy had drawn around
itself: the stateful glue connecting two events over time, which is precisely
what a pure function can't model and precisely what a missing render-testing
library leaves uncovered. A checker whose job is to refute, not to run a
checklist, is what caught it — it didn't ask "did the tests pass," it asked
"what could still be wrong that the tests don't reach," and then went and
looked at the code that couldn't be tested. That's a different skill than
grading test output, and it's the reason the checker exists as a second agent
rather than a second test run.

---

## 2026-08-16 — A rejected test taught the codebase something about itself

Step 3.3.1 needed a small, unglamorous piece: download one whisper model on
first use, remember its path, don't re-download it. The implementation was
routine. What was worth noticing came from the checker's review of the tests.

An early version of one test asserted the returned file path contained
`.bin` — a reasonable thing to check, since the model being downloaded is a
`.bin` file. It failed. Not because the download logic was wrong, but
because the project's shared `expo-file-system` mock — built earlier for the
LLM model download, and reused here because reusing an established mock
beats writing a new one — always synthesizes a filename ending in `.gguf`,
regardless of what URL was actually requested. The honest fix wasn't to
patch the mock or invent a workaround; it was to admit the assertion was
testing the mock's fixed behavior, not the code's, and replace it with one
that actually distinguishes correct from broken: does the returned path
match what got persisted?

The checker didn't take that explanation on faith either. It read the mock's
source directly, confirmed the `.gguf` suffix really is hardcoded and
URL-independent, and pointed out something sharper: the sibling LLM test
(`manage-models.test.ts`) has the exact same latent gap — a `.gguf` assertion
that would pass against any URL, correct or not — and nobody had ever
noticed, because it happened to be checking for the extension the mock
always produces anyway. The bug had been sitting there, silently
unfalsifiable, since the mock was first written.

The same review surfaced a second, unrelated thing worth keeping: this
project's own architecture doc had, months earlier, written down the exact
condition under which a `shared/fs` wrapper should be extracted — "when a
second slice needs the filesystem" — and predicted `attachment` (a much
later phase) as the example of when that would happen. It happened here
first, quietly, because `manage-stt-model` needed the same `Directory`/
`File`/`Paths` calls `manage-models` already had. The condition fired years
of roadmap early. Nothing forced anyone to notice; the doc just happened to
have already named the trigger, so recognizing it was a lookup, not a
judgment call.

**Article angle:** a shared test mock is a piece of infrastructure with its
own behavior, and that behavior can quietly become the thing under test
without anyone deciding that on purpose. The tell is a mock whose fixed
output happens to satisfy an assertion by coincidence rather than by the
code doing something right — and the way to catch it is the same discipline
used everywhere else in this loop: ask whether an assertion would survive
the implementation being wrong, not just whether it currently passes. The
second lesson is smaller but just as practical: a "when X happens, do Y"
note in a design doc is worth writing down not because you'll remember to
check it, but because something else — a checker, a future contributor, a
grep — can notice X happened even when no one was watching for it.

---

## 2026-08-17 — A false negative hiding in a Jest matcher, not in the code

Step 3.5 (local TTS, `shared/tts` over `expo-speech`) was a small, quiet step
after several rounds of genuinely hard bugs — which made it a good place for
the checker to demonstrate a different, less dramatic kind of rigor: not
"is this logic wrong" but "would this test actually catch it being wrong."

The implementation filters which options it forwards to `expo-speech.speak`
— if the caller didn't set `pitch`, the code should not send
`{ pitch: undefined }`, it should send nothing at all. One test pinned
this: `expect(options).not.toHaveProperty("pitch")`. That reads like a
solid assertion. It is not, on its own — because `toHaveProperty` in Jest
returns `true` for a key that exists with the value `undefined`. A test
author's natural intuition ("this key isn't there, so `toHaveProperty`
should say no") is simply wrong about how the matcher works. Written the
naive way, the test would pass whether the implementation filtered the key
out or just set it to `undefined` explicitly — silently proving nothing
about the exact behavior it claimed to check.

The checker didn't take the test's intent on faith. It wrote a two-line
standalone probe — `expect({ x: undefined }).toHaveProperty("x")` — ran it,
watched it come back `true`, and only then decided the real test (which
does the filtering correctly, so the key is genuinely absent, not merely
`undefined`) is load-bearing after all. Same discipline as every other beat
in this loop, applied to a much smaller, easier-to-miss target: a matcher's
actual semantics, not just the code's.

The same review also traced *where* a piece of logic actually lives when a
production module and its test mock split responsibility for a callback
API. `expo-speech.speak()` is callback-based; `shared/tts`'s job is to wrap
it in a promise, and specifically to decide that `onStopped` means
*resolve*, not reject — a deliberate design choice (the user asked to stop;
that's not a failure). The mock's job is only to decide *which* callback to
invoke, based on a test-set outcome. It would be easy to accidentally build
a mock that also encodes the resolve/reject decision itself, which would
make the tests pass regardless of whether the real module's `onStopped`
handler was ever written correctly. The checker explicitly confirmed the
mapping lived only in `shared/tts/index.ts` before trusting the tests meant
anything about it.

**Article angle:** not every finding worth having is a logic bug in the
implementation. Some of the most valuable checker passes are checks on the
*test's* own instrument — does the matcher actually mean what its name
suggests, and does the mock quietly do the job the code under test was
supposed to do. A test suite that's green for the wrong reason is worse
than an obviously red one, because nothing about running it tells you it's
lying — you have to go looking, on purpose, the way the checker did here
with a two-line throwaway probe.

---

## 2026-08-17 — When a comment explaining *why not* is the bug

Step 4.1 (at-rest encryption via SQLCipher) started with a question the plan
step's own wording didn't answer: is "SQLCipher via expo-sqlite" — sitting
right there in CLAUDE.md's stack table — something the actually-installed
package can do, or an aspirational line nobody had checked yet? expo-sqlite's
runtime API (`SQLiteOpenOptions`) has no cipher option at all, which looked
at first glance like a real, hard blocker — SQLCipher usually means
compiling a forked SQLite. The answer turned out to be sitting one directory
deeper than the runtime types: the package's own config-plugin source
(`plugin/build/withSQLite.js`) has a first-class, already-shipped
`useSQLCipher` build-property flag for both platforms. The feature was real;
it just wasn't visible from the layer that felt like the obvious place to
look. The lesson generalizes past this one library: "does X support Y" is
sometimes a config-plugin question, not a runtime-API question, and checking
only one of those two layers can produce a false "not possible."

The sharper moment came from the checker, on a piece of code that was
*trying* to do the right thing. `resetVault` (the wipe-and-restart recovery
path) didn't write an audit entry, and the code carried a comment explaining
why: "there is no live audit entity available to write into" before the
vault is even unlocked. That's a real constraint — for *unlock*, it's true.
The checker didn't accept the comment as a boundary and move on; it traced
the actual call graph and found `Providers` already opens the database
unconditionally, unkeyed, at app boot, running every migration including the
audit table's, before any vault gate exists to prevent it. The justification
was reasoning about an app that doesn't exist yet (one where the vault
gates the database open) rather than the one actually shipping. A
self-documented reason for skipping a hard rule is not evidence the rule
doesn't apply — it's a claim about the code's own control flow, and claims
about control flow are exactly the kind of thing that's cheap to verify and
expensive to assume.

Fixing it surfaced a second, genuinely unresolved tension worth being
honest about rather than papering over: the fix — log the wipe, then
delete the database — means the log entry gets deleted along with
everything else it was supposed to be a durable record of. A "wipe" audit
entry that only survives if the process crashes mid-wipe isn't nothing (it
catches partial failures), but it isn't the tamper-evident trail the rule
seems to promise either. Rather than quietly inventing a second, wipe-proof
audit sink to make the problem look solved, that gap got written down as an
open question — one that will resurface identically when 4.5's full
wipe-data feature gets built, and is better decided once, deliberately, than
patched twice by accident.

**Article angle:** the two most valuable findings this beat weren't "this
code is wrong" — they were "this code's explanation for itself is wrong."
A missing feature can be found by reading the right file one layer deeper
than expected. A missing safeguard hiding behind a comment that explains
why the safeguard doesn't apply here needs the comment's *claim* verified
against the code's actual behavior, not just the code's behavior verified
against the comment. The second kind of bug is more dangerous precisely
because it looks reviewed — someone already wrote down a reason.

---

## 2026-08-17 — A real architecture rule, used to justify the wrong conclusion

Step 4.2 (biometric/passphrase app lock) produced the cleanest example yet
of a pattern worth naming: an argument can be entirely factually correct and
still be wrong, because it proves less than it's being used to prove.

The reasoning was: `features/app-lock` needs a passphrase fallback, the
passphrase check lives in `features/encrypt-vault`, and FSD forbids one
feature importing another (true — verified, and actually lint-enforced at
error severity, not just written down as a convention). Conclusion: the
passphrase fallback, and the actual lock-state logic around it, belongs
somewhere else entirely — a future provider — so this beat shipped only a
bare biometric-check wrapper with nothing built on top of it.

The rule was real. The conclusion didn't follow from it. "Can't import that
feature directly" and "therefore none of the composition logic belongs
here" are two different claims, and the gap between them was papered over
by a doc comment rather than examined. The checker didn't just say "this
seems thin" — it went and found the specific place this exact problem had
already been solved in this same codebase: `features/voice-input` needs
`shared/stt`'s context but can't assume when it'll be ready, so it takes
`getSttContext` as an injected function instead of importing the thing that
produces it. The same move — inject the concrete dependency instead of
importing the module that owns it — dissolves the "can't import" problem
without touching the layering rule at all, and leaves the actual gate logic
(lock state, which unlock method to try, when to notify) sitting in the
feature layer where CLAUDE.md says business logic belongs, testable without
any UI.

It also compounded a second problem worth naming on its own: the doc
comment justifying the narrow scope said "see BLOCKED.md" for the deferred
work. BLOCKED.md hadn't been touched. That's a smaller version of the same
underlying failure — writing down that something is handled somewhere else
is not the same as it being handled somewhere else, and the gap between
those two is exactly the kind of thing that's invisible from inside the
change and a one-command `git diff --stat` away from outside it.

**Article angle:** the most dangerous wrong scope decisions aren't the ones
with no justification — they're the ones with a *correct* justification
attached to the wrong conclusion. "This import is forbidden" is true and
irrelevant to "therefore skip the logic" once there's a known pattern
(dependency injection) for getting the behavior without the import. Good
review here didn't mean disputing the architecture rule — it meant checking
whether the rule actually forced the outcome it was being used to justify,
and going looking for the counter-example already sitting in the same repo.

---

## 2026-08-17 — Silencing a lint warning is not the same as fixing what it warned about

Step 4.3 (the privacy egress indicator) produced a small, precise example
of a mistake worth naming on its own: `PrivacyBanner` needed to subscribe
to a tiny external store (`shared/egress`, tracking whether a network call
is in flight) and re-render when it changed. The first version read the
initial value with `useState(isEgressActive())` and subscribed inside
`useEffect`. ESLint's `react-hooks` rule immediately flagged a version of
this that also called `setState` synchronously inside the effect, as a
performance anti-pattern. The fix applied was to just remove that call —
the warning went away, the tests still passed, the diff looked clean.

It was also wrong. `useEffect` runs *after* React commits and paints, not
synchronously after the value was read during render. In the gap between
those two moments — render, then commit, then finally the effect
subscribing — an external transition can happen and nobody is listening
for it yet. It's a real, if narrow, window: not "eventually consistent
with a delay," but "silently wrong until the next unrelated change happens
to correct it, or forever, if the store settles back to a value that
matches the stale initial read." The checker didn't accept "the lint
warning is gone" as evidence the code was right — it re-derived what
`useEffect`'s actual timing guarantees are and found the specific gap.

The fix wasn't a cleverer version of the same pattern — it was recognizing
that this is a solved problem with its own purpose-built API.
`useSyncExternalStore` exists precisely for "subscribe to something outside
React without tearing or missing an update," and using it closes the gap
structurally (React re-reads the snapshot itself around the subscription)
instead of via a hand-rolled resync that a linter would immediately flag
right back.

**Article angle:** a lint rule firing is a symptom, and removing the code
that triggered it treats the symptom, not necessarily the cause. The
useful question when a warning appears isn't "how do I make this stop
complaining" — it's "what is this warning actually protecting against, and
does my code still need that protection after I change it." Here the
warning was protecting against exactly the bug that reappeared once the
protection was removed; the real fix was recognizing the situation as a
known, named problem with a purpose-built solution, not patching around a
linter's complaint.

---

## 2026-08-18 — The same lie told twice: a comment citing a document that was never written

Step 4.4 failed its first checker round for a mistake this loop had
already made and supposedly learned from two beats earlier, on 4.2: a code
comment claimed a scope decision was "flagged in `.claude/loop/BLOCKED.md`"
when the file had never actually been touched. Same words, almost — same
shape of sentence, same false confidence, same file. The checker caught it
the same way both times: not by disputing the underlying decision, but by
running `git diff --stat` against the one file the comment named and
finding it unchanged.

What makes this worth writing down isn't that the mistake happened once —
mistakes happen — it's that it happened *again*, in the same session, by
the same process, after the exact same correction had already been applied
and journaled in detail. The first time, the fix was narrow: write the
missing BLOCKED.md section, tighten the comment, move on. What didn't
happen was turning that into a standing habit — check, before writing any
comment that cites a document, whether the citation is true right now, not
whether it's true in spirit or about to become true. A "see BLOCKED.md"
comment is not documentation of an intention; it's a factual claim about
the current state of a specific file, and factual claims are exactly the
kind of thing that should never be written before they're true.

The deeper failure mode here is a general one, not specific to this
project's spine files: an AI-assisted loop (or any developer, for that
matter) that documents *decisions* while implementing them will naturally
reach for phrasing like "see the tracking doc" as a way to signal "this was
considered, not overlooked." That phrasing is cheap to write and easy to
believe while writing it — the intention to actually go add the entry is
real in the moment. But intention isn't verification, and a reviewer
(human or automated) that takes the claim at face value would have shipped
a comment lying about its own paper trail, twice, in the same afternoon.

**Article angle:** self-documentation has the same trust problem as
self-testing — a comment claiming "this is tracked elsewhere" needs the
same discipline as a test claiming "this proves X": don't write it until
you've confirmed the thing it points to actually exists, and don't treat
"I already fixed this exact bug once today" as evidence it can't happen
again. If anything, having just fixed it is a reason to specifically check
for it a second time, not a reason to assume the lesson is now permanent.
The fix that finally stuck here wasn't a smarter comment — it was writing
the BLOCKED.md section *before* the comment that cites it, so the citation
could never be false in the first place.

---

## 2026-08-18 — Three strikes: when a per-instance fix isn't a fix

The false-BLOCKED.md-citation mistake (a code comment claiming "see
BLOCKED.md" for content that was never actually written there — see this
file's entry two days earlier, on step 4.2) happened again on step 4.4.
Then it happened a third time, on step 4.5, in the same session, using
almost the same sentence structure each time. Each occurrence was caught
the same way — a checker running `git diff --stat` on the one file the
comment named — and fixed the same way: write the missing content, correct
the comment. The fix worked, locally, every single time. It just never
generalized.

That's the actual lesson, and it's a different one from the 4.2 entry's.
The 4.2 write-up said "verify a citation before writing it, the way you'd
verify a test." That's true, and it's still true — but stating a
discipline in a narrative document (a journal entry, an article draft) and
expecting it to change future behavior turns out to be exactly as reliable
as the original mistake it was trying to prevent. This loop's own
architecture already explains why: every beat is a fresh session with no
memory of the last one. `journal.md` and `ARTICLE.md` get *read*, as
background context alongside dozens of other things, but nothing about
reading a paragraph of prose enforces that its lesson actually gets
applied three steps later under time pressure, mid-implementation, writing
a comment that just wants to explain itself.

The actual fix, once it became obvious a third time wasn't a coincidence,
was to stop treating this as a lesson to remember and start treating it as
a rule to enforce — by editing the two files this loop's own engine
re-reads, verbatim, at the start of every single beat: the beat algorithm's
Definition of Done, and the checker's standing review instructions. A rule
sitting in the actual instructions a fresh session loads is structurally
different from a rule sitting in a log a fresh session might skim. One is
enforced by re-reading; the other is enforced by remembering, and
remembering is exactly the thing a stateless-between-beats loop can't do.

**Article angle:** in a system with no persistent memory across
iterations, "we already learned this" is not a safe assumption — the
system re-derives its behavior from its instructions every time, not from
its history. A mistake that recurs isn't asking for a better-written
explanation of why it's wrong; it's asking for the rule to move from the
narrative layer (journal, article, commit messages — read, but optional in
practice) into the operational layer (the skill file itself, the checker's
own prompt — read and structurally binding). The number of times a mistake
repeats before that move happens is a real cost, and three is at least one
too many.

---

## 2026-08-18 — Following up: did editing the instructions actually work?

The previous entry ended on a claim, not a result: that a mistake
recurring three times in a row meant the fix belonged in the loop's own
instructions (`.claude/commands/safe-loop.md`, re-read fresh every beat)
rather than in a journal a future beat might only skim. That was a
prediction. This entry is the check.

The very next beat gave it a real test, unprompted — a genuine
architectural mistake happened mid-implementation (a widget importing
directly from the app layer, a forbidden upward dependency this project's
FSD rules explicitly forbid), caught immediately by `eslint`, fixed
properly, and the resulting diff went to the same kind of independent
checker review as everything else in this loop. The checker was told,
explicitly, to treat this diff as the test case for whether last beat's
rule change held. It passed on the first attempt — no false citation, no
fourth occurrence of the pattern that had shown up three beats running.

One clean pass is a small sample size, and it would be a mistake to
overclaim permanence from it — the honest version of this entry is "held
once, worth watching," not "solved forever." But it's a meaningfully
different kind of evidence than the previous entry had: not "here is why
we believe editing the instructions should work" but "here is what
happened the next time the same situation arose." The distinction matters
for anyone building an unattended, memoryless-between-iterations loop like
this one: a fix's credibility shouldn't rest on how convincing the
reasoning sounds at the moment it's written, because that reasoning
sounded just as convincing the first two times the same mistake got
"fixed" and then happened again anyway. It should rest on whether the next
independent occurrence, tested under the same adversarial review the
mistake was originally caught by, actually goes differently.

**Article angle:** in any system that can't rely on memory to enforce a
lesson, the honest unit of progress isn't "we identified the problem and
explained the fix" — it's "the fix was tested against a fresh, real
instance of the problem, and held." Writing that follow-up down, separate
from the fix itself, is what turns a plausible-sounding correction into a
verified one.

---

## 2026-08-18 — Catching your own comment lying about your own code

A small moment, easy to miss in a changelog but worth naming on its own.
Writing `features/backup-restore`, I documented a property I intended to
be true: the destructive "wipe" audit entry gets written only after a
restore actually succeeds, never on a failure partway through. Then,
re-reading the function right after writing that sentence, the code
underneath it did the opposite — the audit write sat *before* the
destructive loop, not after. Nobody flagged it. No test failed. It was
just a comment and the code it described quietly disagreeing, the kind of
drift that ships constantly and usually isn't caught until much later, if
ever.

What made this worth writing down is the contrast with everything logged
here over the past several beats: a string of checker rounds spent
catching exactly this shape of problem — a claim in a comment that wasn't
backed by what the code (or `BLOCKED.md`) actually did. Each time, the fix
was mine, but the catch belonged to an independent reviewer looking at
work I'd already convinced myself was finished. This time the catch
happened on my own first re-read, before anything was sent anywhere. Not
because I got smarter about the specific bug — a doc-comment/code mismatch
is a generic, boring class of error, not a special one — but because the
habit of asking "does this claim actually hold, right now, in the code I
can see" had apparently become something closer to a reflex than a
checklist item invoked only when a reviewer's report demanded it.

**Article angle:** the real measure of whether a review discipline has
taken hold isn't how well it performs when someone else is running it against
you — it's whether it starts firing on your own first pass, unprompted,
before there's an audience to catch you skipping it. A team (or a loop)
that only writes honest code when a reviewer is watching has installed a
gate, not a habit. This is one small, unglamorous data point that the
difference is showing up here — worth noting, not overclaiming: one
instance is a data point, not a trend, and the next beat is the real test
of whether it holds.

---

## 2026-08-18 — A plan's numbering is not its dependency graph

Every beat this whole run has walked `docs/DEVELOPMENT_PLAN.md` in the
order its steps are written, on the working assumption that the plan's
own numbering already encodes the right sequence to build things in. That
assumption held for five phases. It broke on step 6.3.

The break was small and mechanical to find: building `capsules/index.tsx`
needed nothing more than what `entities/capsule` already provided. But
building the plan's other three named capsule routes — `new.tsx`,
`[id].tsx`, `[id]/edit.tsx` — required a `CapsuleType` to exist first, and
nothing anywhere in the codebase creates one. That capability is `6.7`,
four steps *later* in the same phase. The plan's own numbering put the
screens that need a type before the feature that creates one.

This is worth separating from every other "genuinely blocked, not lazily
deferred" moment logged earlier this run (3.3's STT model gap, 5.2's
missing capsule entity, 5.4's four unstarted import formats) — those were
all cases of *this specific step* needing something that simply didn't
exist yet anywhere in the plan. This one is different: the missing thing
isn't undiscovered work, it's mis-ordered work — sitting later in the same
document, fully specified, just numbered wrong relative to what actually
depends on it. Confirming that difference took an actual check, not
inference from the step numbers themselves: grepping for real callers of
`insertCapsuleType` and `insertCapsule` and finding none, anywhere, rather
than assuming a later-numbered step must mean "not needed yet."

**Article angle:** a phased plan's step numbers encode the order someone
expected to explain the work in, which is a different thing from the
order a dependency graph would put it in — usually they're close enough
that following the numbers works fine, right up until a step quietly
assumes a capability that got written down four lines further along the
same document. The fix isn't to distrust the plan; it's to keep checking
a step's *actual* prerequisites against what's really in the codebase
before building on top of them, the same discipline this loop already
applies to checker findings and its own doc comments — just aimed, this
time, at the plan document itself rather than at the code.

---

### 2026-08-19 — A test that only ever removes the last item can't catch what happens when you remove the first one

Building `manage-schema`'s `addField` (step 6.7), I wrote a function to append
a new field to a `CapsuleType` and gave its `sortOrder` the type's current
field *count* — reasoning that if a field was removed earlier, the count
naturally accounts for the gap. I wrote a test to back up exactly that claim:
create two fields, remove the second one, add a third, assert no collision.
It passed. The checker's independent review found the claim was false anyway.

The bug: field count only equals "the next free `sortOrder` slot" when the
field that got removed happened to be the *last* one in order. Remove a
first or middle field instead — `[A:0, B:1]`, remove A, leaving only `B:1` —
and the count is 1, so the next `addField` also lands at `sortOrder` 1,
colliding with the surviving B. My test never removed anything but the last
item, so count-based and `max(sortOrder)+1`-based derivation looked
identical from where I was standing. The docstring I wrote alongside the
code ("removing a field never leaves a gap that a later add could collide
into") was stated as a general property when it had only actually been
checked against one specific, easy case.

This is the same shape of gap as 5.4's ChatGPT-import `parentIndex` bug from
earlier this run (a single-pass tree resolution that happened to work for
every case the test data covered, and only for those cases) — both times,
an ordering/positioning property was asserted from a test that exercised
exactly one branch of the state space, the branch where the naive
implementation and the correct one give the same answer. Neither test was
dishonest or lazy on its face; both looked like reasonable coverage of "the
thing I just built." The gap only shows up when someone — here, the
checker — asks "what if the removed item *wasn't* the special one?"

**Article angle:** for any function whose correctness depends on *order* or
*position* (sort indices, tree parent pointers, anything with a "first",
"last", or "next" in its own reasoning), a single happy-path test is
structurally the wrong shape of proof — the interesting bugs live
specifically in the positions a naive implementation treats as
interchangeable with the general case, and only checking the position that
happens to be trivial gives false confidence. The fix that generalizes: for
ordering-sensitive logic, deliberately write the *non-trivial* case first
(remove something other than the edge item, resolve a parent that appears
out of order) rather than reaching for whichever case is easiest to set up
and calling it representative.

---

### 2026-08-19 — A UI change can falsify a sentence in a completely different screen

Finishing `SchemaBuilder`'s routes meant a real way to create a `CapsuleType`
existed in the app for the first time. Nothing about that touched
`capsules/index.tsx` — different route, different feature, not in this
step's stated scope at all. But `capsules/index.tsx` already had a sentence
on screen for the empty-types case: *"Type management is not built yet."*
That sentence was true when it was written (beat 27, before 6.7 existed)
and became false the instant this beat's routes landed, without a single
line of `capsules/index.tsx` needing to change for the underlying fact to
shift under it.

Nothing would have caught this automatically — it's not a type error, not
a failing test, not a lint rule. The only way to catch it is to ask, after
finishing a change, "what does this make newly false somewhere else?"
rather than just "does this satisfy the step I was given." That's a
narrower, more mechanical version of the same discipline this run has
applied to code comments citing `BLOCKED.md` content that wasn't there
(3 occurrences, eventually fixed structurally in `safe-loop.md` itself) —
except here the claim wasn't even a comment in the diff under review, it
was a pre-existing sentence in an unrelated file with no obvious link to
this step's own change.

**Article angle:** most staleness-detection advice is about comments and
docs describing the code they sit next to — "does this docstring still
match this function." The harder version, with no established checklist
item for it, is user-facing copy that describes the *state of the product*
elsewhere — an empty-state message, a "coming soon" label, a disabled
button's tooltip — which goes stale the moment some other, unrelated part
of the codebase changes. Catching it isn't a code-review technique; it's a
product-sense habit of asking "who else was relying on the old world being
true" before calling a step done, the same reflex a human maintainer would
need and one worth deliberately building into an agentic loop's own
Definition of Done, not just assuming it falls out of "tests pass."

---

---

### 2026-08-19 — When the autonomous loop finds someone else's unfinished work

An unattended `/loop` beat's health check is supposed to handle one failure
mode: a dirty tree left by a *dead* beat (this same loop, interrupted).
Today it hit a different one — a dirty tree with real, coherent, 150+-line
diffs across three route files, and *no* matching entry in the journal or
`state.json` at all. The loop's own contract only gives two moves for a
dirty tree: finish it, or `git reset --hard` to the last checkpoint. Neither
move is safe when the tree might not be dead — `ps aux` turned up a second,
separately-resumed Claude Code session with live read access to the same
repo, at the same time. Resetting could have destroyed someone else's actual
work; silently finishing it risked writing into files mid-edit under another
process.

The loop stopped and asked a person instead of picking one of its two
built-in options. That's the actual point: an autonomy contract's failure
modes are usually written for the failures its author anticipated (a crash,
a timeout), and a well-designed unattended loop needs a third path —
"the evidence doesn't match either assumption I was built for, stop and
surface it" — for the failure nobody wrote a rule for. A loop that only
knows "finish" or "reset" will eventually guess wrong on the case its rules
never imagined.

Once a human confirmed the WIP was legitimate and asked for it to be
finished rather than discarded, reviewing someone else's uncommitted,
un-journaled diff turned out to need the same discipline as reviewing your
own: check it against the repo's *actual* conventions, not just "does it
run." The three route diffs were solid, but one of them — an edit screen's
save handler — hand-diffed which fields had actually changed directly
inside the route component. `docs/ARCHITECTURE.md` already has a rule for
this ("route files contain no business logic"), and an earlier beat had
already established the concrete precedent for *how* to fix it: pull real
logic into its own pure, tested module, the same move that produced
`SchemaBuilder`'s `moveField.ts`. Applying a precedent set by a different
beat, on code a different session wrote, is a small proof that the pattern
generalizes rather than being a one-off.

The tests for that extraction needed one non-obvious trick. The DB's own
upsert preserves a value's `id` and `createdAt` across *any* write, whether
the value actually changed or not — so after a "no-op" save, the row looks
identical to a save that wrote the same value back. The only field that
moves on a real write and stays frozen on a skipped one is `updatedAt`.
Proving "this was correctly skipped" therefore isn't a value assertion at
all — it's an equality check on a timestamp that a naive test would never
think to make, because the row's *content* alone can't distinguish the two
cases.

**Article angle:** "resume the loop" and "the loop found unrecorded work
mid-flight" are different events, and conflating them is how autonomous
systems clobber real work. The interesting decision here wasn't the
diffing-logic extraction (routine, if you already have the `moveField.ts`
precedent) — it was recognizing, from process-table evidence rather than
from anything in its own spine, that the situation didn't match either of
its two hardcoded recovery paths, and that the honest move was to ask
before choosing one anyway.

---

---

### 2026-08-20 — Catching your own process violation mid-step, not after

This run's contract has one non-negotiable rule that's easy to state and,
it turns out, easy to quietly skip under time pressure: write the failing
test before the implementation. Every step so far had followed it. This
beat didn't — the sort-direction-toggle logic for `FilterSheet` got
written first, out of habit, the same five minutes after deciding "this
needs its own tested module" that had worked cleanly for `SchemaBuilder`'s
`moveField.ts` two beats ago.

The interesting part isn't that it happened — it's what "catching it"
actually looked like in practice: not a reviewer flagging it later, not a
lint rule, not the checker (which only sees a finished diff and has no way
to know what order the files were written in). It was noticing, mid-step,
before moving on to the next file, that the just-written implementation
had no failing test behind it — and treating that as a real problem worth
undoing, not a technicality to wave past since the logic was "obviously
right." The fix cost thirty seconds: delete the implementation, write the
test, watch it fail for a real reason (`Cannot find module`), rewrite the
implementation. The fix wasn't the point. Noticing was.

**Article angle:** most discussion of TDD-in-agentic-loops is about
whether the *rule* survives — does the checker catch a test that never
failed, does the Definition of Done reject a step without one. Less
discussed: enforcement has to work even when nothing external is watching
the *order* things happened in, only the *result*. A reviewer diffing the
final commit cannot tell "test written first, confirmed red, then
implemented" apart from "implementation written, test added after to
match it" — both produce an identical git diff. The only place that
distinction is visible at all is inside the single continuous stretch of
actions between deciding to build something and finishing it. Which means
the discipline only actually exists if it's self-enforced in the moment,
not because a downstream check would have caught it (it wouldn't have) —
a genuinely harder property to build into an autonomous loop than "run
the linter," and the one this beat happened to test.

---

---

### 2026-08-20 — Seven "done" steps, checker-reviewed and green, on tables that would never exist

Every step in this run gets the same treatment: TDD, a gate of tsc/jest/
eslint, an independent reviewer subagent that's explicitly told to try to
refute the diff. Seven capsule-domain steps (6.1 through 6.7) went through
that exact process, all passed, all checkpointed, all ticked in the plan.
And none of it would have worked on a real device — `Providers`, the one
place that decides what tables actually get created when the app boots,
never imported a single capsule migration. `insertCapsule` would have
hit `no such table: capsules` the first time a real user opened the app.

The layered reason this slipped seven checker passes in a row is the more
interesting part than the bug itself. Every capsule test — and there were
hundreds by this point — calls `runMigrations` with its own explicit,
hand-picked list of exactly the tables that test needs. That's a
reasonable, even good, testing pattern in isolation: each test is
self-contained, fast, doesn't depend on unrelated migrations. Its blind
spot is that it means no test, ever, exercises the *actual* list
`Providers` uses to boot the real app. A hundred passing tests, each
correctly proving "this feature works, given the right tables exist," add
up to zero evidence that the tables get created in practice.

Reflex was to write the obvious regression test — import `Providers` (or
its `remigrateDb` helper) and assert the boot path creates the tables. It
couldn't even load: `app/providers/index.tsx`'s first import is
`react-native-unistyles`, which needs a real native module and throws
under jest before a single line of test logic runs. That's not a second,
unrelated bug — it's the actual root cause of the first one. The
migrations array wasn't just *untested*, it was *untestable*, by
construction, for as long as it lived inside the one file jest could never
safely import. No amount of "remember to test this" would have fixed it;
the file itself made the category of test impossible to write. The fix
had to be structural — pull the array into its own module with zero
native-UI imports — not a reminder or a checklist item.

**Article angle:** "the tests all passed" and "the reviewer approved every
diff" are both true statements about this run's capsule work, and neither
one implies the feature actually functions, because both were scoped to
exactly the surface each test author chose to exercise — and the one
integration point that mattered (what the real app boots with) was never
in anyone's diff to review, because no plan step named it. A maker-checker
loop, however disciplined, only ever verifies the code that gets shown to
it; the actual gap here is a step that plan and process both had no name
for — "does the sum of these independently-correct pieces boot" — and the
fix that mattered wasn't more diligence on any one step, it was
restructuring the code so that question became askable in the first
place.

---

---

### 2026-08-21 — A lesson only counts once it's applied before the mistake, not after it

Two entries ago, this run found that seven "done," checker-approved steps
had built an entire feature domain on tables the real app would never
create — `Providers` never registered the migrations. One entry after
that, building a second domain (tags) in the very next beat, the same
class of gap showed up again: a new migration, written and tested, sitting
unregistered until the checker's own review caught it and it got patched
in as a same-beat addendum.

This beat built a third domain — capsule-to-capsule links — and did
something different: registered the new migration and wired the
`delete-capsule` cascade *in the same pass* the entity was written, before
any test or checker had a chance to flag their absence. Not "remembered
to do it eventually." Not "caught by review and fixed." Simply never
missing in the first place.

That's the actual test of whether a lesson from two entries ago landed —
not whether it gets written down as a rule, not even whether the *next*
instance of the same mistake gets caught and fixed quickly. A fix applied
reactively, however fast, still proves the underlying gap-detection has
to happen every single time going forward, forever, or it recurs. A
lesson that's actually internalized changes what gets written on the
*first* attempt, so there's nothing left for review to catch. Two
data points don't prove a trend, but the shape of the change is the
right one to watch for: from "caught and fixed" to "never wrong to begin
with."

The same beat also had a smaller, structurally similar moment: the plan
listed step 6.8 before 6.9, but 6.8's "relation field type" turned out to
need 6.9's `entities/link` to exist first — the exact shape of dependency
mismatch this run had already found once before (6.7 needing to precede
6.3/6.5/6.6). Recognizing it a second time and reordering without
hesitation is the same pattern at a different scale: not re-deriving a
lesson from scratch each time, but recognizing "I've been here before" and
acting on it immediately rather than rediscovering it the hard way.

**Article angle:** the interesting metric for whether an agentic loop is
actually learning across a long run isn't "did it write the lesson to a
journal" or even "did it catch the next occurrence faster" — it's whether
the lesson moves earlier in the causal chain each time: from *fixed after
a user complained*, to *fixed after a reviewer caught it*, to *never
introduced at all*. The journal is the record of the mistake; the real
evidence of learning is the beat where the same mistake had no chance to
happen.

---

<!-- Append new dated entries above this line as work progresses. -->
