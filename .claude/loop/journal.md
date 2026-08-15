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

### 3.2 — whisper.rn Expo plugin config · beat 2 · 2026-08-13T00:35Z

**Class:** native
**Health check:** tree clean at `badf6ae` (only `.vscode/settings.json` and
`.claude/audit.log` dirty, both expected — the latter is hook-appended on every
tool call and will never be clean; worth excluding from the health-check diff).
Gate green (tsc ✅ · jest ✅ 220/17 · eslint ✅).

**Reconcile → the step's premise is false.** whisper.rn 0.6.0 has no
`app.plugin.js`, no plugin export in `package.json`, and its README says only
"you will need to prebuild." Contrast with llama.rn, whose real plugin
(`node_modules/llama.rn/app.plugin.js` → `withLlamaRN`) wires the options already
present in `app.json` (`enableEntitlements`, `forceCxx20`, `enableOpenCL`).
Verified on both platforms:
- iOS: podspec reads `RNWHISPER_DISABLE_COREML` / `RNWHISPER_DISABLE_METAL` /
  `RNWHISPER_BUILD_FROM_SOURCE` as build-time env vars, not `app.json` config —
  defaults are CoreML on, Metal on, prebuilt xcframework.
- Android: manifest declares no permissions (confirms transcribe-only scope —
  whisper.rn itself never touches the microphone); `build.gradle` is standard
  autolinking with `abiFilters` matching RN architectures, nothing custom.

