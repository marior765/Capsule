// Tests for step 10.45 — written before implementation (TDD)
//
// Found reviewing 10.42: voice recordings (the user's voice) stayed in the
// cache after they were transcribed, on both platforms, and the full wipe
// didn't reach iOS's copies. Each recording is now deleted as soon as it has
// been used: after transcription (whether it worked or not) or on cancel.
import type { WhisperContext } from "@/shared/stt";
import { startRecording, transcribeAudio } from "@/shared/stt";
import {
  __deletedUris,
  __fileContents,
  __resetFsMock,
} from "@/__mocks__/expo-file-system";
import { createVoiceInputController, startVoiceInput } from "../index";

jest.mock("@/shared/stt");

const mockStartRecording = startRecording as jest.Mock;
const mockTranscribeAudio = transcribeAudio as jest.Mock;
const sttCtx = {} as WhisperContext;

/** A recording whose file really exists in the (mock) cache. */
const RECORDING = "file:///cache/ExpoAudio/recording-1.wav";

function fakeRecording(uri = RECORDING) {
  __fileContents.set(uri, new Uint8Array([1, 2, 3]));
  const stop = jest.fn(async () => ({ uri }));
  mockStartRecording.mockResolvedValue({ stop });
  return { stop };
}

/** A transcription that settles when the test says so. */
function controllableTranscription() {
  let resolve: (text: string) => void = () => {};
  let reject: (e: Error) => void = () => {};
  const result = new Promise((res, rej) => {
    resolve = (text) =>
      res({ text, language: "en", segments: [], isAborted: false });
    reject = rej;
  });
  mockTranscribeAudio.mockReturnValue({ abort: jest.fn(), result });
  return { resolve, reject };
}

const flush = () => new Promise((r) => setImmediate(r));

beforeEach(() => {
  jest.clearAllMocks();
  __resetFsMock();
});

describe("voice recordings are deleted after use (10.45)", () => {
  it("deletes the recording once it has been transcribed", async () => {
    fakeRecording();
    const transcription = controllableTranscription();
    const session = await startVoiceInput();

    const finished = session.finish(sttCtx);
    await flush();
    // Whisper is still reading the file: it must still be there.
    expect(__deletedUris).not.toContain(RECORDING);

    transcription.resolve("hello");
    await expect(finished).resolves.toEqual({ text: "hello" });
    expect(__deletedUris).toContain(RECORDING);
    expect(__fileContents.has(RECORDING)).toBe(false);
  });

  it("deletes the recording when transcription fails", async () => {
    fakeRecording();
    const transcription = controllableTranscription();
    const session = await startVoiceInput();

    const finished = session.finish(sttCtx);
    await flush();
    transcription.reject(new Error("whisper failed"));

    await expect(finished).rejects.toThrow("whisper failed");
    expect(__deletedUris).toContain(RECORDING);
  });

  it("deletes the recording when the voice model fails to load", async () => {
    fakeRecording();
    const controller = createVoiceInputController(() =>
      Promise.reject(new Error("download failed")),
    );

    await expect(controller.commit()).rejects.toThrow("download failed");
    expect(__deletedUris).toContain(RECORDING);
    expect(mockTranscribeAudio).not.toHaveBeenCalled();
  });

  it("deletes the recording on cancel", async () => {
    fakeRecording();
    const session = await startVoiceInput();

    await session.cancel();

    expect(__deletedUris).toContain(RECORDING);
  });

  // Best effort: a recording that can't be deleted (the native delete failed, or a path
  // outside the cache) never breaks voice input. The full wipe still clears
  // the recordings folders.
  it("never fails voice input because a recording couldn't be deleted", async () => {
    fakeRecording("file:///elsewhere/take.m4a"); // outside the cache
    const transcription = controllableTranscription();
    const session = await startVoiceInput();
    const finished = session.finish(sttCtx);
    await flush();
    transcription.resolve("still works");

    await expect(finished).resolves.toEqual({ text: "still works" });
    await expect((await startVoiceInput()).cancel()).resolves.toBeUndefined();
  });
});
