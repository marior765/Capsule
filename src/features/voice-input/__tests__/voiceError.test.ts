// Tests for step 10.1 — written before implementation (TDD)
//
// The chat screen used to show the raw native exception text
// ("FunctionCallException: Calling the 'record' function has failed (at
// ExpoModulesCore/SyncFunctionDefinition.swift:94) → Caused by: …") in red
// over the conversation. Users get a sentence they can act on instead.
import { describeVoiceError, VOICE_HOLD_HINT } from "../index";

describe("describeVoiceError", () => {
  it("explains a denied microphone permission and where to fix it", () => {
    const message = describeVoiceError(
      new Error("Microphone permission was not granted"),
    );
    expect(message).toMatch(/microphone/i);
    expect(message).toMatch(/settings/i);
  });

  it("never leaks native exception details", () => {
    const raw = new Error(
      "FunctionCallException: Calling the 'record' function has failed (at ExpoModulesCore/SyncFunctionDefinition.swift:94) → Caused by: RecordingDisabledException",
    );
    const message = describeVoiceError(raw);
    expect(message).not.toMatch(/Exception|swift|ExpoModulesCore/);
    expect(message).toMatch(/record/i);
  });

  it("says when a recording came out empty", () => {
    expect(describeVoiceError(new Error("Recording produced no file"))).toMatch(
      /nothing was recorded/i,
    );
  });

  it("falls back to a generic sentence for non-Error values", () => {
    const message = describeVoiceError("boom");
    expect(message.length).toBeGreaterThan(0);
    expect(message).not.toBe("boom");
  });
});

describe("VOICE_HOLD_HINT", () => {
  it("tells the user to hold the button", () => {
    expect(VOICE_HOLD_HINT).toMatch(/hold/i);
  });
});

describe("VOICE_EMPTY_HINT", () => {
  it("tells the user nothing was heard", () => {
    const { VOICE_EMPTY_HINT } =
      jest.requireActual<typeof import("../index")>("../index");
    expect(VOICE_EMPTY_HINT).toMatch(/didn't catch/i);
  });
});

describe("describeVoiceError — model failures", () => {
  it("says the voice model couldn't load, not that recording failed", () => {
    const { VoiceModelError } =
      jest.requireActual<typeof import("../index")>("../index");
    const message = describeVoiceError(
      new VoiceModelError(new Error("download failed: offline")),
    );
    expect(message).toMatch(/voice model/i);
    expect(message).not.toMatch(/start recording/i);
  });
});
