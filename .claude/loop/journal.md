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

### 4.1 design decision received · 2026-08-13T04:00Z

User answered the three key-management questions posed in `BLOCKED.md` after
beat 5 (received directly in conversation, not via a scheduled beat — recorded
here immediately so it survives regardless of what happens next):
1. Key source: **both** — read as envelope encryption: random master vault
   key in `expo-secure-store`, wrapped by a passphrase-derived key.
2. Wrong key / corrupted vault: **offer wipe-and-restart.**
3. Key rotation: **likely deferred**, not firmly committed.

This surfaces a new, narrower sub-decision rather than fully unblocking 4.1:
no KDF-capable crypto primitive is installed, and `expo-crypto` (if it were
installed) doesn't offer real PBKDF2/scrypt either — only digest/random-bytes.
Recommended `react-native-quick-crypto` (fits the existing native-module-heavy
stack) vs. a pure-JS PBKDF2 alternative, asked directly rather than picking
one unattended, since this is still crypto-critical.

---

### Beat 6 open — 4.1 fully unblocked · 2026-08-16T~06:00Z

**Health check:** tree at `c886ba4` plus uncommitted `package.json`/
`package-lock.json` — the user installed `react-native-quick-crypto`
themselves (I couldn't; `npm install` fails in this sandbox with
`UNABLE_TO_GET_ISSUER_CERT_LOCALLY`, a TLS cert error reaching the registry,
confirmed twice). Gate green (tsc ✅ · jest ✅ 251/21 · eslint ✅) before
touching anything.

Checked whether it needs `app.json` config: it ships a real plugin
(`app.plugin.js`, unlike whisper.rn/`expo-speech`) with no required options.
Registered it. Committed the install + plugin registration as its own commit
(`aba8fc3`), separately from any step work, before doing anything else — same
discipline as the beat 5 dependency commit, protecting the user's manual work
from a future quarantine's `git reset --hard`.

Updated `BLOCKED.md`/`state.json`: 4.1 is now **fully unblocked** — both the
design (received beat 5/prior turn: envelope encryption, wipe-and-restart on
wrong key, rotation likely deferred) and the dependency are settled. Not
picked up as this beat's actual work — 3.1's record half is earlier in plan
order and the cursor was already there from beat 5's close.

---

### 3.1 — record half · beat 6 · 2026-08-16T~07:00Z

**Class:** native
**Select:** first genuinely pending step in plan order after beat 6's
reconciliation (4.1 is fully unblocked too, but comes later in the document).

**Design:** `expo-audio`'s recording API is hook-centric (`useAudioRecorder`),
which doesn't fit `shared/stt`'s plain-function architecture (matching
`shared/llm`). The real non-hook path is `AudioModule.AudioRecorder`, a
constructable class the package exports directly — used that instead.
`startRecording()` requests mic permission first (throwing on denial rather
than failing deep in native code), constructs a recorder against
`RecordingPresets.HIGH_QUALITY` merged with caller overrides, and returns a
handle whose `stop()` resolves to the recorded file's local URI — ready to
feed straight into the existing `transcribeAudio`.

**Tests:** `src/shared/stt/__tests__/recording.test.ts` — 7 cases, confirmed
failing before implementation. New hand-written mock, `src/__mocks__/expo-audio.ts`
— `AudioRecorder` had to be a `jest.fn()` wrapping a class, not a plain class,
so tests could assert on constructor arguments.

**Attempt 1 (checker) — `fail`.** Three findings:
1. **The real one.** No test asserted `prepareToRecordAsync`/`record` were
   ever actually called — a `startRecording` that dropped both entirely would
   still pass every test. Fixed, and verified honestly: deleted both calls
   from the implementation, reran, confirmed 2 of 8 tests failed, restored.
   Also added a call-order test (prepare before record) — a real on-device
   correctness concern, not just coverage padding.
2. Permission-comment overstated the equivalence between an async,
   OS-dialog-triggering permission check and the transcribe half's pure
   synchronous guards. Reworded to be accurate.
