// Tests for step 4.3 — written before implementation (TDD)
import {
  isEgressActive,
  beginEgress,
  subscribeToEgress,
  _resetEgressForTesting,
} from "../index";

beforeEach(() => {
  _resetEgressForTesting();
});

describe("isEgressActive", () => {
  it("is false with no network activity in flight", () => {
    expect(isEgressActive()).toBe(false);
  });

  it("is true once beginEgress is called", () => {
    beginEgress();
    expect(isEgressActive()).toBe(true);
  });

  it("is false again once the call it tracked ends", () => {
    const end = beginEgress();
    end();
    expect(isEgressActive()).toBe(false);
  });
});

describe("beginEgress — concurrency", () => {
  it("stays active while any one of several overlapping calls is still in flight", () => {
    const endA = beginEgress();
    const endB = beginEgress();
    endA();
    expect(isEgressActive()).toBe(true);
    endB();
    expect(isEgressActive()).toBe(false);
  });

  it("the ender function is idempotent — calling it twice does not double-decrement", () => {
    const endA = beginEgress();
    const endB = beginEgress();
    endA();
    endA();
    expect(isEgressActive()).toBe(true);
    endB();
    expect(isEgressActive()).toBe(false);
  });
});

describe("subscribeToEgress", () => {
  it("notifies a subscriber with true when egress starts", () => {
    const listener = jest.fn();
    subscribeToEgress(listener);
    beginEgress();
    expect(listener).toHaveBeenCalledWith(true);
  });

  it("notifies a subscriber with false when the last in-flight call ends", () => {
    const listener = jest.fn();
    const end = beginEgress();
    subscribeToEgress(listener);
    end();
    expect(listener).toHaveBeenCalledWith(false);
  });

  it("does not notify while other calls are still in flight", () => {
    const endA = beginEgress();
    beginEgress();
    const listener = jest.fn();
    subscribeToEgress(listener);
    endA();
    expect(listener).not.toHaveBeenCalled();
  });

  it("stops notifying after unsubscribing", () => {
    const listener = jest.fn();
    const unsubscribe = subscribeToEgress(listener);
    unsubscribe();
    beginEgress();
    expect(listener).not.toHaveBeenCalled();
  });

  it("notifies every subscriber independently", () => {
    const listenerA = jest.fn();
    const listenerB = jest.fn();
    subscribeToEgress(listenerA);
    subscribeToEgress(listenerB);
    beginEgress();
    expect(listenerA).toHaveBeenCalledWith(true);
    expect(listenerB).toHaveBeenCalledWith(true);
  });
});
