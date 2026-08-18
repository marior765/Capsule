You are the **loop engine** for Capsule. Scope for this run: $ARGUMENTS

Scope may be `all` (whole plan), a phase (`phase-3`), or a single step (`4.2`).
Empty scope means `all`.

---

## 0. Contract — read this before anything else

**Each beat is a fresh session with no memory of the previous beat.** You did not
run the last iteration. Everything you "remember" is wrong unless it is written in
the spine. Read the spine first, every time, without exception.

The heartbeat is external: the user starts this with `/loop /safe-loop <scope>`.
You do not schedule yourself except via the rules in §8.

**Autonomy settings for this project (decided, do not re-litigate):**

| Setting | Value |
|---|---|
| Human gate | None mid-run — run the whole scope unattended |
| Checker | Independent reviewer subagent on every step (§6) |
| Git | Checkpoint commit per green step, **directly on `main`**, never push |
| Native-dependent steps | Implement + queue for device check; plan box stays **unchecked** |
| Attempt ceiling | 3 per step |
| Stall detector | Same failure signature twice → quarantine the step, move on |
| Global halt | 3 quarantines in a run, or gate red on a clean HEAD |

---

## 1. The spine (persistent state — this is your only memory)

| File | Role | Lifetime |
|---|---|---|
| `.claude/loop/state.json` | Machine-readable cursor, attempts, quarantines, checkpoints | **Never deleted** |
| `.claude/loop/journal.md` | Append-only human narrative, one block per step | **Never deleted** |
| `.claude/loop/BLOCKED.md` | Human-gate queue: what needs a device, a decision, or a key | **Never deleted** |
| `docs/DEVELOPMENT_PLAN.md` | The step registry and statement of intent | Source of truth |

`DEVELOPMENT_PLAN.md` is the registry — do **not** duplicate the step list into
`state.json`. A checkbox there is an **output** of this loop, never an input to
step selection (see §4: selection reconciles against the code, not the checkbox).

Write to the spine **before** and **after** work, never only after. A beat that
dies mid-step must leave enough behind for the next beat to recover.

`state.json` schema:

```json
{
  "run": { "scope": "all", "started": "<ISO>", "beat": 0, "status": "running|halted|complete" },
  "cursor": { "step": "3.1", "phase": 3 },
  "steps": {
    "3.1": {
      "status": "pending|in_progress|done|quarantined|blocked|deferred",
      "class": "logic|ui|native",
      "attempts": 0,
      "failureSignatures": [],
      "checkpoint": "<git sha>",
      "notes": ""
    }
  },
  "quarantinedThisRun": [],
  "lastGate": { "tsc": "pass", "jest": "pass", "eslint": "pass", "at": "<ISO>" }
}
```

Only steps you have actually touched need an entry. Absent = `pending`.

---

## 2. Beat algorithm

Execute in order. Do not skip steps. Do not reorder.

**1 — Load spine.** Read all three `.claude/loop/` files. If `state.json` is
missing, run BOOTSTRAP (§3) and stop the beat there.

**2 — Health check.** Run `git status --short`, then the full gate (§5) against
HEAD *before* touching anything.
- Working tree dirty from a dead beat → read the journal's last block. If it was
  mid-step, either finish it or `git reset --hard` to that step's `checkpoint`.
- Gate red on a clean tree → **RECOVER mode**: fixing that is the only work this
  beat. Do not start a new step on a red baseline.

**3 — Select the next step** per §4. None available → go to step 13.

**4 — Reconcile before working.** The plan is stale in both directions — bare
`index.ts` stubs exist for slices whose boxes are unchecked. Confirm the step is
genuinely not done using the Definition of Done (§5). Already satisfied → mark
`done`, tick the box, journal one line, and return to step 3. Do not re-implement.

**5 — Plan.** Follow `.claude/commands/plan.md` internally: read the step text,
`docs/ARCHITECTURE.md`, and every existing file in the touched slices. Identify
each file to create or modify. Do not print the "Approve to proceed" line — there
is no human here. Record the file list in the journal block.

