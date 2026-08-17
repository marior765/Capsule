// Tests for step 3.3 (route-safe controller) — written before implementation (TDD)
import type { WhisperContext } from "@/shared/stt";
import { startRecording, transcribeAudio } from "@/shared/stt";
import { createVoiceInputController } from "../index";

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

/** Resolves only when `release()` is called — simulates a slow ensureReady(). */
function pendingSttContext() {
  let release: (ctx: WhisperContext) => void;
  const promise = new Promise<WhisperContext>((resolve) => {
    release = resolve;
  });
  return { getSttContext: () => promise, release: () => release(sttCtx) };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("createVoiceInputController — happy path", () => {
  it("returns synchronously, without waiting for the STT context", () => {
    fakeRecording();
    fakeTranscription();
    const { getSttContext } = pendingSttContext(); // never released in this test
    const controller = createVoiceInputController(getSttContext);
    // No `await` above — reaching this line at all proves the call didn't
    // block, which is the entire reason this controller exists: a
    // VoiceRecordButton onHoldStart is a synchronous () => void and cannot
    // itself await context readiness.
    expect(controller).toBeDefined();
  });

  // This is the property an earlier version of this function got wrong: it
  // awaited getSttContext() *before* calling startVoiceInput, so recording
  // didn't begin until the context resolved — silently capturing nothing on
  // a slow first-run model download, while the button's UI still showed
  // "recording" the whole time. Asserted synchronously, with the context
  // never released in this test, so there is no way for this to pass unless
  // startRecording is genuinely called independent of context readiness.
  it("starts recording immediately, before the STT context resolves", () => {
    fakeRecording();
    const { getSttContext } = pendingSttContext(); // never released
    createVoiceInputController(getSttContext);
    expect(mockStartRecording).toHaveBeenCalled();
  });

  it("commit() waits for the context to become ready, then transcribes", async () => {
    fakeRecording("file:///mock/note.m4a");
    fakeTranscription("insert this text");
    const { getSttContext, release } = pendingSttContext();

    const controller = createVoiceInputController(getSttContext);
    // Recording already started at this point — see the test above — so
    // this confirms specifically that *transcription* is what waits on the
    // context, not that everything does.
    expect(mockStartRecording).toHaveBeenCalled();

    const commitPromise = controller.commit();

    // Give the pending promise a chance to matter — if commit() resolved
    // early (the bug this controller prevents), it would do so before we
    // ever release the context.
    await Promise.resolve();
    release();

    const { text } = await commitPromise;
    expect(text).toBe("insert this text");
    expect(mockTranscribeAudio).toHaveBeenCalledWith(
      sttCtx,
      "file:///mock/note.m4a",
    );
  });

  it("cancel() waits for the context to become ready, then discards the recording", async () => {
    const { stop } = fakeRecording();
    fakeTranscription();
    const { getSttContext, release } = pendingSttContext();

    const controller = createVoiceInputController(getSttContext);
    const cancelPromise = controller.cancel();

    await Promise.resolve();
    release();
    await cancelPromise;

    expect(stop).toHaveBeenCalled();
    expect(mockTranscribeAudio).not.toHaveBeenCalled();
  });
});

describe("createVoiceInputController — edge cases", () => {
  it("commit() called immediately (context already ready) still resolves correctly", async () => {
    fakeRecording("file:///mock/instant.m4a");
    fakeTranscription("fast");
    const controller = createVoiceInputController(async () => sttCtx);

    const { text } = await controller.commit();
    expect(text).toBe("fast");
  });
});

describe("createVoiceInputController — error handling", () => {
  it("propagates a failure from getSttContext (e.g. permission denied or download failure)", async () => {
    const controller = createVoiceInputController(async () => {
      throw new Error("Microphone permission was not granted");
    });
    await expect(controller.commit()).rejects.toThrow(
      "Microphone permission was not granted",
    );
  });

  it("propagates a recording-start failure even though getSttContext succeeded", async () => {
    mockStartRecording.mockRejectedValue(new Error("no mic"));
    const controller = createVoiceInputController(async () => sttCtx);
    await expect(controller.commit()).rejects.toThrow("no mic");
  });

  // cancel() deliberately never touches the STT context — discarding a
  // recording shouldn't care whether the model even loaded. A failed
  // download is irrelevant to "throw this recording away."
  it("cancel() succeeds even when getSttContext fails, and never calls transcribeAudio", async () => {
    const { stop } = fakeRecording();
    const controller = createVoiceInputController(async () => {
      throw new Error("download failed");
    });
    await expect(controller.cancel()).resolves.toBeUndefined();
    expect(stop).toHaveBeenCalled();
    expect(mockTranscribeAudio).not.toHaveBeenCalled();
  });
});
