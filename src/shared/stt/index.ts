import { Platform } from "react-native";
import { initWhisper as _initWhisper, WhisperContext } from "whisper.rn";
import {
  AudioModule,
  AudioQuality,
  IOSOutputFormat,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  type NativeAudioModule,
} from "expo-audio";

// `AudioModule.AudioRecorder` type-checks fine under plain `tsc` — this
// isn't for TypeScript. `eslint-plugin-import`'s `import/namespace` rule
// does its own static analysis of expo-audio's re-exports and fails to
// resolve `AudioRecorder` as a member of `AudioModule` directly, failing the
// real `npx eslint src` gate. The local-variable indirection itself is what
// dodges that static analysis; the `NativeAudioModule` type annotation is
// added on top for real type safety, not because it's what fixes the lint
// rule. Declared once at module scope, not inside `startRecording`, since
// it's a static workaround for the import itself, not per-call state.
const audioModule: NativeAudioModule = AudioModule;

export type { WhisperContext };

/**
 * A single timed chunk of transcribed speech.
 *
 * whisper reports segment bounds in 10ms units: `to_timestamp` in whisper.cpp
 * converts with `msec = t * 10`, and whisper.rn's JSI bridge passes t0/t1
 * straight through with only an int cast. Its README nonetheless prints them as
 * `t0.toFixed(2)}s`, as if seconds. Rather than let that ambiguity leak to
 * every caller, the wrapper normalises to milliseconds once, here.
 */
export type TranscriptionSegment = {
  text: string;
  startMs: number;
  endMs: number;
};

export type TranscriptionResult = {
  text: string;
  language: string;
  segments: TranscriptionSegment[];
  isAborted: boolean;
};

/**
 * Wrapper-level transcription params. whisper.rn's own options are already
 * camelCase, so these pass through by name — but they are re-declared rather
 * than re-exported so features never import a whisper.rn type directly.
 */
export type TranscriptionParams = {
  language?: string;
  translate?: boolean;
  maxThreads?: number;
  maxLen?: number;
  tokenTimestamps?: boolean;
  onProgress?: (progress: number) => void;
};

/**
 * A transcription in flight. `abort` maps onto whisper.rn's `stop`; `result`
 * onto its `promise`. Renamed so the rest of the app speaks our vocabulary.
 */
export type TranscriptionHandle = {
  abort: () => Promise<void>;
  result: Promise<TranscriptionResult>;
};

export type SttOptions = {
  useGpu?: boolean;
};

/** Whisper timestamps are in 10ms units. */
const WHISPER_TIME_UNIT_MS = 10;

/**
 * Core logic never reaches the network (see CLAUDE.md hard rules). whisper.rn
 * would itself refuse a remote path deeper down, but failing here keeps the
 * rule visible and testable at our own boundary.
 */
function assertLocalPath(path: string, subject: string): void {
  if (/^https?:\/\//i.test(path)) {
    throw new Error(
      `${subject} must be a local file — remote paths are refused`,
    );
  }
}

/**
 * Loads a whisper model into memory.
 *
 * GPU is on by default: on iOS this routes through Metal, and the CPU fallback
 * is slow enough on longer recordings to be felt. Callers that need determinism
 * (or hit a device where GPU transcription misbehaves) can opt out.
 */
export async function initStt(
  modelPath: string,
  options: SttOptions = {},
): Promise<WhisperContext> {
  if (!modelPath) {
    throw new Error("Model path is required");
  }
  assertLocalPath(modelPath, "Model path");

  return _initWhisper({
    filePath: modelPath,
    useGpu: options.useGpu ?? true,
  });
}

/**
 * Starts transcribing a local audio file.
 *
 * Synchronous by design: it returns the handle immediately so the caller can
 * abort a long transcription that has already begun. Validation therefore
 * throws rather than rejecting.
 */
export function transcribeAudio(
  ctx: WhisperContext,
  audioPath: string,
  params: TranscriptionParams = {},
): TranscriptionHandle {
  if (!ctx) {
    throw new Error("STT context is not initialized");
  }
  if (!audioPath) {
    throw new Error("Audio path is required");
  }
  assertLocalPath(audioPath, "Audio path");

  // Only forward keys the caller actually set. Writing every key with an
  // explicit `undefined` would reach native as a present-but-empty option, and
  // makes "did the caller ask for this?" untestable from the outside.
  const options: TranscriptionParams = {};
  if (params.language !== undefined) options.language = params.language;
  if (params.translate !== undefined) options.translate = params.translate;
  if (params.maxThreads !== undefined) options.maxThreads = params.maxThreads;
  if (params.maxLen !== undefined) options.maxLen = params.maxLen;
  if (params.tokenTimestamps !== undefined) {
    options.tokenTimestamps = params.tokenTimestamps;
  }
  if (params.onProgress !== undefined) options.onProgress = params.onProgress;

  const { stop, promise } = ctx.transcribe(audioPath, options);

  return {
    abort: stop,
    result: promise.then((native) => ({
      text: native.result,
      language: native.language,
      isAborted: native.isAborted,
      segments: native.segments.map((segment) => ({
        text: segment.text,
        startMs: segment.t0 * WHISPER_TIME_UNIT_MS,
        endMs: segment.t1 * WHISPER_TIME_UNIT_MS,
      })),
    })),
  };
}

