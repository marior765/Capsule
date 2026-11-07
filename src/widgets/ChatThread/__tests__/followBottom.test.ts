// Tests for step 10.14 — written before implementation (TDD)
//
// Found in the simulator: opening a long conversation showed its FIRST
// messages, and new replies streamed in below the fold. The thread should
// open at the newest message and follow new content — but only while the
// reader is at the bottom; scrolling up to reread must not be hijacked.
import { readFileSync } from "fs";
import { join } from "path";
import {
  FOLLOW_THRESHOLD,
  isNearBottom,
  isSystemScrollUp,
} from "../followBottom";

const scroll = (
  offsetY: number,
  contentHeight: number,
  viewportHeight: number,
) => ({
  contentOffset: { y: offsetY },
  contentSize: { height: contentHeight },
  layoutMeasurement: { height: viewportHeight },
});

describe("isNearBottom", () => {
  it("is true at the very bottom", () => {
    expect(isNearBottom(scroll(1200, 2000, 800))).toBe(true);
  });

  it("is true within the threshold of the bottom", () => {
    expect(isNearBottom(scroll(1200 - FOLLOW_THRESHOLD + 1, 2000, 800))).toBe(
      true,
    );
  });

  it("is false once the reader has scrolled up past the threshold", () => {
    expect(isNearBottom(scroll(1200 - FOLLOW_THRESHOLD - 1, 2000, 800))).toBe(
      false,
    );
    expect(isNearBottom(scroll(0, 2000, 800))).toBe(false);
  });

  it("is true when everything fits on screen", () => {
    expect(isNearBottom(scroll(0, 500, 800))).toBe(true);
  });

  it("tolerates iOS overscroll past the end", () => {
    expect(isNearBottom(scroll(1300, 2000, 800))).toBe(true);
  });
});

