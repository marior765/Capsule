// Tests for step 10.44 — written before implementation (TDD)
//
// Privacy bug found reviewing 10.42: leaving a chat while holding the mic
// unmounted the button mid-press. Pressable fires no onPressOut on unmount,
// so neither onHoldCommit nor onHoldCancel ever came and the recording kept
// running. A hold that started must always be resolved, unmount included.
import { fireEvent, render, screen } from "@testing-library/react-native";
import { VoiceRecordButton } from "../VoiceRecordButton";

const callbacks = () => ({
  onHoldStart: jest.fn(),
  onHoldCommit: jest.fn(),
  onHoldCancel: jest.fn(),
});

const button = () =>
  screen.getByTestId(VoiceRecordButton.testIDs.buttons.record);

describe("VoiceRecordButton (rendered, 10.44)", () => {
  it("cancels a hold that is still in progress when it unmounts", async () => {
    const cb = callbacks();
    const { unmount } = await render(
      <VoiceRecordButton isRecording={false} {...cb} />,
    );
    await fireEvent(button(), "pressIn");
    expect(cb.onHoldStart).toHaveBeenCalledTimes(1);

    await unmount();

    expect(cb.onHoldCancel).toHaveBeenCalledTimes(1);
    expect(cb.onHoldCommit).not.toHaveBeenCalled();
  });

  it("uses the latest onHoldCancel, not the one from the first render", async () => {
    const first = callbacks();
    const latest = callbacks();
    const { rerender, unmount } = await render(
      <VoiceRecordButton isRecording={false} {...first} />,
    );
    await fireEvent(button(), "pressIn");
    await rerender(<VoiceRecordButton isRecording {...latest} />);

    await unmount();

    expect(latest.onHoldCancel).toHaveBeenCalledTimes(1);
    expect(first.onHoldCancel).not.toHaveBeenCalled();
  });

  it("does nothing on unmount when no hold is in progress", async () => {
    const cb = callbacks();
    const { unmount } = await render(
      <VoiceRecordButton isRecording={false} {...cb} />,
    );
    await unmount();
    expect(cb.onHoldCancel).not.toHaveBeenCalled();
  });

  it("doesn't resolve a finished hold twice on unmount", async () => {
    const cb = callbacks();
    const { unmount } = await render(
      <VoiceRecordButton isRecording={false} minHoldMs={0} {...cb} />,
    );
    await fireEvent(button(), "pressIn");
    await fireEvent(button(), "pressOut");
    expect(cb.onHoldCommit).toHaveBeenCalledTimes(1);

    await unmount();

    expect(cb.onHoldCancel).not.toHaveBeenCalled();
  });
});
