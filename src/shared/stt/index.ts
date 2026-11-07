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
import AudioPcmStream from "@fugood/react-native-audio-pcm-stream";
import { Directory, File, Paths } from "expo-file-system";

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
 * The cache folders voice recordings are written into: expo-audio's
 * (read from its native sources) `ExpoAudio` on iOS and `Audio` on Android,
 * and `Recordings` for Android's PCM path (`RECORDINGS_CACHE_DIRECTORY`,
 * 10.42). The full wipe deletes them; voice input deletes each recording as
 * soon as it's used (10.45).
 */
export const RECORDING_CACHE_DIRECTORIES = [
  "ExpoAudio",
  "Audio",
  "Recordings",
] as const;

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
 * What whisper.rn reads: 16-bit little-endian linear PCM in a WAV container
 * (it resamples to 16 kHz mono itself; recording that already saves work).
 * Anything else (the old default was HIGH_QUALITY — 44.1 kHz stereo AAC
 * .m4a) records fine and then fails every transcription.
 *
 * iOS writes exactly that through expo-audio. Android's MediaRecorder can't
 * produce WAV at all, so Android captures raw PCM instead and writes the WAV
 * itself (`startPcmRecording`, 10.42); the preset below is iOS-only in effect.
 */
const WHISPER_SAMPLE_RATE = 16000;
const WHISPER_RECORDING_PRESET_BY_PLATFORM = {
  ...RecordingPresets.HIGH_QUALITY,
  extension: ".wav",
  sampleRate: WHISPER_SAMPLE_RATE,
  numberOfChannels: 1,
  bitRate: WHISPER_SAMPLE_RATE * 16,
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
  const { ios, android: _android, web: _web, ...common } = preset;
  if (Platform.OS === "ios") return { ...common, ...ios };
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
 * layer. Records in the format whisper reads: on iOS through expo-audio
 * (`WHISPER_RECORDING_PRESET`), on Android as raw PCM wrapped in a WAV
 * file here (`startPcmRecording`). `options` apply to the iOS recorder only.
 */
export async function startRecording(
  options: RecordingOptions = {},
): Promise<RecordingHandle> {
  const permission = await requestRecordingPermissionsAsync();
  if (!permission.granted) {
    throw new Error("Microphone permission was not granted");
  }
  if (Platform.OS === "android") return startPcmRecording();

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

/** The PCM format whisper reads, as `encodeWav` describes it. */
export type PcmFormat = {
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
};

const WHISPER_PCM_FORMAT: PcmFormat = {
  sampleRate: WHISPER_SAMPLE_RATE,
  channels: 1,
  bitsPerSample: 16,
};

const WAV_HEADER_BYTES = 44;

/**
 * Wraps raw little-endian PCM samples in a canonical 44-byte WAV header
 * (RIFF/WAVE, one `fmt ` chunk, one `data` chunk). A trailing partial frame
 * is dropped: it would misalign every sample after it.
 */
export function encodeWav(pcm: Uint8Array, format: PcmFormat): Uint8Array {
  const blockAlign = format.channels * (format.bitsPerSample / 8);
  const dataLength = pcm.length - (pcm.length % blockAlign);
  const wav = new Uint8Array(WAV_HEADER_BYTES + dataLength);
  const view = new DataView(wav.buffer);
  const ascii = (at: number, text: string) => {
    for (let i = 0; i < text.length; i++) wav[at + i] = text.charCodeAt(i);
  };

  ascii(0, "RIFF");
  view.setUint32(4, 36 + dataLength, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // linear PCM
  view.setUint16(22, format.channels, true);
  view.setUint32(24, format.sampleRate, true);
  view.setUint32(28, format.sampleRate * blockAlign, true); // byte rate
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, format.bitsPerSample, true);
  ascii(36, "data");
  view.setUint32(40, dataLength, true);
  wav.set(pcm.subarray(0, dataLength), WAV_HEADER_BYTES);
  return wav;
}

/**
 * Where Android voice recordings are written (cache, so the OS may reclaim
 * them). The full wipe deletes this folder too.
 */
export const RECORDINGS_CACHE_DIRECTORY = "Recordings";

/**
 * Writes a finished WAV into the recordings cache folder and returns its
 * `file://` uri. expo-file-system directly, not shared/fs: shared slices
 * don't import each other (eslint boundaries).
 */
let recordingCounter = 0;
function writeRecording(wav: Uint8Array): string {
  const directory = new Directory(Paths.cache, RECORDINGS_CACHE_DIRECTORY);
  directory.create({ intermediates: true, idempotent: true });
  recordingCounter += 1;
  const file = new File(
    directory,
    `voice-${Date.now()}-${recordingCounter}.wav`,
  );
  file.write(wav);
  return file.uri;
}

/** Android MediaRecorder.AudioSource.VOICE_RECOGNITION: tuned for speech. */
const ANDROID_VOICE_RECOGNITION_SOURCE = 6;

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function concatBytes(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

/**
 * How long `stop()` keeps listening after telling the native stream to stop.
 * The native stop() only flags its read thread, which finishes the buffer it
 * is reading and emits it afterwards, and events reach JS asynchronously.
 * At the device's default buffer (about 40 ms at 16 kHz) this is several
 * buffers of margin.
 */
export const PCM_DRAIN_MS = 250;

/**
 * One Android recording at a time, in order. The native module has one
 * shared recorder: an init() while an older read thread is still reading
 * replaces it under that thread (garbled audio, or a crash in its cleanup).
 * Each recording takes a turn when it starts and gives it back when its stop
 * has drained, or when its start failed, so the next waits for exactly that.
 * features/voice-input always stops a started recording (commit and
 * cancel); if one is stranded anyway, the next start force-stops it
 * (`liveRecording`).
 */
let pcmTurn: Promise<void> = Promise.resolve();

/**
 * The recording that is capturing right now, if any (10.46 safety net). The
 * UI allows one hold at a time, so a recording still live when the next one
 * starts was stranded — its stop never came — and is force-stopped, its
 * audio discarded, rather than holding the turn (and the mic) forever.
 */
let liveRecording: { forceStop: () => void } | null = null;

/**
 * Android capture (10.42): streams 16 kHz mono 16-bit PCM from the
 * voice-recognition source and, on stop, writes it as a WAV file whisper can
 * read. Permission has already been granted by `startRecording`. The buffer
 * size is left to the device default: the native side discards its first two
 * buffers, so a larger buffer would clip the first syllable.
 */
async function startPcmRecording(): Promise<RecordingHandle> {
  liveRecording?.forceStop();
  const previous = pcmTurn;
  let releaseTurn: () => void = () => {};
  pcmTurn = new Promise<void>((resolve) => {
    releaseTurn = resolve;
  });
  await previous;

  const chunks: Uint8Array[] = [];
  let listening = true;
  const subscription = AudioPcmStream.on("data", (base64Chunk) => {
    if (listening) chunks.push(base64ToBytes(base64Chunk));
  });

  try {
    await AudioPcmStream.init({
      ...WHISPER_PCM_FORMAT,
      audioSource: ANDROID_VOICE_RECOGNITION_SOURCE,
    });
    AudioPcmStream.start();
  } catch (e) {
    listening = false;
    subscription.remove();
    releaseTurn();
    throw e;
  }

  let stopping: Promise<{ uri: string }> | null = null;

  /** Ends the native stream, drains it, and (unless discarded) writes the WAV. */
  const finish = async (discard: boolean): Promise<{ uri: string }> => {
    if (liveRecording === self) liveRecording = null;
    try {
      AudioPcmStream.stop();
      // Keep the buffer the read thread emits after stop().
      await new Promise<void>((resolve) => {
        setTimeout(resolve, PCM_DRAIN_MS);
      });
    } finally {
      listening = false;
      subscription.remove();
      releaseTurn();
    }
    if (discard) {
      throw new Error("Recording was stopped by a newer one");
    }
    const pcm = concatBytes(chunks);
    if (pcm.length === 0) {
      throw new Error("Recording captured no audio");
    }
    return { uri: writeRecording(encodeWav(pcm, WHISPER_PCM_FORMAT)) };
  };

  const self = {
    forceStop: () => {
      if (stopping) return;
      stopping = finish(true);
      stopping.catch(() => {}); // its owner may never ask
    },
  };
  liveRecording = self;

  return {
    // Idempotent: a second call returns the first one's result. Calling the
    // native stop() again would end the NEXT recording (one shared flag).
    stop: () => {
      stopping ??= finish(false);
      return stopping;
    },
  };
}
