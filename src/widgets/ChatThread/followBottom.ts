/** How close (in points) to the end still counts as "reading the latest". */
export const FOLLOW_THRESHOLD = 48;

/** The parts of a scroll event's `nativeEvent` this needs. */
export type ScrollMetrics = {
  contentOffset: { y: number };
  contentSize: { height: number };
  layoutMeasurement: { height: number };
};

/**
 * Whether the reader is at (or within FOLLOW_THRESHOLD of) the newest
 * message. While true the thread follows new content; once they scroll up
 * to reread, it stops following until they come back down.
 */
export function isNearBottom({
  contentOffset,
  contentSize,
  layoutMeasurement,
}: ScrollMetrics): boolean {
  const distance =
    contentSize.height - layoutMeasurement.height - contentOffset.y;
  return distance <= FOLLOW_THRESHOLD;
}

/**
 * Whether the list just moved UP, to somewhere away from the bottom, with
 * `previousOffsetY` the offset of the previous scroll event (null if none).
 * The app only scrolls toward the bottom (following new content), so every
 * app scroll ends, and stays, within reach of it; moving up away from the
 * bottom when nobody is dragging is therefore the system's doing: an iOS status-bar tap scrolling to
 * the top (10.47). Caught as the animation starts, because onScrollToTop
 * only fires once it has finished, and a token arriving in between would
 * otherwise scroll back down and cancel it. Moving up while still at the
 * bottom (the keyboard closing clamps the offset) doesn't count.
 */
export function isSystemScrollUp(
  previousOffsetY: number | null,
  metrics: ScrollMetrics,
): boolean {
  if (previousOffsetY === null) return false;
  const movedUp = metrics.contentOffset.y < previousOffsetY - 1;
  return movedUp && !isNearBottom(metrics);
}

/**
 * Where the reader's own scrolling stands:
 * - `idle` — nobody is touching the list; any momentum is the app's own.
 * - `dragging` — the finger is down; momentum is never the reader's.
 * - `settling` — the finger lifted; the next momentum is the reader's.
 */
export type FollowPhase = "idle" | "dragging" | "settling";

/** Whether the thread follows new content, and what the reader is doing. */
export type FollowState = { following: boolean; phase: FollowPhase };

export type FollowEvent =
  | { type: "dragBegin" }
  | { type: "dragEnd"; nearBottom: boolean }
  | { type: "momentumBegin" }
  | { type: "momentumEnd"; nearBottom: boolean }
  /** iOS status-bar tap scrolled the list to the top (10.47). */
  | { type: "scrollToTop" }
  /** The list moved up with no drag in progress: see isSystemScrollUp. */
  | { type: "systemScrollUp" };

export const INITIAL_FOLLOW_STATE: FollowState = {
  following: true,
  phase: "idle",
};

/**
 * React Native fires momentum events for the app's own scrolls as well
 * (RN 0.85): Android's animated scrollToEnd runs a fling animator that emits
 * momentum begin/end, and iOS emits momentum end after every programmatic
 * scroll. So momentum only counts right after the reader's drag:
 * - while the finger is down it never counts — an Android grab cancels the
 *   app's animation and delivers dragBegin, then that animation's momentumEnd;
 * - after the finger lifts, Android always emits momentumBegin at once (fling
 *   or not) and iOS emits it only for a real fling; either way the momentum
 *   that follows is the reader's, and it decides where following ends up.
 */
export function nextFollowState(
  state: FollowState,
  event: FollowEvent,
): FollowState {
  switch (event.type) {
    case "dragBegin":
      return { following: false, phase: "dragging" };
    case "dragEnd":
      return { following: event.nearBottom, phase: "settling" };
    case "momentumBegin":
      // A flick up from the bottom must not be followed mid-fling.
      return state.phase === "settling"
        ? { following: false, phase: "settling" }
        : state;
    case "momentumEnd":
      return state.phase === "settling"
        ? { following: event.nearBottom, phase: "idle" }
        : state;
    case "scrollToTop":
      // Like scrolling up to reread: the reader asked to see the top. Later
      // app-side momentum (idle phase) can't turn following back on;
      // dragging back to the bottom does.
      return { following: false, phase: "idle" };
    case "systemScrollUp":
      // Idle, or a release at the bottom still settling (following on: a
      // reader's fling would have sent momentumBegin first). A drag or a
      // fling in progress is handled by the drag's own events.
      return state.phase === "idle" ||
        (state.phase === "settling" && state.following)
        ? { following: false, phase: "idle" }
        : state;
  }
}
