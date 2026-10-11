// Tests for 4.6 (re-lock after leaving the app; user decision 2026-10-11:
// a Privacy setting — immediately / 1 min / 5 min, default 1 min) —
// written before implementation (TDD).
import {
  getLockAfter,
  setLockAfter,
  shouldRelock,
  LOCK_AFTER_OPTIONS,
} from "../index";
import { remove, setString } from "@/shared/storage";

beforeEach(() => remove("appLock.lockAfter"));

describe("lock timing setting", () => {
  it("defaults to 1 minute", () => {
    expect(getLockAfter()).toBe("1min");
  });

  it("remembers the chosen option", () => {
    setLockAfter("5min");
    expect(getLockAfter()).toBe("5min");
  });

  it("falls back to the default for an unknown stored value", () => {
    setString("appLock.lockAfter", "forever");
    expect(getLockAfter()).toBe("1min");
  });

  it("offers exactly immediately / 1 min / 5 min, in that order", () => {
    expect(LOCK_AFTER_OPTIONS.map((o) => o.value)).toEqual([
      "immediately",
      "1min",
      "5min",
    ]);
  });
});

describe("shouldRelock", () => {
  const leftAt = 1_000_000;

  it("always re-locks when set to immediately", () => {
    expect(shouldRelock(leftAt, leftAt + 1, "immediately")).toBe(true);
  });

  it("re-locks after a minute away, not before", () => {
    expect(shouldRelock(leftAt, leftAt + 59_999, "1min")).toBe(false);
    expect(shouldRelock(leftAt, leftAt + 60_000, "1min")).toBe(true);
  });

  it("re-locks after five minutes away, not before", () => {
    expect(shouldRelock(leftAt, leftAt + 299_999, "5min")).toBe(false);
    expect(shouldRelock(leftAt, leftAt + 300_000, "5min")).toBe(true);
  });

  it("re-locks if the clock went backwards (can't tell how long it was)", () => {
    expect(shouldRelock(leftAt, leftAt - 10, "5min")).toBe(true);
  });

  it("does not re-lock when the app never went to the background", () => {
    expect(shouldRelock(null, leftAt, "immediately")).toBe(false);
  });
});
