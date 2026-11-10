// Tests for step 10.50 — written before implementation (TDD)
//
// With app lock on, the Privacy screen offers to set up Face ID /
// fingerprint again (after the OS invalidated it) or for the first time,
// using the passphrase. The vault logic itself is tested in
// features/encrypt-vault; this checks the screen wires it up and says what
// happened in plain words.
import { render, screen, userEvent } from "@testing-library/react-native";
import { AppLockSettings } from "../AppLockSettings";

const mockSetUp = jest.fn<Promise<void>, [string]>();
let mockBiometricOn = true;
let mockBiometricAvailable = true;

jest.mock("@/features/encrypt-vault", () => {
  const actual = jest.requireActual<typeof import("@/features/encrypt-vault")>(
    "@/features/encrypt-vault",
  );
  return {
    ...actual,
    isVaultConfigured: async () => true,
    hasBiometricUnlock: async () => mockBiometricOn,
    setUpBiometricUnlock: (passphrase: string) => mockSetUp(passphrase),
  };
});
jest.mock("@/features/app-lock", () => {
  const actual = jest.requireActual<typeof import("@/features/app-lock")>(
    "@/features/app-lock",
  );
  return {
    ...actual,
    isBiometricAvailable: async () => mockBiometricAvailable,
  };
});

const { buttons, inputs, texts } = AppLockSettings.testIDs;

beforeEach(() => {
  mockSetUp.mockReset();
  mockSetUp.mockResolvedValue(undefined);
  mockBiometricOn = true;
  mockBiometricAvailable = true;
});

async function renderOn() {
  await render(<AppLockSettings onChanged={jest.fn()} />);
  await screen.findByTestId(buttons.setUpBiometrics);
}

describe("AppLockSettings — set up Face ID / fingerprint (10.50)", () => {
  it("sets it up again with the passphrase and says so", async () => {
    const user = userEvent.setup();
    await renderOn();
    expect(
      screen.getByText("Set up Face ID / fingerprint again"),
    ).toBeOnTheScreen();

    await user.type(screen.getByTestId(inputs.currentPassphrase), "secret");
    await user.press(screen.getByTestId(buttons.setUpBiometrics));

    expect(mockSetUp).toHaveBeenCalledWith("secret");
    expect(await screen.findByTestId(texts.notice)).toHaveTextContent(
      "Face ID / fingerprint unlock is set up.",
    );
    expect(screen.getByTestId(inputs.currentPassphrase)).toHaveDisplayValue("");
  });

  it("offers a first-time setup when the lock was turned on without it", async () => {
    mockBiometricOn = false;
    await renderOn();
    expect(screen.getByText("Set up Face ID / fingerprint")).toBeOnTheScreen();
  });

  it("asks for the passphrase first", async () => {
    const user = userEvent.setup();
    await renderOn();
    await user.press(screen.getByTestId(buttons.setUpBiometrics));

    expect(mockSetUp).not.toHaveBeenCalled();
    expect(screen.getByTestId(texts.error)).toHaveTextContent(
      "Enter your passphrase to set up Face ID / fingerprint.",
    );
  });

  it("says when the passphrase is wrong", async () => {
    const user = userEvent.setup();
    const { VaultUnlockError } = jest.requireActual<
      typeof import("@/features/encrypt-vault")
    >("@/features/encrypt-vault");
    mockSetUp.mockRejectedValue(new VaultUnlockError());
    await renderOn();
    await user.type(screen.getByTestId(inputs.currentPassphrase), "nope");
    await user.press(screen.getByTestId(buttons.setUpBiometrics));

    expect(await screen.findByTestId(texts.error)).toHaveTextContent(
      "That passphrase didn't work.",
    );
  });

  it("says when the OS didn't set it up, and that the passphrase still works", async () => {
    const user = userEvent.setup();
    const { BiometricSetupError } = jest.requireActual<
      typeof import("@/features/encrypt-vault")
    >("@/features/encrypt-vault");
    mockSetUp.mockRejectedValue(new BiometricSetupError());
    await renderOn();
    await user.type(screen.getByTestId(inputs.currentPassphrase), "secret");
    await user.press(screen.getByTestId(buttons.setUpBiometrics));

    expect(await screen.findByTestId(texts.error)).toHaveTextContent(
      "Face ID / fingerprint wasn't set up. Your passphrase still unlocks Capsule.",
    ); // Biometric unlock is now off, so the button offers a first-time setup.
    expect(screen.getByText("Set up Face ID / fingerprint")).toBeOnTheScreen();
  });

  // Reviewer findings (10.50): the turn-off button mustn't claim to be
  // turning off while biometrics are being set up, and an old notice
  // mustn't linger next to a later error.
  it("shows which action is running", async () => {
    const user = userEvent.setup();
    let finish: () => void = () => {};
    mockSetUp.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    await renderOn();
    await user.type(screen.getByTestId(inputs.currentPassphrase), "secret");
    await user.press(screen.getByTestId(buttons.setUpBiometrics));

    expect(screen.queryByText("Turning off…")).toBeNull();
    expect(screen.getByText("Setting up…")).toBeOnTheScreen();
    expect(screen.getByTestId(buttons.turnOff)).toBeDisabled();
    finish();
    expect(await screen.findByTestId(texts.notice)).toBeOnTheScreen();
  });

  it("clears the 'set up' notice when another action reports an error", async () => {
    const user = userEvent.setup();
    await renderOn();
    await user.type(screen.getByTestId(inputs.currentPassphrase), "secret");
    await user.press(screen.getByTestId(buttons.setUpBiometrics));
    await screen.findByTestId(texts.notice);

    // Turn off with an empty passphrase field: an error, and no stale notice.
    await user.press(screen.getByTestId(buttons.turnOff));
    expect(screen.getByTestId(texts.error)).toBeOnTheScreen();
    expect(screen.queryByTestId(texts.notice)).toBeNull();
  });

  it("isn't offered on a device without Face ID / fingerprint", async () => {
    mockBiometricAvailable = false;
    await render(<AppLockSettings onChanged={jest.fn()} />);
    await screen.findByTestId(buttons.turnOff);
    expect(screen.queryByTestId(buttons.setUpBiometrics)).toBeNull();
  });
});
