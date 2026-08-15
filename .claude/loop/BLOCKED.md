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

**Device check:** build a dev client (whisper.rn needs `expo prebuild` — see 3.2),
and confirm:
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

### 3.2 — whisper.rn Expo plugin config
**No code change made** — whisper.rn 0.6.0 ships no Expo config plugin at all
(no `app.plugin.js`, unlike llama.rn's real `withLlamaRN`). Verified by reading
the package: iOS uses podspec env vars (`RNWHISPER_DISABLE_COREML`,
`RNWHISPER_DISABLE_METAL`, `RNWHISPER_BUILD_FROM_SOURCE`, all optional —
defaults are CoreML+Metal on, prebuilt xcframework); Android needs no manifest
permissions and autolinks like any other native module.

**Device check:** run `expo prebuild` with `app.json` unchanged and confirm
whisper.rn autolinks on both platforms with no error about a missing/invalid
config plugin. If it does need something, that's new information this
investigation missed — reopen 3.2 with what you found.

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
