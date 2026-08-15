/**
 * Decides whether a press-and-release on the record button counts as an
 * intentional hold or an accidental tap.
 *
 * Deliberately timestamp-in / timestamp-out rather than a stateful timer: the
 * component supplies real `Date.now()` values from its own press handlers, so
 * this stays a pure function — testable without rendering, no fake timers.
 *
 * This is purely a UI-timing concern. It says nothing about audio capture —
 * that's `features/voice-input`'s job once the recording dependency is
 * decided (see .claude/loop/BLOCKED.md).
 */

export type HoldOutcome = "committed" | "cancelled";

export type HoldGestureOptions = {
  /** Minimum press duration, in ms, for a hold to count as intentional. */
  minHoldMs: number;
};

export function evaluateHold(
  pressInAt: number,
  pressOutAt: number,
  options: HoldGestureOptions,
): HoldOutcome {
  const heldMs = pressOutAt - pressInAt;
  // A negative duration only happens from clock skew or out-of-order event
  // delivery — never a real hold, so it falls through to "cancelled" the
  // same as any other too-short press rather than needing its own branch.
  if (heldMs >= options.minHoldMs) {
    return "committed";
  }
  return "cancelled";
}
