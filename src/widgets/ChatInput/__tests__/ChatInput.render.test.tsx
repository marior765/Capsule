// Tests for step 10.38 — written before implementation (TDD)
//
// The first real render test in the repo. Until now no widget could be
// rendered in Jest: importing one pulled in react-native-unistyles, which
// needs its native module, and no render library was installed. These
// tests render ChatInput itself and drive it the way a person would
// (userEvent: type, press), so they prove behaviour of our component, not
// of a mock. RNTL 14's render and userEvent APIs are async.
import { render, screen, userEvent } from "@testing-library/react-native";
import { Colors } from "@/shared/ui/theme";
import { ChatInput } from "../ChatInput";

const { inputs, buttons, containers } = ChatInput.testIDs;

describe("ChatInput (rendered, 10.38)", () => {
  it("sends the trimmed text and clears the field", async () => {
    const user = userEvent.setup();
    const onSend = jest.fn();
    await render(<ChatInput onSend={onSend} />);

    await user.type(screen.getByTestId(inputs.message), "  hello  ");
    await user.press(screen.getByTestId(buttons.send));

    expect(onSend).toHaveBeenCalledTimes(1);
    expect(onSend).toHaveBeenCalledWith("hello");
    expect(screen.getByTestId(inputs.message)).toHaveDisplayValue("");
  });

  it("does nothing on Send while the field is empty or only spaces", async () => {
    const user = userEvent.setup();
    const onSend = jest.fn();
    await render(<ChatInput onSend={onSend} />);

    await user.press(screen.getByTestId(buttons.send));
    await user.type(screen.getByTestId(inputs.message), "   ");
    await user.press(screen.getByTestId(buttons.send));

    expect(onSend).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
    // …and looks disabled, not just behaves so.
    expect(screen.getByTestId(buttons.send)).toHaveStyle({ opacity: 0.4 });
  });

  it("locks the field and Send while disabled", async () => {
    const user = userEvent.setup();
    const onSend = jest.fn();
    await render(<ChatInput onSend={onSend} disabled initialText="draft" />);

    await user.type(screen.getByTestId(inputs.message), " more");
    await user.press(screen.getByTestId(buttons.send));

    expect(screen.getByTestId(inputs.message)).toHaveDisplayValue("draft");
    expect(screen.getByTestId(buttons.send)).toBeDisabled();
    expect(onSend).not.toHaveBeenCalled();
  });

  it("seeds the field from initialText and uses a custom Send label", async () => {
    await render(
      <ChatInput onSend={jest.fn()} initialText="edit me" sendLabel="Save" />,
    );

    expect(screen.getByTestId(inputs.message)).toHaveDisplayValue("edit me");
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
    expect(screen.getByText("Save")).toBeOnTheScreen();
    expect(screen.getByTestId(buttons.send)).not.toHaveStyle({ opacity: 0.4 });
  });

  // The unistyles mock resolves themed styles against the themes the app
  // registers (src/__mocks__/unistyles.setup.ts), so render tests see the
  // real light-theme tokens.
  it("renders with the app's light-theme styles", async () => {
    await render(<ChatInput onSend={jest.fn()} />);

    expect(screen.getByTestId(containers.root)).toHaveStyle({
      backgroundColor: Colors.light.background,
    });
  });
});
