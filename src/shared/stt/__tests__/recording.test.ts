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

  it("defaults to the HIGH_QUALITY preset when no options are given", async () => {
    const handle = await startRecording();
    await handle.stop();
    // Constructed via the mocked AudioRecorder — its stored options reflect
    // what startRecording actually passed to the constructor.
    expect(AudioRecorder).toHaveBeenCalledWith(
      expect.objectContaining({ sampleRate: 44100, numberOfChannels: 2 }),
    );
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

describe("startRecording — edge cases", () => {
  it("merges caller options over the default preset rather than replacing it", async () => {
    await startRecording({ numberOfChannels: 1 });
    expect(AudioRecorder).toHaveBeenCalledWith(
      expect.objectContaining({
        numberOfChannels: 1,
        // sampleRate is untouched — still the preset's value.
        sampleRate: 44100,
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
