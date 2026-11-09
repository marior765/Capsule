// Tests for step 10.51 — written before implementation (TDD)
//
// Turning app lock on restarts the app. If biometrics were asked for but
// weren't set up (the Android fingerprint prompt was cancelled), the screen
// says so first, and only restarts once the user has read it.
import { Alert } from "react-native";
import {
  fireEvent,
  render,
  screen,
  userEvent,
} from "@testing-library/react-native";
import { AppLockSettings } from "../AppLockSettings";

const mockTurnOn = jest.fn<
  Promise<{ biometricsSetUp: boolean }>,
  [string, { biometrics: boolean }]
>();

jest.mock("@/features/encrypt-vault", () => {
  const actual = jest.requireActual<typeof import("@/features/encrypt-vault")>(
    "@/features/encrypt-vault",
  );
  return {
    ...actual,
    isVaultConfigured: async () => false,
    hasBiometricUnlock: async () => false,
    turnOnAppLock: (p: string, o: { biometrics: boolean }) => mockTurnOn(p, o),
  };
});
jest.mock("@/features/app-lock", () => {
  const actual = jest.requireActual<typeof import("@/features/app-lock")>(
    "@/features/app-lock",
  );
  return { ...actual, isBiometricAvailable: async () => true };
});

const { buttons, inputs } = AppLockSettings.testIDs;

async function turnOn(onChanged: () => void) {
  const user = userEvent.setup();
  await render(<AppLockSettings onChanged={onChanged} />);
  await screen.findByTestId(inputs.biometrics);
  await user.type(screen.getByTestId(inputs.passphrase), "secret");
  await user.type(screen.getByTestId(inputs.confirmation), "secret");
  await user.press(screen.getByTestId(buttons.turnOn));
}

let alert: jest.SpyInstance;
beforeEach(() => {
  mockTurnOn.mockReset();
  alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
});
afterEach(() => alert.mockRestore());

describe("AppLockSettings — turning on with biometrics (10.51)", () => {
  it("restarts straight away when biometrics were set up", async () => {
    mockTurnOn.mockResolvedValue({ biometricsSetUp: true });
    const onChanged = jest.fn();
    await turnOn(onChanged);

    expect(mockTurnOn).toHaveBeenCalledWith("secret", { biometrics: true });
    expect(onChanged).toHaveBeenCalledTimes(1);
    expect(alert).not.toHaveBeenCalled();
  });

  it("says biometrics weren't set up, and restarts only after OK", async () => {
    mockTurnOn.mockResolvedValue({ biometricsSetUp: false });
    const onChanged = jest.fn();
    await turnOn(onChanged);

    expect(onChanged).not.toHaveBeenCalled();
    expect(alert).toHaveBeenCalledTimes(1);
    const [title, message, buttonsArg] = alert.mock.calls[0] as [
      string,
      string,
      { text: string; onPress?: () => void }[],
    ];
    expect(title).toBe("App lock is on");
    expect(message).toMatch(/Face ID \/ fingerprint wasn't set up/);
    expect(message).toMatch(/passphrase/);
    // Not dismissable: the restart must happen.
    expect(alert.mock.calls[0][3]).toEqual({ cancelable: false });
    buttonsArg[0].onPress?.();
    expect(onChanged).toHaveBeenCalledTimes(1);
  });

  // Reviewer finding (10.51): turnOnAppLock also reports "not set up" when
  // biometrics weren't asked for; that must not trigger the alert.
  it("says nothing when biometrics were turned off on purpose", async () => {
    mockTurnOn.mockResolvedValue({ biometricsSetUp: false });
    const onChanged = jest.fn();
    const user = userEvent.setup();
    await render(<AppLockSettings onChanged={onChanged} />);
    await screen.findByTestId(inputs.biometrics);
    await fireEvent(
      screen.getByTestId(inputs.biometrics),
      "valueChange",
      false,
    );
    await user.type(screen.getByTestId(inputs.passphrase), "secret");
    await user.type(screen.getByTestId(inputs.confirmation), "secret");
    await user.press(screen.getByTestId(buttons.turnOn));

    expect(mockTurnOn).toHaveBeenCalledWith("secret", { biometrics: false });
    expect(alert).not.toHaveBeenCalled();
    expect(onChanged).toHaveBeenCalledTimes(1);
  });
});