export async function abortTranscription(
  handle: TranscriptionHandle,
): Promise<void> {
  if (!handle) return;
  await handle.abort();
}

export async function releaseStt(ctx: WhisperContext): Promise<void> {
  if (!ctx) return;
  await ctx.release();
}

/**
 * Overrides for the whisper-ready default preset below. Only
 * the scalar fields — not per-platform nested options — since nothing in
 * this app needs finer control yet. Re-declared rather than re-exported so
 * features never import an expo-audio type directly.
 */
export type RecordingOptions = {
  sampleRate?: number;
  numberOfChannels?: number;
  bitRate?: number;
  extension?: string;
};

/**
 * What whisper.rn can actually read: 16 kHz, mono, 16-bit little-endian
 * linear PCM in a WAV container. Recording anything else (the old default
 * was HIGH_QUALITY — 44.1 kHz stereo AAC .m4a) succeeds and then fails every
 * transcription.
 *
 * iOS writes exactly that. Android's MediaRecorder can't produce WAV at all,
 * so there this still records the preset's AAC — Android capture needs a
 * PCM-stream path of its own (see the 10.1 entry in BLOCKED.md).
 */
const WHISPER_SAMPLE_RATE = 16000;
const WHISPER_RECORDING_PRESET_BY_PLATFORM = {
  ...RecordingPresets.HIGH_QUALITY,
  extension: ".wav",
  sampleRate: WHISPER_SAMPLE_RATE,
  numberOfChannels: 1,
  bitRate: WHISPER_SAMPLE_RATE * 16,
  // Android still records the preset's AAC, so its file keeps an honest
  // .m4a name rather than inheriting the iOS ".wav".
  android: {
    ...RecordingPresets.HIGH_QUALITY.android,
    extension: ".m4a",
  },
  ios: {
    ...RecordingPresets.HIGH_QUALITY.ios,
    extension: ".wav",
    outputFormat: IOSOutputFormat.LINEARPCM,
    audioQuality: AudioQuality.MAX,
    sampleRate: WHISPER_SAMPLE_RATE,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
};

/**
 * The native AudioRecorder constructor reads a FLAT record (top-level
 * `outputFormat`, `linearPCM*`…) and ignores nested `ios`/`android`
 * objects. expo-audio flattens them only inside its `useAudioRecorder` hook,
 * which this plain-function module can't use — so it's done here, the same
 * way: common fields, then the current platform's sub-object on top.
 */
function flattenForPlatform(
  preset: typeof WHISPER_RECORDING_PRESET_BY_PLATFORM,
): Record<string, unknown> {
  const { ios, android, web: _web, ...common } = preset;
  if (Platform.OS === "ios") return { ...common, ...ios };
  if (Platform.OS === "android") return { ...common, ...android };
  return common;
}

const WHISPER_RECORDING_PRESET = flattenForPlatform(
  WHISPER_RECORDING_PRESET_BY_PLATFORM,
);

/**
 * A recording in progress. `stop` ends it and resolves with the local file
 * it was written to — ready to hand straight to `transcribeAudio`.
 */
export type RecordingHandle = {
  stop: () => Promise<{ uri: string }>;
};

/**
 * Starts recording from the microphone.
 *
 * Unlike `initStt`/`transcribeAudio`'s synchronous guards, this check is
 * async and can itself trigger the OS permission dialog on first call —
 * `requestRecordingPermissionsAsync` only resolves once that's answered, so
 * the `.granted` check below never sees an in-between "undetermined" state.
 * Throws rather than letting a denial fail silently deep in the native
 * layer. Records in the format whisper reads (see
 * `WHISPER_RECORDING_PRESET`).
 */
export async function startRecording(
  options: RecordingOptions = {},
): Promise<RecordingHandle> {
  const permission = await requestRecordingPermissionsAsync();
  if (!permission.granted) {
    throw new Error("Microphone permission was not granted");
  }

  // iOS refuses to record ("Recording not allowed on iOS") until the audio
  // session is in a recording-capable mode. `playsInSilentMode` is what makes
  // expo-audio pick the play-and-record category, so both are set together.
  await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });

  try {
    const recorder = new audioModule.AudioRecorder({
      ...WHISPER_RECORDING_PRESET,
      ...options,
    });
    await recorder.prepareToRecordAsync();
    recorder.record();

    return {
      stop: async () => {
        try {
          await recorder.stop();
        } finally {
          await releaseRecordingMode();
        }
        if (!recorder.uri) {
          throw new Error("Recording produced no file");
        }
        return { uri: recorder.uri };
      },
    };
  } catch (e) {
    await releaseRecordingMode();
    throw e;
  }
}

/**
 * Hands the audio session back once recording is over, so playback (e.g.
 * read-aloud) isn't left routed through the record-capable category. A
 * failure here never masks the recording's own outcome.
 */
async function releaseRecordingMode(): Promise<void> {
  try {
    // Every native AudioMode field defaults to false, so playsInSilentMode
    // must be restated — leaving it out would mute read-aloud on a phone set
    // to silent.
    await setAudioModeAsync({
      allowsRecording: false,
      playsInSilentMode: true,
    });
  } catch {
    // Nothing useful to do — the next startRecording sets the mode again.
  }
}
