// Tests for step 3.1 — written before implementation (TDD)
import { initWhisper } from "whisper.rn";
import { __resetWhisperMock } from "@/__mocks__/whisper.rn";
import {
  abortTranscription,
  initStt,
  releaseStt,
  transcribeAudio,
} from "../index";
import type { WhisperContext } from "../index";

const MOCK_MODEL_PATH = "/models/ggml-base.en.bin";
const MOCK_AUDIO_PATH = "/recordings/note.wav";

// whisper.rn is mapped to a hand-written mock (its `exports` map has no "."
// entry, so the bare specifier will not resolve under jest). Assertions below
// are on the arguments the wrapper hands down, never on what the mock returns.
const mockInitWhisper = initWhisper as jest.Mock;

beforeEach(() => {
  __resetWhisperMock();
});

/**
 * `transcribeAudio` is tested against a recording stand-in rather than
 * whisper.rn's own jest mock. What is worth asserting is *our* half of the
 * contract — that whisper's `result`/`t0`/`t1` shape is normalised into ours,
 * and that its `{ stop, promise }` handle becomes `{ abort, result }`. Driving
 * the shipped mock would instead assert that whisper.rn returns the string
 * " Test", which is whisper.rn's job to test, not ours.
 */
type TranscribeCall = { path: string; options: Record<string, unknown> };

type NativeSegment = { text: string; t0: number; t1: number };

function fakeContext(
  native: {
    result?: string;
    language?: string;
    segments?: NativeSegment[];
    isAborted?: boolean;
  } = {},
) {
  const calls: TranscribeCall[] = [];
  const stop = jest.fn(async () => {});
  const ctx = {
    transcribe: jest.fn(
      (path: string, options: Record<string, unknown> = {}) => {
        calls.push({ path, options });
        return {
          stop,
          promise: Promise.resolve({
            result: native.result ?? " Hello there",
            language: native.language ?? "en",
            segments: native.segments ?? [
              { text: " Hello there", t0: 0, t1: 33 },
            ],
            isAborted: native.isAborted ?? false,
          }),
        };
      },
    ),
    release: jest.fn(async () => {}),
  };
  return {
    ctx: ctx as unknown as WhisperContext,
    calls,
    spies: { ...ctx, stop },
  };
}

describe("shared/stt — initStt", () => {
  it("returns the context whisper.rn produced, not one of its own", async () => {
    const ctx = await initStt(MOCK_MODEL_PATH);
    const produced = await mockInitWhisper.mock.results[0].value;
    expect(ctx).toBe(produced);
    await releaseStt(ctx);
  });

  it("loads the model from the given path", async () => {
    const ctx = await initStt(MOCK_MODEL_PATH);
    expect(mockInitWhisper).toHaveBeenCalledWith(
      expect.objectContaining({ filePath: MOCK_MODEL_PATH }),
    );
    await releaseStt(ctx);
  });

  it("uses the GPU by default", async () => {
    const ctx = await initStt(MOCK_MODEL_PATH);
    expect(mockInitWhisper).toHaveBeenCalledWith(
      expect.objectContaining({ useGpu: true }),
    );
    await releaseStt(ctx);
  });

  it("honours an explicit request to run on CPU", async () => {
    const ctx = await initStt(MOCK_MODEL_PATH, { useGpu: false });
    expect(mockInitWhisper).toHaveBeenCalledWith(
      expect.objectContaining({ useGpu: false }),
    );
    await releaseStt(ctx);
  });

  it("throws if the model path is empty", async () => {
    await expect(initStt("")).rejects.toThrow("Model path is required");
  });

  // Hard rule: no network in core logic. A remote model path would make the
  // wrapper fetch at load time, so it is refused here rather than downstream.
  it("refuses to load a model over the network", async () => {
    await expect(
      initStt("https://example.com/ggml-base.en.bin"),
    ).rejects.toThrow("must be a local file");
    expect(mockInitWhisper).not.toHaveBeenCalled();
  });
});

