// Tests for step 10.1 — written before implementation (TDD)
//
// Found in the simulator 2026-10-12: holding the mic threw
// "RecordingDisabledException: Recording not allowed on iOS. Enable with
// Audio.setAudioModeAsync". iOS refuses to record until the audio session is
// switched into a recording-capable mode, so startRecording must do that
// before it prepares the recorder — and hand the session back afterwards.
import { setAudioModeAsync } from "expo-audio";
import {
  AudioRecorder,
  __resetAudioMock,
  __setNextPermission,
} from "@/__mocks__/expo-audio";
import { startRecording } from "../index";

const mockSetAudioMode = setAudioModeAsync as unknown as jest.Mock;
const mockAudioRecorder = AudioRecorder as unknown as jest.Mock;

function lastRecorder() {
  const { results } = mockAudioRecorder.mock;
  return results[results.length - 1].value as {
    prepareToRecordAsync: jest.Mock;
    stop: jest.Mock;
  };
}

beforeEach(() => {
  __resetAudioMock();
});

describe("startRecording — iOS audio session", () => {
  it("switches the audio session into recording mode", async () => {
    await startRecording();
    expect(mockSetAudioMode).toHaveBeenCalledWith(
      expect.objectContaining({
        allowsRecording: true,
        playsInSilentMode: true,
      }),
    );
  });

  it("enables recording before the recorder is prepared", async () => {
    await startRecording();
    const enableOrder = mockSetAudioMode.mock.invocationCallOrder[0];
    const prepareOrder =
      lastRecorder().prepareToRecordAsync.mock.invocationCallOrder[0];
    expect(enableOrder).toBeLessThan(prepareOrder);
  });

  // Reviewer finding (10.1): native AudioMode fields default to false, so
  // releasing with only `allowsRecording: false` also flipped
  // playsInSilentMode off — read-aloud then went quiet on a muted phone.
  it("keeps playing in silent mode when it hands the session back", async () => {
    const handle = await startRecording();
    await handle.stop();
    const calls = mockSetAudioMode.mock.calls.map((c) => c[0]);
    expect(calls[calls.length - 1]).toEqual({
      allowsRecording: false,
      playsInSilentMode: true,
    });
  });

  it("turns recording mode back off once the recording stops", async () => {
    const handle = await startRecording();
    await handle.stop();
    const calls = mockSetAudioMode.mock.calls.map((c) => c[0]);
    expect(calls[calls.length - 1]).toEqual(
      expect.objectContaining({ allowsRecording: false }),
    );
    const disableOrder =
      mockSetAudioMode.mock.invocationCallOrder[
        mockSetAudioMode.mock.invocationCallOrder.length - 1
      ];
    expect(lastRecorder().stop.mock.invocationCallOrder[0]).toBeLessThan(
      disableOrder,
    );
  });

  it("turns recording mode off even when the recording produced no file", async () => {
    const { __setNextRecordingUri } = jest.requireActual<
      typeof import("@/__mocks__/expo-audio")
    >("@/__mocks__/expo-audio");
    __setNextRecordingUri(null);
    const handle = await startRecording();
    await expect(handle.stop()).rejects.toThrow();
    const calls = mockSetAudioMode.mock.calls.map((c) => c[0]);
    expect(calls[calls.length - 1]).toEqual(
      expect.objectContaining({ allowsRecording: false }),
    );
  });

  it("doesn't touch the audio session when microphone permission is denied", async () => {
    __setNextPermission(false);
    await expect(startRecording()).rejects.toThrow();
    expect(mockSetAudioMode).not.toHaveBeenCalled();
  });

  it("hands the session back if preparing the recorder fails", async () => {
    mockAudioRecorder.mockImplementationOnce(() => ({
      uri: null,
      prepareToRecordAsync: jest.fn(async () => {
        throw new Error("prepare failed");
      }),
      record: jest.fn(),
      stop: jest.fn(async () => {}),
    }));
    await expect(startRecording()).rejects.toThrow("prepare failed");
    const calls = mockSetAudioMode.mock.calls.map((c) => c[0]);
    expect(calls[calls.length - 1]).toEqual(
      expect.objectContaining({ allowsRecording: false }),
    );
  });
});