**6 — Tests first (non-negotiable).** Invoke `/create-tests <step> <depth>`
(`medium` default; `hard` for anything touching crypto, wipe, export, or branch
logic). Then **run them and confirm they fail.**
- Record the failure output as the step's `failureSignature`.
- Tests that pass immediately are a red flag, not a win — either the step is
  already done (→ back to step 4) or the tests assert nothing. Investigate; never
  proceed on tests that never failed.

**7 — Implement.** Write the minimum that makes the tests pass. Respect every rule
in `CLAUDE.md`: no `any`, public API through `index.ts` only, no llama.rn or
whisper.rn outside `shared/`, testIDs via `createComponentTestIDs`, **no network
calls in core logic**.

**8 — Gate.** Run §5. Any red → increment `attempts`, compare the new failure
against `failureSignatures`:
- New signature → fix and retry (back to 7).
- Repeat signature, or `attempts >= 3` → **quarantine** (§7).

**9 — Check (maker-checker).** Spawn the reviewer subagent (§6). It has no
implementation context and is told to refute. Verdict `fail` → treat findings as a
new failure signature and return to 7 (counts as an attempt). Verdict `pass` → continue.

**10 — Checkpoint.** `git add -A && git commit` on `main` with
`feat(<step>): <summary>`. Record the sha as the step's `checkpoint`. Never push.

**11 — Record outcome.**
- `class: logic|ui` → tick `[x]` in `docs/DEVELOPMENT_PLAN.md`.
- `class: native` → **leave the box unchecked**, append an entry to `BLOCKED.md`
  with what a human must verify on a device and how. The box is the user's to tick.
- Append the closing journal block either way.

**12 — Docs (standing instructions).** If the step produced a genuine insight —
an architectural choice, a mistake and its correction, a tool discovered — append
a dated entry to `docs/ARTICLE.md` above the trailing marker comment. Mechanical
steps get nothing; a journal of "implemented 4.3, tests pass" is noise. Flip a
`docs/CHEATSHEET.md` row on first real use of an AI feature.

**13 — Decide continuation.** Apply §8.

---

## 3. BOOTSTRAP (first beat only)

1. Create `.claude/loop/` with `state.json`, `journal.md`, `BLOCKED.md`.
2. Walk `docs/DEVELOPMENT_PLAN.md` and classify every unchecked step in scope as
   `logic`, `ui`, `native`, or `deferred` (§4). Write only the non-`pending`
   classifications into `state.json`.
3. Run the gate against HEAD and store the result as `lastGate`. A red baseline is
   recorded, not fixed, during bootstrap.
4. Journal the bootstrap block and **end the beat.** Real work starts next beat, on
   a spine that is known-good.

---

## 4. Step selection

Walk `docs/DEVELOPMENT_PLAN.md` in phase order, then step order within a phase.
Take the first step that is in scope, unchecked, and **not** `done`,
`quarantined`, `blocked`, or `deferred` in `state.json`.

**Classification** (decides gate strength and whether the box may be ticked):

- `logic` — entities, features, `shared/` modules with no native surface. Fully
  provable by jest. Tick the box.
- `ui` — widgets and routes. Provable by tsc + eslint + render-level tests. Tick
  the box.
- `native` — needs a dev build, a device, or real hardware. **In this repo:**
  3.1–3.5 (whisper.rn), 4.1 (SQLCipher), 4.2 (biometrics), 1.2 (real HuggingFace
  download), 7.1 (embedding model), plus anything requiring `expo prebuild`,
  `expo run:ios`, or `expo run:android`.
  Implement against mocked natives, prove the logic in jest, then queue to
  `BLOCKED.md`. **Never tick the box** — mocked green is not hardware green.
- `deferred` — Phase 9 (all), and any step whose stated dependency is absent
  (e.g. 1.6.1 needs `react-native-markdown-display` + `expo-clipboard`). Adding a
  dependency is itself a decision: queue it to `BLOCKED.md` rather than installing
  it unattended.

Never run `expo prebuild`, `expo run:*`, or any device build inside a beat. They
are long, interactive, and unverifiable here. That is what `BLOCKED.md` is for.

---

## 5. Gate and Definition of Done

**The gate** — all three must pass, in this order:

```bash
npx tsc --noEmit
npx jest --passWithNoTests
npx eslint src
```

**Definition of Done** — testable facts, never opinion. A step is done when:

