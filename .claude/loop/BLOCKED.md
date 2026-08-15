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

### 3.1 — `shared/stt` whisper.rn wrapper (transcribe half)
Implemented and green against a hand-written mock: `initStt`, `transcribeAudio`,
`abortTranscription`, `releaseStt` (25 tests). **Nothing here has run against real
whisper.cpp.** Box left unchecked.

**Device check:** build a dev client (whisper.rn needs `expo prebuild` — see 3.2),
put a `ggml-base.en.bin` on the device, transcribe a short local `.wav`, and confirm:
1. `initStt` loads the model and `useGpu: true` actually engages Metal/OpenCL
   (`ctx.gpu === true`, or `reasonNoGPU` explains why not);
2. transcribed text is non-empty and roughly correct;
3. **segment timestamps line up with the audio.** The ×10 → milliseconds
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

## Needs a decision from you

### 4.1 — one sub-decision: which library derives the passphrase key
Design is settled (received directly from the user, 2026-08-13):
1. **Key source: both.** A random master vault key lives in
   `expo-secure-store`, wrapped by a key derived from the app-lock passphrase
   (4.2) — envelope encryption. Neither the stored blob nor the passphrase
   alone is enough; both are required to unlock the vault.
2. **Wrong key / corrupted vault:** offer wipe-and-restart.
3. **Key rotation:** likely deferred from v1 — not firmly committed, but the
   envelope design keeps this cheap to add later regardless (rotating the
   passphrase only re-wraps the small blob, not the whole database).

What's still open: **no KDF-capable crypto primitive is installed.**
`expo-secure-store` stores a blob; it doesn't derive a key from a passphrase.
`expo-crypto` isn't installed either, and even if it were, its public API is
digest/random-bytes, not a real password KDF (PBKDF2/scrypt) — using a bare
SHA-256 hash of a passphrase as a key would be a real, avoidable security
mistake (no work factor, no memory-hardness, brute-forceable).

**You decide (recommended: option a):**
- **(a)** `react-native-quick-crypto` — Node-`crypto`-API-compatible, JSI-based
  (fast), supports `scrypt` (memory-hard, the better default for password-based
  keys) and `pbkdf2`. Fits this project's existing native-module-heavy stack
  (llama.rn, whisper.rn) rather than introducing a different pattern.
- **(b)** A pure-JS PBKDF2 package — no native linking, but slower and PBKDF2
  itself lacks scrypt's memory-hardness against brute force.
- Or name a different library.

Once the dependency lands, this step is fully unblocked — implementation can
proceed under the normal TDD + checker cycle like everything else.

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
