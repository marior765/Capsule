// Tests for step 3.4 — written before implementation (TDD)
import { evaluateHold } from "../holdGesture";

describe("evaluateHold — happy path", () => {
  it("commits a press held past the minimum duration", () => {
    expect(evaluateHold(0, 500, { minHoldMs: 300 })).toBe("committed");
  });

  it("cancels a press released before the minimum duration", () => {
    expect(evaluateHold(0, 100, { minHoldMs: 300 })).toBe("cancelled");
  });
});

describe("evaluateHold — edge cases", () => {
  it("commits a press held for exactly the minimum duration (inclusive boundary)", () => {
    expect(evaluateHold(0, 300, { minHoldMs: 300 })).toBe("committed");
  });

  it("cancels a press one millisecond short of the minimum", () => {
    expect(evaluateHold(0, 299, { minHoldMs: 300 })).toBe("cancelled");
  });

  it("commits any hold at all when the minimum is zero", () => {
    expect(evaluateHold(1000, 1000, { minHoldMs: 0 })).toBe("committed");
  });

  it("does not depend on the timestamps' absolute origin", () => {
    const oneHourMs = 60 * 60 * 1000;
    expect(evaluateHold(oneHourMs, oneHourMs + 500, { minHoldMs: 300 })).toBe(
      "committed",
    );
  });
});

describe("evaluateHold — error handling", () => {
  // Clock skew or an out-of-order event delivery should never crash the
  // widget — a nonsensical duration is treated as no hold at all.
  it("cancels rather than throwing when pressOutAt precedes pressInAt", () => {
    expect(() => evaluateHold(500, 100, { minHoldMs: 300 })).not.toThrow();
    expect(evaluateHold(500, 100, { minHoldMs: 300 })).toBe("cancelled");
  });

  // A negative minHoldMs is invalid config, not a signal to block every
  // commit. It's treated the same as zero — any hold at all commits —
  // rather than throwing on bad input from a caller.
  it("treats a negative minimum as zero rather than throwing", () => {
    expect(() => evaluateHold(0, 50, { minHoldMs: -100 })).not.toThrow();
    expect(evaluateHold(0, 50, { minHoldMs: -100 })).toBe("committed");
  });
});
