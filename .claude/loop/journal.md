# Loop Journal

Append-only narrative of every autonomous beat. **Never deleted** — this file and
`BLOCKED.md` are the record of what an unattended run actually did.

One block per step. Opening block written *before* work starts, closing block
after. A step with an opening block and no closing block means a beat died
mid-work; the next beat recovers from its checkpoint.

Format:

```
### <step> — <title>  ·  beat N  ·  <ISO timestamp>
**Class:** logic | ui | native
**Plan:** <files to create / modify>
**Tests:** <test file> — <N> cases, confirmed failing before implementation
---
**Gate:** tsc ✅ jest ✅ eslint ✅
**Review:** pass ✅ / fail ❌ — <findings, if any>
**Checkpoint:** <sha>
**Result:** done ✅ / quarantined ⛔ / blocked 🚧
**Notes:** <what a human would want to know>
```

---

### BOOTSTRAP · beat 0 · 2026-08-12T21:47:20Z

**Baseline gate:** tsc ✅ · jest ✅ (16 suites, 195 tests) · eslint ✅
**HEAD:** `e0020342` — "feat: Phase 1 is finished"

Spine created. Steps classified in `state.json`: Phase 9 and 1.6.1 deferred,
Phase 3 / 4.1 / 4.2 / 7.1 / 1.2 marked `native` (implement + queue, never tick).

Working tree carries a large uncommitted staged change from prior sessions
(capsule/type/persona routes, settings screens, several new slices). The first
working beat must resolve this before starting a step — a checkpoint commit is
meaningless on top of unreviewed staged work.

Reconciliation note for beat 1: `entities/capsule`, `capsule-type`, `field`,
`audit`, `link`, `tag`, `attachment` contain **only** a bare `index.ts`, and the
capsules/types routes are placeholder screens. These are scaffolding, not
implementations — Phase 6's unchecked boxes are correct. Do not mistake file
existence for done-ness.

---

### 3.1 — `shared/stt` whisper.rn wrapper · beat 1 · 2026-08-12T22:10Z

**Class:** native
**Health check:** tree clean at `d331796`; gate green (tsc ✅ · jest ✅ 195/16 ✅ · eslint ✅).
Both bootstrap BLOCKED items resolved without the loop: the uncommitted work was
committed by hand as `29bdaf9` + `d331796`.

**Reconcile:** `29bdaf9 "phase 3 progress"` is misnamed — it is Phase 2 UI work
(settings, personas, chat routes, ephemeral). `src/shared/stt/index.ts` and
`src/features/voice-input/index.ts` are still 11-byte `export {}` stubs, and
`widgets/VoiceRecordButton/` likewise. 3.1 is genuinely not done.

**Environment note:** `codebase-memory-mcp` is not loaded in this session (no such
tools resolvable) and the `expo` MCP is unauthorized. Fell back to Read/Grep.

**Scope call:** step text says "init, record, transcribe, abort". Recording is not
whisper.rn's job — its `RealtimeTranscriber` needs a mic-capture adapter that is
not in `package.json`. 3.1 covers init/transcribe/abort/release; recording is
queued to 3.3 as a dependency decision rather than silently pulling in a package.

**Plan:** create `src/shared/stt/index.ts` (wrapper), `src/shared/stt/__tests__/stt.test.ts`,
`src/__mocks__/whisper.rn.ts`; modify `package.json` (jest moduleNameMapper).

**Tests:** `src/shared/stt/__tests__/stt.test.ts` — 24 cases, confirmed failing
before implementation (`TypeError: initStt is not a function`).