describe("shared/stt — transcribeAudio happy path", () => {
  it("returns the transcribed text under our own field name", async () => {
    const { ctx } = fakeContext({ result: " Good morning" });
    const { result } = transcribeAudio(ctx, MOCK_AUDIO_PATH);
    await expect(result).resolves.toMatchObject({ text: " Good morning" });
  });

  it("returns the detected language", async () => {
    const { ctx } = fakeContext({ language: "uk" });
    const { result } = transcribeAudio(ctx, MOCK_AUDIO_PATH);
    await expect(result).resolves.toMatchObject({ language: "uk" });
  });

  // whisper reports segment bounds in 10ms units — `to_timestamp` in whisper.cpp
  // converts with `msec = t * 10`, while whisper.rn's README prints the same
  // numbers as if they were seconds. Callers should never have to know that, so
  // the wrapper normalises to milliseconds.
  it("converts segment timestamps from whisper's 10ms units to milliseconds", async () => {
    const { ctx } = fakeContext({
      segments: [
        { text: " Hello", t0: 0, t1: 33 },
        { text: " there", t0: 33, t1: 120 },
      ],
    });
    const { result } = transcribeAudio(ctx, MOCK_AUDIO_PATH);
    await expect(result).resolves.toMatchObject({
      segments: [
        { text: " Hello", startMs: 0, endMs: 330 },
        { text: " there", startMs: 330, endMs: 1200 },
      ],
    });
  });

  it("passes the audio path to whisper.rn", () => {
    const { ctx, calls } = fakeContext();
    transcribeAudio(ctx, MOCK_AUDIO_PATH);
    expect(calls[0].path).toBe(MOCK_AUDIO_PATH);
  });

  it("passes transcription params through to whisper.rn", () => {
    const { ctx, calls } = fakeContext();
    transcribeAudio(ctx, MOCK_AUDIO_PATH, {
      language: "uk",
      translate: true,
      maxThreads: 4,
      tokenTimestamps: true,
    });
    expect(calls[0].options).toMatchObject({
      language: "uk",
      translate: true,
      maxThreads: 4,
      tokenTimestamps: true,
    });
  });

  it("forwards progress updates to the caller", () => {
    const { ctx, calls } = fakeContext();
    const onProgress = jest.fn();
    transcribeAudio(ctx, MOCK_AUDIO_PATH, { onProgress });
    const forwarded = calls[0].options.onProgress as (p: number) => void;
    forwarded(42);
    expect(onProgress).toHaveBeenCalledWith(42);
  });

  // `toBeUndefined` cannot tell an absent key from one explicitly set to
  // undefined, so it would pass against an implementation that forwards every
  // key unconditionally. Assert on key presence instead.
  it("omits params the caller left unset rather than sending them as undefined", () => {
    const { ctx, calls } = fakeContext();
    transcribeAudio(ctx, MOCK_AUDIO_PATH, { language: "uk" });
    expect(calls[0].options).toHaveProperty("language");
    expect(calls[0].options).not.toHaveProperty("translate");
    expect(calls[0].options).not.toHaveProperty("maxThreads");
    expect(calls[0].options).not.toHaveProperty("onProgress");
  });
});

describe("shared/stt — transcribeAudio edge cases", () => {
  it("handles a result with no segments", async () => {
    const { ctx } = fakeContext({ result: "", segments: [] });
    const { result } = transcribeAudio(ctx, MOCK_AUDIO_PATH);
    await expect(result).resolves.toMatchObject({ text: "", segments: [] });
  });

  it("surfaces that a transcription was aborted", async () => {
    const { ctx } = fakeContext({ isAborted: true });
    const { result } = transcribeAudio(ctx, MOCK_AUDIO_PATH);
    await expect(result).resolves.toMatchObject({ isAborted: true });
  });

  it("handles a zero-length segment", async () => {
    const { ctx } = fakeContext({
      segments: [{ text: "", t0: 7, t1: 7 }],
    });
    const { result } = transcribeAudio(ctx, MOCK_AUDIO_PATH);
    await expect(result).resolves.toMatchObject({
      segments: [{ text: "", startMs: 70, endMs: 70 }],
    });
  });
});

describe("shared/stt — transcribeAudio error handling", () => {
  it("throws if the context is not initialized", () => {
    expect(() =>
      transcribeAudio(null as unknown as WhisperContext, MOCK_AUDIO_PATH),
    ).toThrow("STT context is not initialized");
  });

  it("throws if the audio path is empty", () => {
    const { ctx, spies } = fakeContext();
    expect(() => transcribeAudio(ctx, "")).toThrow("Audio path is required");
    expect(spies.transcribe).not.toHaveBeenCalled();
  });

  // Hard rule: no network in core logic.
  it("refuses to transcribe audio fetched over the network", () => {
    const { ctx, spies } = fakeContext();
    expect(() => transcribeAudio(ctx, "https://example.com/audio.wav")).toThrow(
      "must be a local file",
    );
    expect(spies.transcribe).not.toHaveBeenCalled();
  });

  it("propagates a failure from the native layer", async () => {
    const { ctx, spies } = fakeContext();
    spies.transcribe.mockImplementationOnce(() => ({
      stop: jest.fn(async () => {}),
      promise: Promise.reject(new Error("native failure")),
    }));
    const { result } = transcribeAudio(ctx, MOCK_AUDIO_PATH);
    await expect(result).rejects.toThrow("native failure");
  });
});

describe("shared/stt — abortTranscription", () => {
  it("stops the running transcription", async () => {
    const { ctx, spies } = fakeContext();
    const handle = transcribeAudio(ctx, MOCK_AUDIO_PATH);
    await abortTranscription(handle);
    expect(spies.stop).toHaveBeenCalled();
  });

  it("is a no-op without a handle", async () => {
    await expect(
      abortTranscription(null as unknown as ReturnType<typeof transcribeAudio>),
    ).resolves.not.toThrow();
  });
});

describe("shared/stt — releaseStt", () => {
  // The whole point of releaseStt is freeing the native context. Asserting only
  // that it resolves would pass against an empty function body — and leak a
  // whisper context per model load.
  it("releases the native context", async () => {
    const { ctx, spies } = fakeContext();
    await releaseStt(ctx);
    expect(spies.release).toHaveBeenCalled();
  });

  it("releases the context without throwing", async () => {
    const ctx = await initStt(MOCK_MODEL_PATH);
    await expect(releaseStt(ctx)).resolves.not.toThrow();
  });

  it("is a no-op without a context", async () => {
    await expect(
      releaseStt(null as unknown as WhisperContext),
    ).resolves.not.toThrow();
  });
});
