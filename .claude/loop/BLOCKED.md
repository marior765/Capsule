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

### 1.6.1 — ChatBubble markdown rendering
Requires adding `react-native-markdown-display` and `expo-clipboard`. Per
`CLAUDE.md`, dependencies must be audited for outbound requests before adding —
the loop will not install packages unattended.
**You decide:** approve both deps (and confirm the audit), or keep 1.6.1 deferred.

### Pre-existing uncommitted work
The working tree at bootstrap held a large staged change from earlier sessions
spanning routes, settings screens, and several new slices. It predates the loop
and was never reviewed or committed.
**You decide:** review and commit it yourself, or let beat 1 gate it (tsc + jest +
eslint + reviewer) and commit it as a single "pre-loop baseline" checkpoint.

## Failed verification

_(none)_
