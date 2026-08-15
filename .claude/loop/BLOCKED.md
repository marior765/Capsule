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

### 4.1 — `features/encrypt-vault` key-management design
The dependency gap is closed (`expo-secure-store` is installed and registered
in `app.json`). SQLCipher itself was already real and buildable — `expo-sqlite`
vendors SQLCipher's amalgamated source directly and its plugin exposes a
`useSQLCipher` flag. What's still open is **design, not dependencies**:
shipping "encryption" with a naively-chosen key scheme is not the same thing
as shipping a flagship privacy feature correctly, and getting it wrong is far
more costly to unwind than getting a UI detail wrong.

Specifically open: what KDF/derivation for the vault key (a fixed key in
secure storage vs. a passphrase-derived key vs. both — app-lock's passphrase
in 4.2 may be the natural source), what happens on a wrong key / corrupted
vault (fail loud, offer wipe-and-restart, attempt recovery?), whether key
rotation is in scope for v1 or explicitly deferred.

**You decide:** give a steer on those three questions (or say "use sensible
defaults, don't wait for me" and the loop will pick conservative, documented
defaults and flag them clearly for your review afterward), or handle 4.1
yourself outside the loop.

## Failed verification

_(none)_