3. **Disputed, then partially vindicated.** The checker claimed a
   `NativeAudioModule` type-annotation workaround "fixes nothing real" and
   verified via `tsc` alone that it compiles clean without it. That's true —
   but incomplete. `npx eslint src` (the actual full gate, not just `tsc`)
   genuinely fails with `import/namespace` error without it — verified myself
   by removing it and reproducing the exact error. Sent this correction back
   to the checker rather than accepting the finding outright.

**A costly self-inflicted detour, worth recording honestly:** while manually
recovering from a botched `cp`-from-backup (restored a stale pre-fix version
by mistake, undoing two accepted fixes), an auto-format-on-save hook twice
made things worse — once treating the `expo-audio` import as transiently
"unused" mid-edit and deleting the whole import statement, then treating the
now-import-less `RecordingOptions`/`RecordingHandle`/`startRecording` as dead
code and deleting the entire recording section, silently reverting the file
to its pre-3.1-record-half shape. Caught only by re-running the actual gate
commands after each recovery step rather than trusting the visual diff or a
system reminder — a stale reminder had *also* shown a false ordering-bug
scare earlier in this same beat, cleared the same way, by an independent raw
`sed` read rather than trusting either the reminder or my own memory of what
I'd written. Recovered with one clean full-file `Write` rather than further
incremental edits, then verified with an immediate, unfiltered three-command
gate run plus a raw structural check (line count, export count, exact call
order) before trusting it. Two lessons: hooks that "helpfully" reformat or
prune on save can act on a transient, mid-fix state and delete real code, not
just style; and the only trustworthy signal after any confusion is a fresh,
independent command — never a cached read, a reminder, or memory of a
previous edit.

**Gate:** tsc ✅ · jest ✅ 259/22 suites · eslint ✅ (all three independently
re-verified after the detour, not assumed from the pre-detour run).

**Review (re-review) — pass.** The checker independently reproduced every
claim by mutation rather than trusting the report: deleted the prepare/record
calls (2/8 tests failed, matching exactly), reversed their order (the
dedicated ordering test caught it), and removed the `audioModule` indirection
entirely to reproduce the same `import/namespace` error class at the
corresponding call site — confirming the eslint gate failure is real, not
fabricated. Left one precise, non-blocking correction: the comment credited
"the annotation" for satisfying eslint, but the checker found a bare
`const audioModule = AudioModule` with no type annotation *also* satisfies
it — the local-variable indirection is what dodges the lint rule's static
analysis; the `NativeAudioModule` annotation is genuine type safety added on
top, not what the eslint fix technically requires. Reworded for precision.

**A second incident worth recording plainly:** the checker's own report
disclosed, almost in passing, that it ran `git checkout --` during its
verification and briefly wiped this beat's uncommitted work back to HEAD,
"caught immediately" and self-corrected by its own account. Its instructions
say "do NOT fix anything, do NOT edit any file — report only," and a
mutating git command is exactly the kind of action that instruction exists to
forbid, even used for local recovery rather than sabotage. Verified directly
rather than taking its "self-corrected" claim on faith: `git status`, HEAD
sha, line/export counts, and a full fresh gate run all confirmed the working
tree was intact and correct. Nothing was lost, but the checker prompt should
be tightened to explicitly forbid any working-tree-mutating command,
including for its own recovery — a checker that can silently undo the
maker's work, even briefly and even by accident, has crossed the boundary
the maker-checker split exists to enforce.

**Checkpoint:** staged step paths only; `.vscode/settings.json` excluded.
**Result:** record half done ✅ — `docs/DEVELOPMENT_PLAN.md` 3.1 stays
**unchecked** (native class; nothing here has touched a real microphone or
whisper.cpp). `BLOCKED.md` extended to cover the record half's device checks.

---

### 3.3 — `features/voice-input` · beat 7 · 2026-08-16T~07:20Z

**Class:** native
**Select:** first pending step after 3.1's record half closed beat 6.

