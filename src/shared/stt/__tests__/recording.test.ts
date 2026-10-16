// Tests for step 3.1 (record half) — written before implementation (TDD)
import { requestRecordingPermissionsAsync } from "expo-audio";
import {
  AudioRecorder,
  __resetAudioMock,
  __setNextPermission,
  __setNextRecordingUri,
} from "@/__mocks__/expo-audio";
import { startRecording } from "../index";

const mockRequestPermission = requestRecordingPermissionsAsync as jest.Mock;
const mockAudioRecorder = AudioRecorder as unknown as jest.Mock;

/** The options object each AudioRecorder construction received. */
function mockAudioRecorderCalls(): Record<string, unknown>[] {
  return mockAudioRecorder.mock.calls.map(
    (c) => c[0] as Record<string, unknown>,
  );
}

/** The real instance the mocked constructor produced on its most recent call. */
function lastRecorderInstance() {
  const { results } = mockAudioRecorder.mock;
  return results[results.length - 1].value as {
    prepareToRecordAsync: jest.Mock;
    record: jest.Mock;
  };
}

beforeEach(() => {
  __resetAudioMock();
});

describe("startRecording — happy path", () => {
  it("requests microphone permission before recording", async () => {
    await startRecording();
    expect(mockRequestPermission).toHaveBeenCalled();
  });

  // The gap this closes: a startRecording that skipped preparing/starting
  // the recorder entirely would previously still pass every test in this
  // file — `handle` would still be truthy, and stop() would still hand back
  // whatever URI the mock was told to produce regardless of whether a
  // recording ever actually began.
  it("prepares and starts the recorder", async () => {
    await startRecording();
    const recorder = lastRecorderInstance();
    expect(recorder.prepareToRecordAsync).toHaveBeenCalled();
    expect(recorder.record).toHaveBeenCalled();
  });

  it("stop() returns the local file the recording was written to", async () => {
    __setNextRecordingUri("file:///mock/take-1.m4a");
    const handle = await startRecording();
    const { uri } = await handle.stop();
    expect(uri).toBe("file:///mock/take-1.m4a");
  });

  // 10.1: whisper.rn only reads 16 kHz mono 16-bit PCM WAV. The old default
  // (HIGH_QUALITY: 44.1 kHz stereo AAC .m4a) recorded fine and then failed
  // every transcription — found in the simulator, not by this suite.
  it("records 16 kHz mono by default — what whisper reads", async () => {
    const handle = await startRecording();
    await handle.stop();
    expect(AudioRecorder).toHaveBeenCalledWith(
      expect.objectContaining({ sampleRate: 16000, numberOfChannels: 1 }),
    );
  });

  // Reviewer finding (10.1): the native AudioRecorder constructor decodes a
  // FLAT record — top-level outputFormat / linearPCM* keys, no `ios` key.
  // expo-audio only flattens the per-platform sub-object inside its hook
  // path, which this plain-function module doesn't use, so a nested `ios`
  // object was silently ignored. Assert the shape native actually reads.
  it("hands the native recorder flat iOS linear-PCM settings (no nested ios object)", async () => {
    await startRecording();
    const passed = mockAudioRecorderCalls()[0];
    expect(passed).toEqual(
      expect.objectContaining({
        extension: ".wav",
        sampleRate: 16000,
        numberOfChannels: 1,
        outputFormat: "lpcm",
        linearPCMBitDepth: 16,
        linearPCMIsBigEndian: false,
        linearPCMIsFloat: false,
      }),
    );
    expect(passed).not.toHaveProperty("ios");
    expect(passed).not.toHaveProperty("android");
  });

  // On real hardware, calling record() before the recorder has finished
  // preparing is the kind of ordering bug that only shows up on-device —
  // pinning the order here is what a device check (see BLOCKED.md) can't
  // catch on its own if this regresses silently later.
  it("prepares before it starts recording, not the other way around", async () => {
    await startRecording();
    const recorder = lastRecorderInstance();
    const prepareOrder =
      recorder.prepareToRecordAsync.mock.invocationCallOrder[0];
    const recordOrder = recorder.record.mock.invocationCallOrder[0];
    expect(prepareOrder).toBeLessThan(recordOrder);
  });
});

describe("startRecording — Android (10.1)", () => {
  // Android's MediaRecorder can't write WAV, so it still records AAC — the
  // file must then be named .m4a, not inherit the iOS ".wav".
  it("names the Android AAC recording .m4a", async () => {
    // A fresh module registry so the preset is re-flattened for Android.
    // react-native and the expo-audio mock are taken from that same registry:
    // Platform.OS is set there before shared/stt loads, and the recorder calls
    // read back are the ones this run made.
    let isolatedRecorder: jest.Mock | undefined;
    let started: Promise<unknown> | undefined;
    jest.isolateModules(() => {
      const { Platform } =
        jest.requireActual<typeof import("react-native")>("react-native");
      Object.defineProperty(Platform, "OS", {
        value: "android",
        configurable: true,
      });
      isolatedRecorder = jest.requireActual<
        typeof import("@/__mocks__/expo-audio")
      >("expo-audio").AudioRecorder as unknown as jest.Mock;
      const { startRecording: startOnAndroid } =
        jest.requireActual<typeof import("../index")>("../index");
      started = startOnAndroid();
    });
    await started;
    const calls = isolatedRecorder?.mock.calls ?? [];
    const passed = calls[calls.length - 1]?.[0] as
      | Record<string, unknown>
      | undefined;
    expect(passed).toEqual(
      expect.objectContaining({ extension: ".m4a", outputFormat: "mpeg4" }),
    );
    expect(passed).not.toHaveProperty("linearPCMBitDepth");
  });
});

describe("startRecording — edge cases", () => {
  it("merges caller options over the default preset rather than replacing it", async () => {
    await startRecording({ numberOfChannels: 1 });
    expect(AudioRecorder).toHaveBeenCalledWith(
      expect.objectContaining({
        numberOfChannels: 1,
        // sampleRate is untouched — still the preset's value.
        sampleRate: 16000,
      }),
    );
  });
});

describe("startRecording — error handling", () => {
  it("throws without ever starting the recorder when permission is denied", async () => {
    __setNextPermission(false);
    await expect(startRecording()).rejects.toThrow(
      "Microphone permission was not granted",
    );
    expect(AudioRecorder).not.toHaveBeenCalled();
  });

  it("throws if stop() produces no file", async () => {
    __setNextRecordingUri(null);
    const handle = await startRecording();
    await expect(handle.stop()).rejects.toThrow("Recording produced no file");
  });
});
