# Human Gate Queue

Work the loop finished in code but **cannot prove**, plus decisions it refuses to
make unattended. This is where intent and accountability come back to you.

Nothing here has a ticked box in `docs/DEVELOPMENT_PLAN.md`. Mocked-green is not
hardware-green — ticking these off is yours to do, after verifying on a device.

## How to clear an item

1. Run the stated check on a real device or dev build.
2. Passes → tick the box in `docs/DEVELOPMENT_PLAN.md`, delete the item here.
3. Fails → move it to "Failed verification" below with the error. The next beat
   picks it up as real work with the failure as its starting signature.

---

## Needs a device / dev build

### 3.1 — `shared/stt` whisper.rn + expo-audio wrapper (now complete: init, record, transcribe, abort)
Implemented and green against hand-written mocks: `initStt`, `startRecording`,
`transcribeAudio`, `abortTranscription`, `releaseStt` (33 tests, transcribe +
record). **Nothing here has run against a real microphone or whisper.cpp.**
Box left unchecked — this was the last piece; the step is now feature-complete
in code but entirely device-unverified.

`expo prebuild` (3.2's own check) has now been run successfully — `ios/`
and `android/` exist, `whisper-rn` is correctly linked per `Podfile.lock`.
What's still needed is actually *running* the app on a simulator/device
(`expo run:ios` / `expo run:android`) and exercising the checks below —
prebuild succeeding proves the native project is buildable, not that
recording/transcription work at runtime.

**Device check:**
1. `startRecording()` actually prompts for microphone permission on first use,
   and denying it surfaces the thrown error sensibly in the UI rather than
   crashing;
2. a real recording produces a playable `.m4a` at `recorder.uri`, and
   `stop()` resolves promptly (no hang waiting on the native `stop()` call);
3. `initStt` loads the model and `useGpu: true` actually engages Metal/OpenCL
   (`ctx.gpu === true`, or `reasonNoGPU` explains why not);
4. feed a real recording straight into `transcribeAudio` — text is non-empty
   and roughly correct;
5. **segment timestamps line up with the audio.** The ×10 → milliseconds
   conversion was verified by reading whisper.cpp's `to_timestamp` (`msec = t * 10`),
   not by running it. If subtitles drift by 10×, this is the line to look at
   (`src/shared/stt/index.ts`, `WHISPER_TIME_UNIT_MS`).

## Resolved (2026-08-16) — 3.2 whisper.rn Expo plugin config

`expo prebuild` run by the user, clean: `✔ Finished prebuild`, no error about
a missing/invalid config plugin. `ios/Podfile.lock` confirms `whisper-rn
(0.6.0)` genuinely linked, pointing at `../node_modules/whisper.rn` — real
evidence, not just an absent error message. Android's autolinking is
command-based (`autolinkLibrariesFromCommand` in `settings.gradle`), so it
leaves no static per-package fingerprint to grep for — that's expected, not
a gap. Matches the original investigation: whisper.rn genuinely needs no
config plugin. `docs/DEVELOPMENT_PLAN.md` 3.2 ticked.

## Resolved (2026-08-16) — 3.3's STT model gap

Decision: **option (b) now, option (a) deferred.** A minimal first-run
download of a single default STT model (e.g. `ggml-base.en.bin`, via
CLAUDE.md's one allowed network action) plus a minimal `SttProvider` (no
multi-model selection) is the chosen path to unblock 3.3's route-level
wiring — added to the plan as **3.3.1**. Full STT model management
(`entities/stt-model` + download/selection UI mirroring 1.1–1.3) is real
future work, not abandoned — moved to **Phase 9 (future releases), 9.5**,
revisited only if multi-model choice for STT becomes an actual need.

3.3.1 is implementable under the normal TDD + checker cycle whenever step
selection reaches it — no further decision needed. It should write an audit
entry on download (`action: "model_download"`, matching how `manage-models`'
LLM download already does — CLAUDE.md's hard rule applies here too).

## Resolved by installing dependencies (2026-08-13, beat 5)

You installed `expo-audio`, `@fugood/react-native-audio-pcm-stream`,
`expo-clipboard`, `react-native-markdown-display`, `expo-local-authentication`,
`expo-secure-store`, and `expo-speech` (verified present in `node_modules`),
and added `expo-audio` + `expo-secure-store` to `app.json`'s plugins array.
This resolves the dependency gap for: **3.1's record half, 3.3, 3.5, 1.6.1,
4.2**, and the dependency (not the design) half of **4.1**. Each is unblocked
in `.claude/loop/state.json` and will be picked up in plan order over the
next several beats. No further action from you needed on these — the items
below are what's still genuinely open.

## Resolved (2026-08-16, beat 6)

### 4.1 — fully unblocked, design and dependency both settled
Design (received directly from the user, 2026-08-13): key source is **both**
— a random master vault key in `expo-secure-store`, wrapped by a key derived
from the app-lock passphrase (envelope encryption; neither the stored blob
nor the passphrase alone unlocks the vault). Wrong key / corrupted vault:
**offer wipe-and-restart.** Key rotation: **likely deferred** from v1, but
cheap to add later under this design (rotating the passphrase only re-wraps
the small blob, not the whole database).

You installed `react-native-quick-crypto` yourself (I couldn't — `npm
install` fails in this sandbox with a TLS certificate error reaching the
registry). It ships a real config plugin (`app.plugin.js`, unlike whisper.rn/
`expo-speech`), registered in `app.json` with no options needed. No further
action from you needed — 4.1 proceeds under the normal TDD + checker cycle
whenever step selection reaches it.

## Follow-up (informational — low-risk, not blocking)

### `shared/fs` extraction is now triggered, not yet done
`docs/ARCHITECTURE.md` names its own condition for extracting a `shared/fs`
wrapper: "when a second slice needs the filesystem... extract a `shared/fs`
wrapper that owns all `expo-file-system` interaction — same principle as
`shared/llm` owning llama.rn. Until then, YAGNI." `features/manage-stt-model`
(3.3.1) is now that second slice — it duplicates `features/manage-models`'
exact `Directory`/`File`/`Paths` usage. The doc names `attachment` (Phase 6/8)
as the *expected* trigger, but the actual condition — a second real consumer
— has already happened earlier than that.

Deliberately not done as a side effect of 3.3.1's own review: it would mean
refactoring two already-shipped, checker-approved modules mid-beat, which is
outside this step's own scope even though the extraction itself is low-risk
(both existing test suites would catch any regression directly). Left for a
dedicated follow-up beat rather than folded in silently.

## Precedent set (informational — no action needed)

### Types-only devDependencies don't route through the dependency gate
While building 1.6.1, `markdown-it` (a transitive dependency of
`react-native-markdown-display`) turned out to ship no TypeScript types, and
`@types/markdown-it` isn't installed. Rather than install it unattended, a
minimal local ambient declaration was hand-written
(`src/widgets/ChatBubble/markdown-it.d.ts`), scoped to only the members
actually used.

The checker judged this defensible — a types-only file introduces zero
runtime code and can't make a network call, so CLAUDE.md's "audit
dependencies for outbound requests" rule doesn't really bite here — but
flagged that this is this loop's own unilateral interpretation: nothing in
the original dependency-gate rule explicitly carved out devDependencies from
runtime ones. Recording that interpretation here rather than leaving it only
in a code comment. If you disagree, say so and future beats will route
types-only packages through the same gate as everything else.

## Failed verification

_(none)_
