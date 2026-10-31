// Tests for step 10.39 — written before implementation (TDD)
//
// Renders ChatThread and drives its list with the scroll events React Native
// delivers, then checks whether the thread scrolls itself to the newest
// message. Complements the pure nextFollowState tests: this proves the
// events are wired to the state machine and that following gates
// scrollToEnd.
import { fireEvent, render, screen } from "@testing-library/react-native";
import { FlatList } from "react-native";
import type { Message } from "@/entities/message";
import { ChatThread } from "../ChatThread";

const message = (id: string, content: string): Message => ({
  id,
  conversationId: "c1",
  parentId: null,
  role: "user",
  content,
  tokenCount: 0,
  createdAt: 1,
});

const VIEWPORT = 800;
const CONTENT = 3000;
const scrollEvent = (offsetY: number) => ({
  nativeEvent: {
    contentOffset: { x: 0, y: offsetY },
    contentSize: { width: 400, height: CONTENT },
    layoutMeasurement: { width: 400, height: VIEWPORT },
  },
});
const AT_BOTTOM = CONTENT - VIEWPORT;
const SCROLLED_UP = 200;

describe("ChatThread follow-scroll (rendered, 10.39)", () => {
  let scrollToEnd: jest.SpyInstance;
  /** Frames the thread queued; run with flushFrames(). */
  let frames: FrameRequestCallback[];
  const flushFrames = () => {
    const queued = frames;
    frames = [];
    queued.forEach((callback) => callback(0));
  };

  beforeEach(() => {
    // The thread defers its scroll a frame; frames run when the test says.
    frames = [];
    jest
      .spyOn(globalThis, "requestAnimationFrame")
      .mockImplementation((callback: FrameRequestCallback) => {
        frames.push(callback);
        return frames.length;
      });
    scrollToEnd = jest
      .spyOn(FlatList.prototype, "scrollToEnd")
      .mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const list = () => screen.getByTestId(ChatThread.testIDs.containers.list);
  /** Content grows (a token or a reply) and the next frame runs. */
  const grow = async () => {
    await fireEvent(list(), "contentSizeChange", 400, CONTENT);
    flushFrames();
  };

  it("opens at the newest message and follows new content", async () => {
    await render(<ChatThread messages={[message("m1", "hi")]} />);
    await grow();
    expect(scrollToEnd).toHaveBeenCalledTimes(1);
    expect(scrollToEnd).toHaveBeenLastCalledWith({ animated: false });

    await grow();
    expect(scrollToEnd).toHaveBeenCalledTimes(2);
    expect(scrollToEnd).toHaveBeenLastCalledWith({ animated: true });
  });

  it("stops following when the reader drags up, and resumes at the bottom", async () => {
    await render(<ChatThread messages={[message("m1", "hi")]} />);
    await grow();
    scrollToEnd.mockClear();

    await fireEvent(list(), "scrollBeginDrag", scrollEvent(AT_BOTTOM));
    await fireEvent(list(), "scrollEndDrag", scrollEvent(SCROLLED_UP));
    await grow();
    expect(scrollToEnd).not.toHaveBeenCalled();

    await fireEvent(list(), "scrollBeginDrag", scrollEvent(SCROLLED_UP));
    await fireEvent(list(), "scrollEndDrag", scrollEvent(AT_BOTTOM));
    await grow();
    expect(scrollToEnd).toHaveBeenCalledTimes(1);
  });

  // The Android bug kept in quarantine as 10.14: the app's own animated
  // scrollToEnd emits momentum events, which used to switch following off
  // partway through a long reply, with no touch at all.
  it("keeps following through the app's own scroll momentum", async () => {
    await render(<ChatThread messages={[message("m1", "hi")]} />);
    await grow();
    scrollToEnd.mockClear();

    await fireEvent(list(), "momentumScrollBegin", scrollEvent(SCROLLED_UP));
    await fireEvent(list(), "momentumScrollEnd", scrollEvent(SCROLLED_UP));
    await grow();
    expect(scrollToEnd).toHaveBeenCalledTimes(1);
  });

  it("a grab during the app's animation is not undone by that animation ending", async () => {
    await render(<ChatThread messages={[message("m1", "hi")]} />);
    await grow();
    scrollToEnd.mockClear();

    await fireEvent(list(), "scrollBeginDrag", scrollEvent(AT_BOTTOM));
    await fireEvent(list(), "momentumScrollEnd", scrollEvent(AT_BOTTOM));
    await grow();
    expect(scrollToEnd).not.toHaveBeenCalled();
  });

  it("a flick up stops following once the fling carries the list away", async () => {
    await render(<ChatThread messages={[message("m1", "hi")]} />);
    await grow();
    scrollToEnd.mockClear();

    await fireEvent(list(), "scrollBeginDrag", scrollEvent(AT_BOTTOM));
    await fireEvent(list(), "scrollEndDrag", scrollEvent(AT_BOTTOM));
    await fireEvent(list(), "momentumScrollBegin", scrollEvent(AT_BOTTOM));
    await fireEvent(list(), "momentumScrollEnd", scrollEvent(SCROLLED_UP));
    await grow();
    expect(scrollToEnd).not.toHaveBeenCalled();
  });

  // Reviewer finding (10.39): following was checked only when the frame
  // was queued. A drag that starts before the frame runs must cancel it,
  // or the late scrollToEnd pulls the reader back down mid-drag.
  it("a frame queued before the reader grabs the list doesn't scroll", async () => {
    await render(<ChatThread messages={[message("m1", "hi")]} />);
    await grow();
    scrollToEnd.mockClear();

    await fireEvent(list(), "contentSizeChange", 400, CONTENT);
    await fireEvent(list(), "scrollBeginDrag", scrollEvent(AT_BOTTOM));
    flushFrames();
    expect(scrollToEnd).not.toHaveBeenCalled();
  });

  it("Android: a release at the bottom with no fling keeps following", async () => {
    await render(<ChatThread messages={[message("m1", "hi")]} />);
    await grow();
    scrollToEnd.mockClear();

    await fireEvent(list(), "scrollBeginDrag", scrollEvent(AT_BOTTOM));
    await fireEvent(list(), "scrollEndDrag", scrollEvent(AT_BOTTOM));
    await fireEvent(list(), "momentumScrollBegin", scrollEvent(AT_BOTTOM));
    await fireEvent(list(), "momentumScrollEnd", scrollEvent(AT_BOTTOM));
    await grow();
    expect(scrollToEnd).toHaveBeenCalledTimes(1);
  });

  it("iOS: a release at the bottom with no fling keeps following", async () => {
    await render(<ChatThread messages={[message("m1", "hi")]} />);
    await grow();
    scrollToEnd.mockClear();

    await fireEvent(list(), "scrollBeginDrag", scrollEvent(AT_BOTTOM));
    await fireEvent(list(), "scrollEndDrag", scrollEvent(AT_BOTTOM));
    await grow();
    // The app's scrollToEnd finishes; iOS reports only its momentumEnd.
    await fireEvent(list(), "momentumScrollEnd", scrollEvent(AT_BOTTOM));
    await grow();
    expect(scrollToEnd).toHaveBeenCalledTimes(2);
  });
});
