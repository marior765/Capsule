// Tests for step 10.14 — written before implementation (TDD)
//
// Found in the simulator: opening a long conversation showed its FIRST
// messages, and new replies streamed in below the fold. The thread should
// open at the newest message and follow new content — but only while the
// reader is at the bottom; scrolling up to reread must not be hijacked.
import { readFileSync } from "fs";
import { join } from "path";
import { FOLLOW_THRESHOLD, isNearBottom } from "../followBottom";

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
    expect(source).not.toMatch(/\bonScroll=/);
    expect(source).toMatch(/isNearBottom\(/);
  });
});