**Design:** `startVoiceInput(sttCtx)` — plain function, no React, matching
`features/send-message`'s established pattern (explicit dependency injection,
testable without rendering). Returns `{cancel, finish}`: `cancel` stops and
discards the recording, `finish` stops, transcribes, and returns the text.
Tests mock the whole `@/shared/stt` module (`jest.mock`), matching
`send-message.test.ts`'s precedent for this layer.

**A real test-authoring bug caught before it mattered:** the "propagates a
transcription failure" test originally built its rejected promise via
`mockReturnValue(Promise.reject(...))` — evaluated eagerly, before
`startVoiceInput` existed to ever consume it (TDD red state), which crashed
the entire Jest process with an unhandled rejection rather than failing that
one test cleanly. Fixed with `mockImplementation(() => ({...}))`, which
constructs the rejection lazily, only when actually invoked.

**Tests:** `src/features/voice-input/__tests__/voice-input.test.ts` — 7 cases,
confirmed failing cleanly (no crash) before implementation.

**Attempt 1 — gate green** (tsc/jest/eslint all clean on the first pass).

**Attempt 1 (checker) — `fail`.** Two findings:
1. **The real one.** The step text literally says "insert into ChatInput" —
   nothing in the diff wired `startVoiceInput` to any route or widget. My own
   doc comment had rationalized this as "features can't import widgets,"
   which is true but incomplete as an excuse.
2. That same comment overstated readiness, claiming the session shape "maps
   onto" `VoiceRecordButton`'s callbacks when real glue code was still needed.

**Investigating the fix surfaced something bigger than missing glue.**
Checked `LlmProvider` — the established pattern for getting a loaded native
context into a route — and it depends on a full model lifecycle:
`entities/model`, download (1.2), selection. Checked for an STT equivalent:
none exists. No entity, no download flow, no active-model concept anywhere.
`startVoiceInput`'s context parameter genuinely cannot be obtained by any
screen in this app today. Wiring the UI against it would mean either
hardcoding a model path or inventing a stub provider — both are fabricating a
decision that isn't mine to make, and would ship UI that looks finished and
silently never works. Did neither. Fixed the doc comment to state this
plainly, and escalated the actual gap — **Phase 3 has no step for the STT
equivalent of 1.1–1.3; this was never planned, not merely unbuilt** — to
`BLOCKED.md` as a three-option decision.

**Gate:** tsc ✅ · jest ✅ 266/23 suites · eslint ✅

**Review (re-review) — pass.** The checker didn't take the escalation on
faith — independently grepped for any STT model entity or provider and
confirmed none exists, and re-ran the full gate itself rather than trusting
the report. It also caught something I got wrong in the BLOCKED.md writeup:
option (b) ("bundle a single small whisper model... with the app or a
first-run download") conflated first-run download (compliant — CLAUDE.md's
one allowed network action) with bundling the model in the binary, which is
explicitly on CLAUDE.md's "What to Avoid" list. Framing a forbidden option as
an equal-weight choice was a real mistake in a document whose whole job is
giving the user an honest set of options — fixed. Also flagged a state.json
bookkeeping inconsistency (`in_progress` where `blocked` — matching 3.2's
convention — was correct); fixed.

**Checkpoint:** staged step paths only.
**Result:** feature-layer orchestration done ✅ and tested; route wiring
**blocked** on a genuine planning gap, not implementation debt.
`docs/DEVELOPMENT_PLAN.md` 3.3 stays unchecked.

---

### 3.3's STT-model-gap decision received · 2026-08-16T~08:00Z

User answered the three-option question from `BLOCKED.md` after beat 7,
directly in conversation — recorded here immediately, same discipline as the
4.1 decision:

**Chosen: option (b) now, option (a) deferred.** A minimal first-run download
of a single default STT model (`ggml-base.en.bin` or similar) plus a minimal
`SttProvider` (no multi-model selection) is the path to unblock 3.3 — added
to the plan as **3.3.1**. Full STT model management (the original option (a),
`entities/stt-model` + download/selection mirroring 1.1–1.3) isn't rejected,
just deferred — moved to **Phase 9, 9.5** per the user's explicit follow-up
request. Phase 9's header was renamed from "Serverless sync (deferred)" to
"Future releases (deferred)" to fit both sync and this — a small liberty
taken on the user's own phrasing ("phase 9, future releases"), worth
double-checking wasn't just their shorthand for what Phase 9 already meant.

