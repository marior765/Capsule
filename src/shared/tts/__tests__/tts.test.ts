// Tests for step 3.5 — written before implementation (TDD)
import { speak as expoSpeak, stop, isSpeakingAsync } from "expo-speech";
import { __resetSpeechMock, __setNextOutcome } from "@/__mocks__/expo-speech";
import { speak, stopSpeaking, isSpeaking } from "../index";

const mockExpoSpeak = expoSpeak as jest.Mock;
const mockStop = stop as jest.Mock;
const mockIsSpeakingAsync = isSpeakingAsync as jest.Mock;

beforeEach(() => {
  __resetSpeechMock();
});

describe("speak — happy path", () => {
  it("passes the text through to expo-speech", async () => {
    await speak("Hello there");
    expect(mockExpoSpeak).toHaveBeenCalledWith(
      "Hello there",
      expect.anything(),
    );
  });

  it("resolves once the OS reports the utterance is done", async () => {
    await expect(speak("Hello there")).resolves.toBeUndefined();
  });

  it("resolves when speech is stopped early — that's not a failure", async () => {
    __setNextOutcome("stopped");
    await expect(speak("Hello there")).resolves.toBeUndefined();
  });

  it("forwards language/pitch/rate/volume to expo-speech", async () => {
    await speak("Hello", {
      language: "uk-UA",
      pitch: 1.2,
      rate: 0.9,
      volume: 0.8,
    });
    expect(mockExpoSpeak).toHaveBeenCalledWith(
      "Hello",
      expect.objectContaining({
        language: "uk-UA",
        pitch: 1.2,
        rate: 0.9,
        volume: 0.8,
      }),
    );
  });
});

describe("speak — edge cases", () => {
  it("does not call expo-speech for empty text", async () => {
    await speak("");
    expect(mockExpoSpeak).not.toHaveBeenCalled();
  });

  it("does not call expo-speech for whitespace-only text", async () => {
    await speak("   ");
    expect(mockExpoSpeak).not.toHaveBeenCalled();
  });

  it("omits options the caller left unset rather than sending them as undefined", async () => {
    await speak("Hello");
    const options = mockExpoSpeak.mock.calls[0][1];
    expect(options).not.toHaveProperty("language");
    expect(options).not.toHaveProperty("pitch");
  });
});

describe("speak — error handling", () => {
  it("rejects when the OS reports a speech error", async () => {
    __setNextOutcome({ error: new Error("synth unavailable") });
    await expect(speak("Hello there")).rejects.toThrow("synth unavailable");
  });
});

describe("stopSpeaking", () => {
  it("calls expo-speech's stop", async () => {
    await stopSpeaking();
    expect(mockStop).toHaveBeenCalled();
  });
});

describe("isSpeaking", () => {
  it("returns expo-speech's isSpeakingAsync result", async () => {
    mockIsSpeakingAsync.mockResolvedValueOnce(true);
    await expect(isSpeaking()).resolves.toBe(true);
  });
});
