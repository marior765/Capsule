// Tests for step 10.29 — written before implementation (TDD)
//
// Found in the simulator: typing an invalid number in Inference settings was
// silently reverted (or, for "1.2abc", half-accepted) with no message, and
// out-of-range values like temperature 50 were saved.
import { readFileSync } from "fs";
import { join } from "path";
import { DEFAULT_INFERENCE } from "@/shared/config";
import { setString } from "@/shared/storage";
import {
  getInferenceSettings,
  resetInferenceSettings,
  validateInferenceValue,
} from "../index";

describe("validateInferenceValue", () => {
  it("accepts values in range and returns the number", () => {
    expect(validateInferenceValue("temperature", "0.7")).toEqual({
      value: 0.7,
    });
    expect(validateInferenceValue("topK", " 40 ")).toEqual({ value: 40 });
    expect(validateInferenceValue("seed", "-1")).toEqual({ value: -1 });
    expect(validateInferenceValue("contextLength", "8192")).toEqual({
      value: 8192,
    });
  });

  it("rejects text that isn't a plain number", () => {
    for (const raw of ["", "abc", "1.2abc", "1,5", "--1"]) {
      expect(validateInferenceValue("temperature", raw)).toEqual({
        error: "Enter a number.",
      });
    }
  });

  it("rejects fractions where a whole number is needed", () => {
    expect(validateInferenceValue("topK", "2.5")).toEqual({
      error: "Enter a whole number.",
    });
  });

  it("explains the allowed range", () => {
    expect(validateInferenceValue("temperature", "50")).toEqual({
      error: "Must be between 0 and 2.",
    });
    expect(validateInferenceValue("topP", "1.5")).toEqual({
      error: "Must be between 0 and 1.",
    });
    expect(validateInferenceValue("contextLength", "100")).toEqual({
      error: "Must be between 256 and 32768.",
    });
    expect(validateInferenceValue("seed", "-5")).toEqual({
      error: "Use -1 for a random seed, or 0 or more.",
    });
  });
});

describe("validateInferenceValue — edges", () => {
  it("accepts the range limits and short decimal forms", () => {
    expect(validateInferenceValue("temperature", "0")).toEqual({ value: 0 });
    expect(validateInferenceValue("temperature", "2")).toEqual({ value: 2 });
    expect(validateInferenceValue("contextLength", "256")).toEqual({
      value: 256,
    });
    expect(validateInferenceValue("contextLength", "32768")).toEqual({
      value: 32768,
    });
    expect(validateInferenceValue("seed", "2147483647")).toEqual({
      value: 2147483647,
    });
    expect(validateInferenceValue("topP", ".5")).toEqual({ value: 0.5 });
    expect(validateInferenceValue("temperature", "1.")).toEqual({ value: 1 });
  });

  it("rejects just past the limits", () => {
    expect("error" in validateInferenceValue("repeatPenalty", "0.4")).toBe(
      true,
    );
    expect("error" in validateInferenceValue("contextLength", "32769")).toBe(
      true,
    );
  });
});

describe("getInferenceSettings — values saved before validation existed", () => {
  beforeEach(() => resetInferenceSettings());

  it("falls back to the default for each stored value that isn't usable", () => {
    setString(
      "inference.settings",
      JSON.stringify({
        temperature: 50,
        contextLength: 100000,
        topK: 2.5,
        seed: "x",
        topP: 0.5,
      }),
    );
    expect(getInferenceSettings()).toEqual({
      ...DEFAULT_INFERENCE,
      topP: 0.5,
    });
  });
});

describe("inference screen (static)", () => {
  const screen = readFileSync(
    join(__dirname, "../../../app/(app)/(tabs)/settings/inference.tsx"),
    "utf8",
  );

  it("shows the error inline instead of silently reverting", () => {
    expect(screen).toMatch(/validateInferenceValue\(/);
    expect(screen).toMatch(/testIDs\.texts\.error/);
    expect(screen).not.toMatch(/Discard unparseable input/);
    // decimal-pad has no minus key — seed -1 must stay typeable.
    expect(screen).not.toMatch(/inputMode="decimal"/);
    expect(screen).toMatch(/keyboardType="numbers-and-punctuation"/);
    // VoiceOver doesn't read live regions.
    expect(screen).toMatch(/AccessibilityInfo\.announceForAccessibility\(/);
  });
});
