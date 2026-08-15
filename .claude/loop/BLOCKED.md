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

## Needs a decision from you

### 3.1 — the "record" half is NOT implemented
The step text is "init, **record**, transcribe, abort", and `docs/ARCHITECTURE.md:109`
assigns recording to `shared/stt` (`whisper.rn wrapper: init, record, transcribe`).
Only init/transcribe/abort/release shipped.

Recording needs an audio-capture dependency that this project does not have —
neither `expo-audio` nor `expo-av` is in `package.json`, and whisper.rn's own
`RealtimeTranscriber` needs `@fugood/react-native-audio-pcm-stream`. Adding a
dependency unattended is exactly what the loop is forbidden to do, and amending
the architecture doc to match what was built would be the loop grading its own
homework.

**You decide:**
- **(a)** Approve `expo-audio` — the loop then adds `recordAudio`/`stopRecording`
  to `shared/stt` (record to a local `.wav`, feed it to the existing
  `transcribeAudio`), and 3.1 is complete as specified; or
- **(b)** Amend `docs/ARCHITECTURE.md:109` to move recording into
  `features/voice-input`, making 3.1 complete as delivered and 3.3 own the capture.

Until then 3.1 stays unchecked and 3.3 is blocked on the same choice.

### 4.1 — `features/encrypt-vault` (SQLCipher + key in secure store)
This one is different from the other dependency-gap items below. SQLCipher
itself is real and buildable here — `expo-sqlite` vendors SQLCipher's
amalgamated source directly (`node_modules/expo-sqlite/vendor/sqlcipher/`)
and its config plugin exposes a `useSQLCipher` flag on both platforms. The
gap is `expo-secure-store` (key storage) — not installed.

Unlike 3.1's transcribe/record split, shipping "encryption" here with no real
secure key storage isn't an honest partial deliverable: a vault that looks
encrypted without a securely-stored key undermines the entire point of a
flagship privacy feature, and could read as "done" when it fundamentally
isn't safe. Key-management design (KDF choice, wrong-key error handling, key
rotation) is exactly the kind of non-trivial, security-critical decision
CLAUDE.md says to discuss before writing code — not something this loop
should design unattended just because a plugin flag exists.
**You decide:** approve `expo-secure-store` AND weigh in on the key-management
design (or explicitly say "use sensible defaults, don't wait for me"), or
handle 4.1 yourself outside the loop.

### 4.2 — `features/app-lock` (biometric / passphrase gate)
Needs `expo-local-authentication`, not installed. Unlike 4.1, there's no
partial path — app-lock genuinely can't do anything without it.
**You decide:** approve `expo-local-authentication`, or name a different
approach.

### 3.5 — Local TTS for assistant responses
Step calls for "OS-level Speech API as baseline." Expo's canonical wrapper for
that is `expo-speech`, and it is not a dependency — not in `package.json`, not
in `node_modules`. Unlike 3.1 (whisper.rn was already installed, so a wrapper
could be written and tested against its real API), there is nothing real here
to design `shared/tts` against without first picking a library — designing the
interface blind risks guessing wrong and a rewrite once the real package lands.
**You decide:** approve `expo-speech` (and confirm the audit — it's OS-level,
no network, should be a clean addition), or name a different TTS approach.

### 1.6.1 — ChatBubble markdown rendering
Requires adding `react-native-markdown-display` and `expo-clipboard`. Per
`CLAUDE.md`, dependencies must be audited for outbound requests before adding —
the loop will not install packages unattended.
**You decide:** approve both deps (and confirm the audit), or keep 1.6.1 deferred.

## Failed verification

_(none)_