describe("ChatThread wiring (static)", () => {
  const source = readFileSync(join(__dirname, "../ChatThread.tsx"), "utf8");

  it("scrolls to the end when content grows while following", () => {
    expect(source).toMatch(/onContentSizeChange=/);
    expect(source).toMatch(/scrollToEnd\(/);
  });

  // Found in the simulator: calling scrollToEnd synchronously from the first
  // onContentSizeChange is a no-op — the list's viewport isn't laid out yet.
  // The scroll is deferred a frame, and repeated once the viewport is known.
  it("defers the scroll a frame and repeats it once the viewport is laid out", () => {
    expect(source).toMatch(/requestAnimationFrame\(/);
    expect(source).toMatch(/onLayout=/);
  });

  // Found in the simulator: tracking with onScroll broke the very first
  // scroll — the list emits an onScroll at offset 0 on mount, before content
  // is measured, which switched following off; programmatic animated scrolls
  // emit mid-animation onScroll events too. Only the reader's own scrolling
  // (end of drag / end of momentum) decides whether to keep following.
  it("decides whether to follow only from the reader's own scrolling", () => {
    expect(source).toMatch(/onScrollBeginDrag=/);
    expect(source).toMatch(/onMomentumScrollBegin=/);
    expect(source).toMatch(/onScrollEndDrag=/);
    expect(source).toMatch(/onMomentumScrollEnd=/);
    // onScroll is used for one thing only (10.47): spotting a system scroll
    // up (iOS status-bar tap) as it starts, via isSystemScrollUp.
    expect(source).toMatch(/onScroll=\{[^}]*isSystemScrollUp\(/s);
    expect(source).toMatch(/isNearBottom\(/);
    expect(source).toMatch(/nextFollowState\(/);
  });
});

// Reviewer findings (10.14 rounds 2–3) and step 10.39. React Native fires
// momentum events for the app's OWN scrolls too: Android's animated
// scrollToEnd emits onMomentumScrollBegin/End, and iOS emits
// onMomentumScrollEnd after every programmatic scroll. Only momentum right
// after the reader's drag may change whether the thread follows. While the
// finger is down momentum never counts: Android can deliver
// dragBegin → momentumEnd(nearBottom) when a grab interrupts the app's
// animation, which must not turn following back on mid-drag.
describe("nextFollowState (idle / dragging / settling)", () => {
  const { nextFollowState, INITIAL_FOLLOW_STATE } =
    jest.requireActual<typeof import("../followBottom")>("../followBottom");
  type State = import("../followBottom").FollowState;
  type Event = import("../followBottom").FollowEvent;
  const run = (events: Event[], from: State = INITIAL_FOLLOW_STATE): State =>
    events.reduce(nextFollowState, from);

  it("starts following, idle", () => {
    expect(INITIAL_FOLLOW_STATE).toEqual({ following: true, phase: "idle" });
  });

  it("ignores momentum from the app's own scrolls while idle", () => {
    const s = run([
      { type: "momentumBegin" },
      { type: "momentumEnd", nearBottom: false },
    ]);
    expect(s).toEqual({ following: true, phase: "idle" });
  });

  it("stops following the moment the reader starts dragging", () => {
    expect(run([{ type: "dragBegin" }])).toEqual({
      following: false,
      phase: "dragging",
    });
  });

  it("dragBegin → momentumEnd(nearBottom) leaves following off (grab during the app's animation)", () => {
    const s = run([
      { type: "dragBegin" },
      { type: "momentumEnd", nearBottom: true },
      { type: "momentumBegin" },
      { type: "momentumEnd", nearBottom: true },
    ]);
    expect(s).toEqual({ following: false, phase: "dragging" });
  });

  it("dragEnd sets following from where the finger lifted, and settles", () => {
    expect(
      run([{ type: "dragBegin" }, { type: "dragEnd", nearBottom: false }]),
    ).toEqual({ following: false, phase: "settling" });
    expect(
      run([{ type: "dragBegin" }, { type: "dragEnd", nearBottom: true }]),
    ).toEqual({ following: true, phase: "settling" });
  });

  it("a flick up from the bottom isn't followed mid-fling, and stays off where it lands", () => {
    let s = run([
      { type: "dragBegin" },
      { type: "dragEnd", nearBottom: true },
      { type: "momentumBegin" },
    ]);
    expect(s).toEqual({ following: false, phase: "settling" });
    s = run([{ type: "momentumEnd", nearBottom: false }], s);
    expect(s).toEqual({ following: false, phase: "idle" });
  });

  it("a flick down to the bottom resumes following when it lands", () => {
    const s = run([
      { type: "dragBegin" },
      { type: "dragEnd", nearBottom: false },
      { type: "momentumBegin" },
      { type: "momentumEnd", nearBottom: true },
    ]);
    expect(s).toEqual({ following: true, phase: "idle" });
  });

  // Android emits momentum after every drag end, fling or not.
  it("Android: a release at the bottom with no fling keeps following", () => {
    const s = run([
      { type: "dragBegin" },
      { type: "dragEnd", nearBottom: true },
      { type: "momentumBegin" },
      { type: "momentumEnd", nearBottom: true },
    ]);
    expect(s).toEqual({ following: true, phase: "idle" });
  });

  // iOS emits no momentum for a release without a fling; the app's next
  // programmatic scrollToEnd then ends with only momentumEnd, at the bottom.
  it("iOS: no-fling release at the bottom, then the app's scroll ends at the bottom", () => {
    const s = run([
      { type: "dragBegin" },
      { type: "dragEnd", nearBottom: true },
      { type: "momentumEnd", nearBottom: true },
    ]);
    expect(s).toEqual({ following: true, phase: "idle" });
  });

  it("grabbing the list mid-fling stops following again", () => {
    const s = run([
      { type: "dragBegin" },
      { type: "dragEnd", nearBottom: true },
      { type: "momentumBegin" },
      { type: "dragBegin" },
      { type: "momentumEnd", nearBottom: true },
    ]);
    expect(s).toEqual({ following: false, phase: "dragging" });
  });

  it("after a drag fully settles, later programmatic momentum is ignored again", () => {
    let s = run([
      { type: "dragBegin" },
      { type: "dragEnd", nearBottom: true },
      { type: "momentumBegin" },
      { type: "momentumEnd", nearBottom: true },
    ]);
    expect(s).toEqual({ following: true, phase: "idle" });
    s = run(
      [{ type: "momentumBegin" }, { type: "momentumEnd", nearBottom: false }],
      s,
    );
    expect(s).toEqual({ following: true, phase: "idle" });
  });
});

// Tests for step 10.47 — written before implementation (TDD)
//
// Found reviewing 10.39: tapping the iOS status bar scrolls the chat to the
// top and fires only onScrollToTop (no drag, no reader momentum), so the
// thread kept following and the next streamed token pulled the reader back
// down. A status-bar tap now counts like scrolling up to reread.
describe("nextFollowState — status-bar tap to top (10.47)", () => {
  const { nextFollowState, INITIAL_FOLLOW_STATE } =
    jest.requireActual<typeof import("../followBottom")>("../followBottom");

  it("stops following", () => {
    expect(
      nextFollowState(INITIAL_FOLLOW_STATE, { type: "scrollToTop" }),
    ).toEqual({ following: false, phase: "idle" });
  });

  it("the app's own momentum afterwards doesn't turn following back on", () => {
    let s = nextFollowState(INITIAL_FOLLOW_STATE, { type: "scrollToTop" });
    s = nextFollowState(s, { type: "momentumEnd", nearBottom: true });
    expect(s.following).toBe(false);
  });

  it("dragging back to the bottom resumes following", () => {
    let s = nextFollowState(INITIAL_FOLLOW_STATE, { type: "scrollToTop" });
    s = nextFollowState(s, { type: "dragBegin" });
    s = nextFollowState(s, { type: "dragEnd", nearBottom: true });
    s = nextFollowState(s, { type: "momentumBegin" });
    s = nextFollowState(s, { type: "momentumEnd", nearBottom: true });
    expect(s).toEqual({ following: true, phase: "idle" });
  });
});

// Reviewer finding (10.47, round 1): onScrollToTop fires only AFTER the
// ~0.3 s scroll-to-top animation, and a streamed token's scrollToEnd in that
// window cancels the animation on iOS. The tap is spotted as it starts: with
// no drag in progress, the app itself only ever scrolls DOWN, so the list
// moving up to somewhere away from the bottom is the system's doing.
describe("isSystemScrollUp (10.47)", () => {
  it("is false for the first scroll event (nothing to compare with)", () => {
    expect(isSystemScrollUp(null, scroll(0, 2000, 800))).toBe(false);
  });

  it("is true when the list moved up to away from the bottom", () => {
    expect(isSystemScrollUp(1200, scroll(900, 2000, 800))).toBe(true);
  });

  it("is false when the list moved down (the app following)", () => {
    expect(isSystemScrollUp(900, scroll(1200, 2000, 800))).toBe(false);
  });

  // Dismissing the keyboard grows the viewport and clamps the offset up,
  // but the reader is still at the bottom.
  it("is false when it moved up but is still at the bottom", () => {
    expect(isSystemScrollUp(1500, scroll(1200, 2000, 800))).toBe(false);
  });

  it("is false for sub-point jitter", () => {
    expect(isSystemScrollUp(900.4, scroll(900, 2000, 800))).toBe(false);
  });
});

describe("nextFollowState — systemScrollUp (10.47)", () => {
  const { nextFollowState, INITIAL_FOLLOW_STATE } =
    jest.requireActual<typeof import("../followBottom")>("../followBottom");

  it("stops following when nobody is touching the list", () => {
    expect(
      nextFollowState(INITIAL_FOLLOW_STATE, { type: "systemScrollUp" }),
    ).toEqual({ following: false, phase: "idle" });
  });

  it("leaves a drag in progress to the drag's own events", () => {
    const dragging = { following: false, phase: "dragging" as const };
    expect(nextFollowState(dragging, { type: "systemScrollUp" })).toBe(
      dragging,
    );
  });

  // iOS: a release at the bottom with no fling stays "settling" until the
  // next momentumEnd. A reader's own fling always brings momentumBegin
  // (following off) first, so moving up away from the bottom while settling
  // with following on can only be the system.
  it("also stops following after a release at the bottom (settling)", () => {
    const settling = { following: true, phase: "settling" as const };
    expect(nextFollowState(settling, { type: "systemScrollUp" })).toEqual({
      following: false,
      phase: "idle",
    });
  });

  it("leaves a fling in progress alone (settling, not following)", () => {
    const flinging = { following: false, phase: "settling" as const };
    expect(nextFollowState(flinging, { type: "systemScrollUp" })).toBe(
      flinging,
    );
  });
});
