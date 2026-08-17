// Tests for step 3.3 — written before implementation (TDD)
import type { WhisperContext } from "@/shared/stt";
import { startRecording, transcribeAudio } from "@/shared/stt";
import { startVoiceInput } from "../index";

jest.mock("@/shared/stt");

const mockStartRecording = startRecording as jest.Mock;
const mockTranscribeAudio = transcribeAudio as jest.Mock;

const sttCtx = {} as WhisperContext;

function fakeRecording(uri: string | null = "file:///mock/take.m4a") {
  const stop = jest.fn(async () => {
    if (uri === null) throw new Error("Recording produced no file");
    return { uri };
  });
  mockStartRecording.mockResolvedValue({ stop });
  return { stop };
}

function fakeTranscription(text = "hello world") {
  const result = Promise.resolve({
    text,
    language: "en",
    segments: [],
    isAborted: false,
  });
  mockTranscribeAudio.mockReturnValue({
    abort: jest.fn(async () => {}),
    result,
  });
  return { result };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("startVoiceInput — happy path", () => {
  it("begins recording immediately, without needing an STT context", async () => {
    fakeRecording();
    fakeTranscription();
    // No sttCtx passed anywhere — startRecording needs none. Only
    // finish(sttCtx) does, further down.
    await startVoiceInput();
    expect(mockStartRecording).toHaveBeenCalled();
  });

  it("finish(sttCtx) stops the recording and transcribes the resulting file", async () => {
    const { stop } = fakeRecording("file:///mock/note.m4a");
    fakeTranscription("insert this text");

    const session = await startVoiceInput();
    const { text } = await session.finish(sttCtx);

    expect(stop).toHaveBeenCalled();
    expect(mockTranscribeAudio).toHaveBeenCalledWith(
      sttCtx,
      "file:///mock/note.m4a",
    );
    expect(text).toBe("insert this text");
  });

  it("cancel() stops the recording without ever transcribing it", async () => {
    const { stop } = fakeRecording();
    fakeTranscription();

    const session = await startVoiceInput();
    await session.cancel();

    expect(stop).toHaveBeenCalled();
    expect(mockTranscribeAudio).not.toHaveBeenCalled();
  });
});

describe("startVoiceInput — edge cases", () => {
  it("resolves with empty text rather than throwing when transcription hears nothing", async () => {
    fakeRecording();
    fakeTranscription("");

    const session = await startVoiceInput();
    const { text } = await session.finish(sttCtx);

    expect(text).toBe("");
  });
});

describe("startVoiceInput — error handling", () => {
  it("propagates a permission/recording failure from startRecording", async () => {
    mockStartRecording.mockRejectedValue(
      new Error("Microphone permission was not granted"),
    );

    await expect(startVoiceInput()).rejects.toThrow(
      "Microphone permission was not granted",
    );
  });

  it("propagates a transcription failure from finish(sttCtx)", async () => {
    fakeRecording();
    // Lazily constructed via mockImplementation rather than
    // mockReturnValue(Promise.reject(...)): the latter builds the rejected
    // promise eagerly, before startVoiceInput exists to ever await it (TDD
    // red state), which Node treats as an unhandled rejection and crashes
    // the whole test runner rather than failing this one test cleanly.
    mockTranscribeAudio.mockImplementation(() => ({
      abort: jest.fn(async () => {}),
      result: Promise.reject(new Error("whisper failed")),
    }));

    const session = await startVoiceInput();
    await expect(session.finish(sttCtx)).rejects.toThrow("whisper failed");
  });

  it("propagates a stop() failure from finish(sttCtx) without calling transcribeAudio", async () => {
    fakeRecording(null);
    fakeTranscription();

    const session = await startVoiceInput();
    await expect(session.finish(sttCtx)).rejects.toThrow(
      "Recording produced no file",
    );
    expect(mockTranscribeAudio).not.toHaveBeenCalled();
  });
});
