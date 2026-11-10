// Tests for step 10.53 — written before implementation (TDD)
//
// Found reviewing 10.50: AppLockGate read hasBiometricUnlock() only at
// launch, and the lock screen shown when Capsule relocks after being away
// reused that value. So biometrics set up (or removed) during a session
// weren't reflected on the lock screen until a restart. The gate now
// re-reads it each time it relocks.
import { AppState, Keyboard, Text, type AppStateStatus } from "react-native";
import { render, screen, userEvent, act } from "@testing-library/react-native";
import { LockScreen } from "@/widgets/LockScreen";
import { AppLockGate } from "../AppLockGate";

let mockBiometricOn = true;
const mockHasBiometricUnlock = jest.fn(async () => mockBiometricOn);

jest.mock("@/features/encrypt-vault", () => ({
  hasBiometricUnlock: () => mockHasBiometricUnlock(),
  unlockVault: async () => "key",
  unlockVaultWithBiometrics: async () => "key",
}));
jest.mock("@/features/app-lock", () => ({
  getLockAfter: () => "immediately",
  shouldRelock: () => true,
}));
jest.mock("../launchDatabase", () => ({
  openAtLaunch: async () => ({ kind: "locked" }),
  openUnlocked: () => {},
}));
jest.mock("../eraseEverything", () => ({ eraseEverything: async () => {} }));

let appStateListeners: ((state: AppStateStatus) => void)[] = [];
const emitAppState = (state: AppStateStatus) =>
  appStateListeners.forEach((listener) => listener(state));

beforeEach(() => {
  mockBiometricOn = true;
  mockHasBiometricUnlock.mockClear();
  appStateListeners = [];
  // Not implemented in the test environment; the gate calls it on relock.
  jest.spyOn(Keyboard, "dismiss").mockImplementation(() => {});
  jest.spyOn(AppState, "addEventListener").mockImplementation((_, listener) => {
    appStateListeners.push(listener as (state: AppStateStatus) => void);
    return { remove: () => {} } as ReturnType<typeof AppState.addEventListener>;
  });
});
afterEach(() => jest.restoreAllMocks());

const { inputs, buttons } = LockScreen.testIDs;

/** Launches locked and unlocks with the passphrase. */
async function launchAndUnlock() {
  const user = userEvent.setup();
  await render(
    <AppLockGate>
      <Text>the app</Text>
    </AppLockGate>,
  );
  await user.type(await screen.findByTestId(inputs.passphrase), "pass");
  await user.press(screen.getByTestId(buttons.unlock));
  await screen.findByText("the app");
}

/** Leaves the app and comes back, which relocks it. */
async function awayAndBack() {
  await act(async () => {
    emitAppState("background");
    emitAppState("active");
  });
  await screen.findByTestId(AppLockGate.testIDs.containers.relock);
}

describe("AppLockGate relock refreshes biometrics (10.53)", () => {
  it("offers biometrics on relock once they were set up during the session", async () => {
    mockBiometricOn = false;
    await launchAndUnlock();
    expect(screen.queryByTestId(buttons.biometrics)).toBeNull();

    mockBiometricOn = true; // set up on the Privacy screen meanwhile
    await awayAndBack();

    expect(await screen.findByTestId(buttons.biometrics)).toBeOnTheScreen();
  });

  it("stops offering biometrics on relock once they're no longer set up", async () => {
    await launchAndUnlock();

    mockBiometricOn = false; // e.g. a cancelled re-setup removed them
    await awayAndBack();

    await act(async () => {});
    expect(screen.queryByTestId(buttons.biometrics)).toBeNull();
  });

  it("covers the app at once, without waiting for the check", async () => {
    await launchAndUnlock();
    let finish: (value: boolean) => void = () => {};
    mockHasBiometricUnlock.mockImplementationOnce(
      () =>
        new Promise<boolean>((resolve) => {
          finish = resolve;
        }),
    );

    // The check stays pending inside this act: the cover must not wait for it.
    await act(async () => {
      emitAppState("background");
      emitAppState("active");
    });
    expect(
      screen.getByTestId(AppLockGate.testIDs.containers.relock),
    ).toBeOnTheScreen();
    await act(async () => finish(true));
  });

  it("treats a failed check as biometrics off (the passphrase always works)", async () => {
    await launchAndUnlock();
    mockHasBiometricUnlock.mockRejectedValueOnce(new Error("keychain busy"));

    await awayAndBack();

    await act(async () => {});
    expect(screen.queryByTestId(buttons.biometrics)).toBeNull();
    expect(screen.getByTestId(inputs.passphrase)).toBeOnTheScreen();
  });

  it("an older, slower check can't overwrite a newer one", async () => {
    await launchAndUnlock();
    let finishFirst: (value: boolean) => void = () => {};
    mockHasBiometricUnlock.mockImplementationOnce(
      () =>
        new Promise<boolean>((resolve) => {
          finishFirst = resolve;
        }),
    );
    // First relock: its check hangs. Unlock, then relock again: off now.
    await awayAndBack();
    const user = userEvent.setup();
    await user.type(screen.getByTestId(inputs.passphrase), "pass");
    await user.press(screen.getByTestId(buttons.unlock));
    mockBiometricOn = false;
    await awayAndBack();
    await act(async () => {});
    expect(screen.queryByTestId(buttons.biometrics)).toBeNull();

    // The first, stale check finally answers "on": ignored.
    await act(async () => finishFirst(true));
    expect(screen.queryByTestId(buttons.biometrics)).toBeNull();
  });
});
