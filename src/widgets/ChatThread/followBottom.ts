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
