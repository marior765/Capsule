import { initWhisper as _initWhisper, WhisperContext } from "whisper.rn";

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