**Attempt 1 — gate red.** `TS2307: cannot find module 'whisper.rn'`. The package's
`exports` map has no `"."` entry, so neither jest nor tsc resolves the bare
specifier. Fixed with a hand-written `src/__mocks__/whisper.rn.ts` + jest
`moduleNameMapper` (matching the project's three existing native mocks) and a
`tsconfig.json` `paths` entry pointing at the shipped `.d.ts`, so the wrapper is
still type-checked against the real API. Plus prettier autofix.

**Attempt 2 — checker returned `fail`.** Findings accepted without argument:
1. `releaseStt` had **no assertion that it released anything** — replacing its body
   with `if (!ctx) return;` left all 24 tests green. A native context leak per model
   load, invisible to the gate. Added an assertion on `ctx.release()`.
2. `"omits params the caller left unset"` could not fail — `toBeUndefined()` cannot
   tell an absent key from one set to `undefined`. `transcribeAudio` now builds its
   options conditionally and the test asserts on key *presence*.
3. `expect(ctx).toBeDefined()` was filler → now asserts identity with the context
   whisper.rn produced.
4. The ×10 timestamp conversion is **correct**, but my cited evidence was not: the
   `// t0/t1 is 10ms unit` comment describes VAD segments. Real proof is
   `to_timestamp` in whisper.cpp (`msec = t * 10`); comment corrected.
5. Removed dead mock scaffolding (`__stopSpy`).
6. `.vscode/settings.json` (Peacock colors, unrelated) excluded from the checkpoint —
   `git add -A` in the engine is too blunt; staged step paths only.
7. **`record` is not delivered.** `docs/ARCHITECTURE.md:108` assigns recording to
   `shared/stt`, and no audio-capture dependency exists. Did *not* amend the
   architecture doc to match what was built — an unattended loop editing the spec
   to turn a shortfall into a green box is the failure mode this design exists to
   prevent. Queued to BLOCKED.md as an explicit (a)/(b) decision; 3.3 marked blocked
   on the same choice.

**Gate:** tsc ✅ · jest ✅ 220/17 suites · eslint ✅
**Review:** **pass** on re-review — and the checker verified by *mutation*, not by
reading: it copied the tree to a sandbox, reverted each fix, and confirmed each new
assertion actually fails. Notably the rewritten "omits params" test kills exactly
the implementation it previously could not distinguish. It left four non-blocking
findings, all fixed before checkpoint:
- I had propagated `ARCHITECTURE.md:108` when the `stt/` line is **109** (108 is the
  llama.rn line) — into BLOCKED.md twice, ARTICLE.md, and state.json. BLOCKED.md is
  the one file whose whole job is directing a specific human edit, so an off-by-one
  target is a real defect. Fixed everywhere.
- Stale "(24 tests)" → 25.
- The mock's header gave the wrong reason for hand-writing it: `whisper.rn/jest-mock`
  *does* match the `"./*"` exports pattern; it is unresolvable because the exports
  targets are extensionless. Corrected — same class of imprecise citation as the ×10
  one, caught twice now.
- `Omit<TranscriptionParams, never>` is an identity type; simplified.

**Two spine defects of my own**, found while fixing the above: a **duplicate `3.3`
key** in state.json (JSON keeps the last, silently flipping it from `blocked` back
to `pending` — the spine would have lied to the next beat) and a duplicated
"Needs a decision" heading in BLOCKED.md. Both fixed. The machine-readable spine
needs its own validation, not just careful editing.

**Checkpoint:** `f4cbf60` — staged step paths only. `.vscode/settings.json`
(Peacock editor colors, unrelated) deliberately left uncommitted for the user.

**Result:** blocked 🚧 — transcribe half delivered and green; `record` half awaiting
a dependency decision. `docs/DEVELOPMENT_PLAN.md` 3.1 stays `[ ]`.

**Environment (unchanged, needs the user):** `codebase-memory-mcp` still not
resolvable in-session and `expo` MCP still unauthorized, so CLAUDE.md's
"graph tools first" rule degraded to Read/Grep for this whole beat.

**Permissions note:** a mid-beat attempt to widen the allowlist was abandoned at the
user's request; the loop continues under the original narrow rules, plus auto-allow
for the spine and docs. The gate runs through `npx`, so a future deny on `npx *`
would silently disable all three gate commands — worth moving the gate into
`npm run` scripts before tightening that.

---

<!-- Append new beats above this line. -->