**No code change.** There is nothing to add to `app.json` — adding a bare
`"whisper.rn"` plugin entry would *break* `expo prebuild` ("does not contain a
valid config plugin"), which would have been a worse outcome than leaving the
step alone. Queued to `BLOCKED.md`: confirm on an actual `expo prebuild` that
autolinking picks up whisper.rn with zero `app.json` changes. Box unchecked —
nothing here has run through a real prebuild.

**Result:** blocked 🚧 — no checkpoint (no diff to review or commit).

**Note on beat mechanics:** this entry was written a beat late. The prior beat's
Edit call for this exact text was declined; the user then had to reload session
permissions before the write would go through, even though the covering allow
rule (`Edit(.claude/loop/**)`) had already been committed in `badf6ae`. Worth
remembering: a permission-allow edit isn't guaranteed to apply within the same
running session that added it.

---

### 3.4 — `VoiceRecordButton` widget · beat 3 · 2026-08-13T01:05Z

**Class:** ui
**Health check:** tree clean at `3a856e1`, gate green (tsc ✅ · jest ✅ 220/17 ·
eslint ✅). Caught up on the two beat-2 writes that had been blocked by a
permission-reload gap (3.2's journal entry, plus stale "pre-existing uncommitted
work" removed from `BLOCKED.md` — that was resolved before beat 1 even started).

**Select/reconcile:** 3.1–3.3 all `blocked`. 3.4 is genuinely unstarted
(`export {};` stub). No render-testing library in this repo
(`@testing-library/react-native` absent), so `.tsx` widgets are untested here —
confirmed by the one existing precedent, `ModelPicker.tsx` + its sibling pure-logic
`recommend.ts` (only `recommend.ts` has a test file). Mirrored that pattern:
extracted the one piece of genuine widget-layer logic — deciding whether a
press-and-release counts as an intentional hold vs. an accidental tap — into a
pure, framework-free `holdGesture.ts`; kept `VoiceRecordButton.tsx` as a thin,
purely controlled shell (`isRecording` prop in, `onHoldStart`/`onHoldCommit`/
`onHoldCancel` callbacks out). Zero whisper.rn or audio-capture code — correctly
deferred to `features/voice-input` (3.3), which owns that per `shared/stt`'s
exclusive-ownership rule.

**Tests:** `src/widgets/VoiceRecordButton/__tests__/holdGesture.test.ts` — 8 cases
(happy path, boundary, origin-independence, error handling), confirmed failing
before implementation (module not found).

**Attempt 1 — gate red, prettier only.** Autofixed.

**Attempt 1 (checker) — `fail`.** Two findings, both accepted:
1. `handlePressOut` stranded an in-progress hold if `disabled` flipped mid-press:
   `onHoldStart` had already fired, but the early `if (disabled || pressedAt ===
   null) return;` skipped resolution entirely — neither `onHoldCommit` nor
   `onHoldCancel` ever followed, leaving the caller believing a recording was
   still open with no way to close it. Fixed: `pressedAt === null` (no press in
   progress) is now the only unconditional skip; a hold that already started
   always resolves, calling `onHoldCancel()` if `disabled` is now true.
2. The negative-`minHoldMs` test was named "cancels rather than throwing" but
   only asserted `not.toThrow()` — never checked the return value, which is
   actually `"committed"` (permissive clamp-to-zero, not a block). Test renamed
   and fixed to assert the real, defensible behavior.

**Known gap flagged to the checker rather than hidden:** the `handlePressOut` fix
can only be verified by reading the corrected control flow — there is no way to
render-test it in this repo. Sent for re-review with that limitation stated
explicitly rather than silently.

**Review (re-review) — pass.** The checker traced every reachable branch of the
fixed `handlePressOut` by hand: `pressedAt !== null` only holds after
`handlePressIn` already fired `onHoldStart` in the same closure, the ref is
nulled before the `disabled` check (making a duplicate/late `onPressOut`
idempotent), and no path produces either a double resolution or a stranded
start. It also confirmed the rewritten negative-`minHoldMs` test has real
teeth — a mutant that special-cases negative input into a cancel branch fails
it immediately — and explicitly judged the unverifiable-`.tsx` limitation as
codebase infrastructure, not a review failure: `ModelPicker.tsx`, the pattern
being mirrored, has zero render tests today either.

**Gate:** tsc ✅ · jest ✅ 228/18 suites · eslint ✅
**Checkpoint:** staged step paths only (`.vscode/settings.json` excluded again).
**Result:** done ✅ — `docs/DEVELOPMENT_PLAN.md` 3.4 ticked.

---

### 3.5 — Local TTS for assistant responses · beat 4 · 2026-08-13T01:40Z

**Class:** deferred (reclassified from `native` — see below)
**Health check:** tree clean at `cc1341e`, gate green (tsc ✅ · jest ✅ 228/18 ·
eslint ✅).

**Reconcile → no dependency to build against.** Step text: "OS-level Speech API
as baseline." Expo's canonical wrapper is `expo-speech`; confirmed absent from
both `package.json` and `node_modules`. This differs from 3.1: whisper.rn *was*
already installed there, so `shared/stt` could be written and tested against
its real, mockable API even before the "record" half was decided. Here there is
no real package at all — writing `shared/tts` now would mean inventing an
interface with nothing to shape it against, risking a guess that doesn't match
`expo-speech`'s real shape and a rewrite later. That's worse than waiting.

No code written. Queued to `BLOCKED.md` as a dependency decision (same class as
1.6.1). Phase 3 is now fully processed: 3.1/3.2/3.3/3.5 blocked, 3.4 done.

---

### 4.3 — `entities/audit` (data layer only) · beat 4 · 2026-08-13T02:10Z

**Class:** logic
**Select:** Phase 3 fully processed (3.1/3.2/3.3/3.5 blocked, 3.4 done). Moved
to Phase 4. 4.1 (SQLCipher + secure store) and 4.2 (biometrics) both need
missing native dependencies (`expo-secure-store`, `expo-local-authentication`).
4.1 is more nuanced than a clean defer — SQLCipher itself is real and buildable
(`expo-sqlite` vendors SQLCipher's amalgamated source directly and exposes a
`useSQLCipher` plugin flag), but shipping encryption with no real secure key
storage isn't an honest partial deliverable for a flagship privacy feature the
way transcribe-without-record was for 3.1. Deliberately not attempted — queued
as a decision, with a note that this one deserves real design discussion, not
just a dependency approval. 4.2 is a clean full defer (app-lock genuinely can't
do anything without the auth library).

**4.3 is a compound line** — `entities/audit` + `PrivacyBanner` + `EgressLog`.
Built the entity only this beat: widgets depend on it existing, so this is
sequencing, not scope-avoidance. Followed the `entities/conversation`/`persona`
CRUD pattern exactly. Migration version 8 (next in sequence), registered in
`app/providers/index.tsx`.

**Design call:** the audit log is append-only — no `updateAuditEntry` or
`deleteAuditEntry` — because a privacy ledger callers can quietly edit or
erase defeats its purpose.

**Tests:** `src/entities/audit/__tests__/audit.test.ts` — 9 cases, confirmed
failing before implementation.

**Attempt 1 — gate red.** Prettier + a `require()` lint warning in the "no
mutation API" test; fixed by importing the module statically instead.

**Attempt 1 (checker) — `fail`.** Four findings, all accepted:
1. The "stable order on tie" test asserted only `toHaveLength(2)` — proved
   nothing about order. Fixed: added a genuine secondary sort
   (`created_at DESC, id DESC`) and a test asserting the exact resulting order.
2. The "append-only" claim was enforced only by two functions not existing —
   trivially reversible by anyone adding them back. Fixed: real SQL triggers
   (`BEFORE UPDATE`/`BEFORE DELETE`, `RAISE(ABORT, ...)`) on the migration,
   tested directly against the real `better-sqlite3` engine the mock uses
   (confirmed via `db.runSync` throwing on both statements).
3. `.vscode/settings.json` stray diff — excluded from staging, as always.
4. **The sharpest one:** the entity existed but nothing wrote to it —
   `features/manage-models`'s `downloadModel` is a real, shipped, tested
   caller of exactly the hard rule this entity exists to serve
   ("model download" is one of CLAUDE.md's four named actions), and it never
   called `insertAuditEntry`. Wired it in. Verified TDD discipline even though
   this was a mid-cycle fix: temporarily reverted the wiring, confirmed the new
   test failed (`entry` was `undefined`), restored it, confirmed green.

**A scare worth recording:** after the fix, a stale "file modified externally"
notification showed the `id DESC` secondary sort missing from `db.ts` on disk.
Treated it as possibly real rather than dismissing it — re-read the file
directly, confirmed the fix genuinely was present, re-ran the full gate to be
certain. Turned out to be a delayed/stale hook notification, not an actual
revert. Worth remembering: these notifications can lag behind the true file
state — verify by reading, don't take either the reminder or your own memory
of "I already wrote that" on faith.

**Gate:** tsc ✅ · jest ✅ 240/19 suites · eslint ✅

**Review (re-review) — pass.** The checker didn't take the fixes on report —
independently mutated all three (removed the triggers, removed the secondary
sort, removed the wiring) and confirmed each corresponding test fails exactly
and only as expected. Also confirmed no other live caller of the three
remaining `AuditAction` classes exists yet (wipe-data, import-export,
encrypt-vault are all still stubs), so this closes the hard-rule gap
completely for everything currently real.

**Checkpoint:** staged entity + provider wiring + manage-models integration.
`.vscode/settings.json` excluded again.
**Result:** entities/audit done ✅ — `docs/DEVELOPMENT_PLAN.md` 4.3 stays
**unchecked**; PrivacyBanner + EgressLog still owed.

---

### Reconciliation — beat 5 · 2026-08-13T02:40Z

**Health check:** tree clean at `86446cd`, gate green (tsc ✅ · jest ✅ 240/19 ·
eslint ✅). User installed 7 packages and registered 2 in `app.json`'s plugins
array between beats — verified genuinely present in `node_modules` (not just
listed in `package.json`) before trusting any of it:
`expo-audio`, `@fugood/react-native-audio-pcm-stream`, `expo-clipboard`,
`react-native-markdown-display`, `expo-local-authentication`,
`expo-secure-store`, `expo-speech`. All seven confirmed installed. `app.json`
gained `expo-audio` and `expo-secure-store` in its plugins array.

This resolves every pure dependency-gap block from beats 1–4 in one move:
3.1's record half, 3.3, 3.5, 1.6.1, 4.2, and the dependency (not design) half
of 4.1. Flipped each in `state.json` from `blocked`/`deferred` to `pending`,
with a note on what changed. Rewrote `BLOCKED.md` to drop the now-resolved
"approve this dependency" items and keep only what's genuinely still open —
which is exactly one thing: **4.1's key-management design**. Installing
`expo-secure-store` answers "can we store a key securely," not "how should we
derive/rotate/fail on this specific key" — that's still a real design
question, not something the dependency itself settles, so 4.1 stays flagged
rather than getting swept up with the rest.

**Selection:** plan order puts 1.6.1 (Phase 1) ahead of everything else that
unblocked (Phase 3/4). Picking it up this beat.

---

### 1.6.1 — `ChatBubble` markdown rendering + code blocks + copy · beat 5 · 2026-08-13T03:15Z

**Class:** ui
**Select:** first plan-order item unblocked by the reconciliation. Prior state
was `export {};`-plain-text bubble.

**Design decisions worth recording:**
- The `image` render rule is overridden to never mount a real image
  component, and `markdownit` is passed an explicit `{ html: false }` parser
  — a message's content is the user's own text or the model's own output,
  never a trusted document, so nothing in it should be able to trigger a
  fetch just by being displayed.
- Code blocks (`fence` + `code_block`) render through a `CodeBlock` component
  with a copy-to-clipboard button, using `prepareCodeForCopy` (pure logic
  mirroring the library's own trim-one-trailing-newline behavior).

**Tests:** `prepareCodeForCopy.test.ts` (7 cases) — confirmed failing before
implementation.

**Attempt 1 (checker) — `fail`.** Three findings, all accepted:
1. The copy button's testID was built from `node.key`, which turned out to be
   an app-wide global counter reassigned on every render, not scoped to a
   message — the testID changed on every re-render regardless of content.
   Fixed: a position-based index closed over per `markdownRules(messageId)`
   call, deterministic from message identity + document order.
2. **The sharpest one.** The privacy claim in my own comment — "no markdown
   content can trigger a fetch" — was never actually verified. Raw HTML
   (`<img src="...">`) tokenizes as `html_block`/`html_inline`, a different
   node type the `image` rule override never sees, and whether that path is
   open depended entirely on an *implicit* markdown-it default
   (`html: false`) nothing pinned in code. Fixed: `createMarkdownParser()`
   sets `html: false` explicitly, backed by `markdownParser.test.ts` — 4
   tests against the real `markdown-it` engine, not a mock.
3. `setStringAsync`'s result was discarded outright — no feedback on success
   or failure. Fixed: `CodeBlock` is now a real component with `useState`
   backing a "Copied" label and a try/catch around the awaited promise.

**A new wrinkle:** `markdown-it` ships no types, `@types/markdown-it` isn't
installed. Rather than install a types-only devDependency unattended, wrote a
minimal local ambient declaration (`markdown-it.d.ts`) covering only the used
surface. Sent this specific call to the checker for judgment rather than
deciding it alone.

**Gate:** tsc ✅ · jest ✅ 251/21 suites · eslint ✅

**Review (re-review) — pass.** The checker didn't take any fix on report —
manually substituted `html: true` into the parser tests and confirmed all 4
flip to failing, confirming the regression guard actually guards something.
Confirmed the testID scheme is genuinely deterministic and collision-free
(message ids are UUIDv4-shaped, already relied on elsewhere). Judged the
`markdown-it.d.ts` workaround defensible — zero runtime code, can't make a
network call — but flagged it as this loop's own unilateral interpretation of
the dependency gate (nothing in the original rule explicitly exempts
devDependencies), and that the reasoning should live in `BLOCKED.md`, not
only a code comment. Added that breadcrumb before checkpoint. Two minor,
non-blocking gaps noted for the record: no `setTimeout` cleanup on unmount,
and a failed copy still shows "Copy" rather than something like "Failed" —
neither judged worth blocking on for this scope.

**Checkpoint:** staged step paths only. `.vscode/settings.json` excluded
again.
**Result:** done ✅ — `docs/DEVELOPMENT_PLAN.md` 1.6.1 ticked.

---

<!-- Append new beats above this line. -->