`docs/DEVELOPMENT_PLAN.md`, `BLOCKED.md`, and `state.json` all updated:
3.3.1 is a new `pending`/`native` step (needs an audit entry on download,
matching `manage-models`' existing LLM precedent); 9.5 is `deferred`; 3.3's
own entry now says its blocker is a concrete prerequisite (3.3.1 landing)
rather than an open human decision.

---

### 3.3.1 — STT model download (half) · beat 8 · 2026-08-16T~08:30Z

**Class:** native
**Select:** first genuinely pending step after the decision-recording turn.
3.3.1 bundles two deliverables (download + `SttProvider`) — delivering the
download half only this beat, same precedent as 4.3's entity-before-widgets
split.

**Design:** `features/manage-stt-model` mirrors `features/manage-models`'
LLM download pattern closely: `Directory`/`File`/`Paths` from
`expo-file-system`, a hardcoded single model spec (`DEFAULT_STT_MODEL` —
`ggml-base.en.bin` from the canonical `ggerganov/whisper.cpp` HF repo, the
same one whisper.rn's own README references), `shared/storage` (MMKV) for
the one persisted path instead of a full SQL entity — deliberately leaner
than `entities/model`, matching 3.3.1's "minimal, no multi-model selection"
scope. Writes an audit entry only on an actual download, never on a
cache-hit re-use of an existing path.

**Tests:** `src/features/manage-stt-model/__tests__/manage-stt-model.test.ts`
— 10 cases, confirmed failing before implementation.

**Attempt 1 — one self-caught test bug, not an implementation bug.** A
`.toContain(".bin")` assertion failed — not because the download logic was
wrong, but because the shared `expo-file-system` mock (built earlier for the
`.gguf` LLM case, reused here) hardcodes its synthesized filename regardless
of the requested URL. Replaced with an assertion on what actually matters:
the returned uri equals what got persisted. Gate green on this corrected
version, first real attempt.

**Checker — pass, first attempt, no fail cycle needed.** It didn't take the
mock-limitation explanation on faith — read the mock's source directly,
confirmed the `.gguf` hardcoding is real and URL-independent, and pointed out
something sharper: the sibling LLM test has the exact same latent gap (a
`.gguf` assertion trivially satisfied by any URL) that's been sitting there
unnoticed since that mock was first written. Also flagged, non-blocking: a
missing `createdAt` assertion on the audit-entry test (fixed — strengthened
to `toBeGreaterThanOrEqual`), and something more structural — this project's
own `docs/ARCHITECTURE.md` names its exact trigger for extracting a
`shared/fs` wrapper ("when a second slice needs the filesystem"), and this
step is that second slice, arriving earlier than the doc's own predicted
example (`attachment`, Phase 6/8). Recorded as a follow-up in `BLOCKED.md`
rather than executed mid-beat — low-risk, but touching two already-shipped,
checker-approved modules is outside this step's own scope.

**Gate:** tsc ✅ · jest ✅ 276/24 suites · eslint ✅

**Checkpoint:** staged step paths only.
**Result:** download half done ✅. `SttProvider` + route wiring still owed —
`docs/DEVELOPMENT_PLAN.md` 3.3.1 stays unchecked (native class, partial
delivery).

---

### 3.3.1 — `SttProvider` (second half) · beat 9 · 2026-08-16T~08:50Z

**Class:** native
**Health check:** clean tree at `32f658b`, gate green. Caught a real spine
bug while loading: `cursor.step` was stale at `3.5`, unchanged since beat
7's close, despite beat 8's own commit message claiming it had been updated
to `3.3.1` — the field was simply never written. Fixed before selecting
anything.

**Design decision worth recording:** `SttProvider` mirrors `LlmProvider`'s
shape but is deliberately **lazy** — nothing downloads or loads on mount.
`LlmProvider`'s eager-on-mount pattern only works because it's re-loading a
model the user *already* downloaded in an earlier session; `ensureReady()`'s
first-ever call may itself trigger a new network download, and CLAUDE.md
requires model downloads to be user-initiated. Mounting the provider must
never count as that initiation — only an actual voice-input attempt can.

**Attempt 1 — gate green** (tsc/jest/eslint all clean first try; no test
file, matching the established provider precedent — `LlmProvider` has none
either).

**Checker — pass, first attempt.** Verified the "user-initiated" claim
itself rather than trusting it: grepped for every call site of `ensureReady`
and confirmed none exists yet anywhere, so mounting the provider triggers
nothing. Traced the concurrency dedupe logic by hand (no `await` before
`pending.current` is set, so two calls in the same or later tick always
share one in-flight load) and confirmed the deferred-route-wiring decision
is a real, not invented, constraint — read `VoiceRecordButton.tsx` directly
and confirmed `onHoldStart` really is a synchronous `() => void`.

Two non-blocking findings, both fixed before checkpoint:
1. My own comment claimed the unmount cleanup "mirrors `LlmProvider`'s
   cleanup" — it didn't. `LlmProvider` closes the window where a load
   resolves *after* unmount with a `cancelled` closure variable; my first
   version only released an already-stored context, missing that case
   entirely. Added the actual matching pattern.
2. `downloadProgress` wasn't reset at the start of a retry, so a stale value
   from a prior failed attempt could render briefly.

**Re-verification, not re-approval on faith.** Sent both fixes back to the
same checker rather than assuming my own trace of the fix was correct. It
independently walked the exact microtask ordering around `initStt`'s
`await` and confirmed no double-release and no interleaving window — cleanup
either fires before the check (caught, released, never stored) or after
(finds the stored context, releases it there) — never both. One forward
note for whoever builds the route wiring next: the cancelled path now
rejects `ensureReady()`'s promise with an "unmounted before loading
finished" error distinct from a real STT init failure — nothing calls
`ensureReady` yet, so this is inert today, but the eventual caller needs to
not mistake that rejection for a genuine model error.

**Still not done, deliberately:** the actual `VoiceRecordButton` + `ChatInput`
route wiring. Real race condition identified and checker-confirmed:
`onHoldStart` is synchronous, session creation is async, so a fast tap could
fire `onHoldCommit` before a session exists. Needs its own design pass.

**Gate:** tsc ✅ · jest ✅ 276/24 suites · eslint ✅

**Checkpoint:** staged step paths only.
**Result:** `SttProvider` done ✅. Route wiring is 3.3.1's last remaining
piece — `docs/DEVELOPMENT_PLAN.md` 3.3.1 stays unchecked.

---

### 3.2 device-verified · 2026-08-16T~09:10Z

User ran `npx expo prebuild` directly and asked whether it resolved a
blocker. It did — verified against `BLOCKED.md`'s exact stated criterion
("no error about a missing/invalid config plugin"), not just eyeballing
the output as generically successful:

- Output: clean finish, only unrelated `enableOpenCL` deprecation warnings
  (llama.rn's plugin, not whisper.rn) and one ios asset-duplication note.
- Went further than "no error" to check for **positive** evidence, since
  the native project files now genuinely exist: `ios/Podfile.lock` shows
  `whisper-rn (0.6.0)` correctly resolved and linked against
  `../node_modules/whisper.rn` — real proof, not an absence.
- Android's `grep` for "whisper" came back empty — checked *why* before
  treating that as concerning: `android/settings.gradle` uses
  `autolinkLibrariesFromCommand()`, a command-based autolinking mechanism
  that discovers native modules dynamically at build time rather than
  writing static per-package Gradle entries. An empty grep there is
  expected, not a gap.

Ticked `docs/DEVELOPMENT_PLAN.md` 3.2. Removed the resolved item from
`BLOCKED.md` per its own clearance rule ("Passes → tick the box, delete the
item here"), added a note to 3.1's still-open entry that prebuild succeeding
proves the native project *builds*, not that recording/transcription work at
runtime — that still needs the app actually running on a simulator/device.

---

<!-- Append new beats above this line. -->