1. A test file exists at `src/<layer>/<slice>/__tests__/<name>.test.ts` covering it.
2. That suite passes, and it **failed before implementation** (§6 of create-tests).
3. All three gate commands are green.
4. Public API is exposed through the slice's `index.ts`; no cross-slice deep imports.
5. No `any`. Explicit types throughout.
6. Every interactive element has a `testID` from a `createComponentTestIDs` object.
7. No network call was added to core logic.
8. For `class: native` — plus an entry in `BLOCKED.md` naming the device check.
9. **No code comment or doc-string cites `BLOCKED.md`, `journal.md`, or any other
   file for content that isn't actually there yet.** If a comment says "see
   BLOCKED.md" or "flagged in BLOCKED.md," the cited section must already exist
   in the working tree *before* you write the sentence that cites it — write the
   target content first, then the comment, never the other way around. This
   failure mode (a true-sounding citation to a document that was never updated)
   recurred three times in one run (steps 4.2, 4.4, 4.5) before this rule was
   added — it is cheap for a reviewer to catch (`git diff --stat` on the named
   file) and cheap to avoid, so treat an unbacked citation exactly like a test
   that never failed: a sign the step isn't actually done, not a stylistic nit.

A bare `index.ts` stub is **not** done. Existing files prove scaffolding, tests
prove behavior.

---

## 6. The checker (maker-checker separation)

You wrote the code and you wrote the tests. You are therefore the worst available
judge of both. Every step gets an independent reviewer before its checkpoint.

Spawn via the Agent tool, `subagent_type: general-purpose`,
`run_in_background: false` (the checkpoint depends on the verdict). Give it **only**:

- the step's text from `docs/DEVELOPMENT_PLAN.md`
- `git diff HEAD` for the step
- the rules from `CLAUDE.md` and `docs/ARCHITECTURE.md`

Instruct it: *"Try to refute that this diff correctly and completely implements the
step. Default to `fail` when uncertain. Check specifically: do the tests assert
real behavior or merely that a mock returns a value? Is any dependency mocked so
heavily the test proves nothing about our code? Are there hardcoded testIDs? Any
`any`? Any cross-slice import bypassing `index.ts`? Any network call? Does any
comment cite `BLOCKED.md`, `journal.md`, or another file for content that isn't
actually there — run `git diff --stat` on any file a comment names and confirm it
was genuinely touched, not just referenced? Return a verdict of `pass` or `fail`
with concrete file:line findings."*

Do not argue with a `fail`. Fix, then re-review. Two consecutive `fail` verdicts on
the same finding → quarantine.

---

## 7. The three stops

**Success** — proven by the gate + the reviewer, never by your own confidence.

**Attempt ceiling** — 3 attempts per step, then quarantine.

**Stall detector** — the same failure signature twice means you are guessing.
Quarantine immediately; do not spend the third attempt.

**Quarantine procedure:**
1. `git reset --hard <step's last checkpoint>` — leave no half-work behind.
2. `state.json`: status `quarantined`, record the signatures.
3. `BLOCKED.md`: what was tried, what failed, what a human should look at.
4. Journal it, then **continue to the next step.** One hard step must not end the run.

**Global halt** — stop the run and notify (§8) when: 3 quarantines this run, the
gate is red on a clean HEAD after a RECOVER beat, or the scope is complete.

**Context hygiene** — long beats rot. If context is filling with dead ends, end the
beat cleanly at a checkpoint and let the next beat start fresh. A clean handoff
through the spine beats pushing a degraded context forward.

---

## 8. Continuation and notification

At the end of each beat:

- **Work remains, gate green** → continue. In `/loop` dynamic pacing, schedule the
  next beat with a short delay; under a fixed interval, just end the beat.
- **Scope complete** → set `status: complete`, write the run summary, notify.
- **Global halt** → set `status: halted`, write the reason, notify.

Notify via `PushNotification` on halt or completion, with a one-line reason. The
`Stop` hook in `.claude/settings.json` already fires a desktop notification.

**Teardown never deletes the spine.** The old version of this command deleted its
own audit file — that destroyed the run history exactly when it became useful.
`journal.md` and `BLOCKED.md` are the deliverable record of an unattended run.

Final report to the user: steps completed, steps quarantined and why, everything
sitting in `BLOCKED.md` awaiting a device or a decision.
