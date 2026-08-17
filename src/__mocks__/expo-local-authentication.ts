// Mock for expo-local-authentication — tests must never touch a real
// fingerprint/face sensor.

type MockAuthResult =
  | { success: true }
  | { success: false; error: string; warning?: string };

let hardwareAvailable = true;
let enrolled = true;
let nextAuthResult: MockAuthResult = { success: true };

export const hasHardwareAsync = jest.fn(
  async (): Promise<boolean> => hardwareAvailable,
);
export const isEnrolledAsync = jest.fn(async (): Promise<boolean> => enrolled);
export const authenticateAsync = jest.fn(
  async (_options?: unknown): Promise<MockAuthResult> => nextAuthResult,
);

export function __setHasHardware(value: boolean): void {
  hardwareAvailable = value;
}

export function __setEnrolled(value: boolean): void {
  enrolled = value;
}

export function __setNextAuthResult(result: MockAuthResult): void {
  nextAuthResult = result;
}

export function __resetLocalAuthMock(): void {
  hardwareAvailable = true;
  enrolled = true;
  nextAuthResult = { success: true };
  hasHardwareAsync.mockClear();
  isEnrolledAsync.mockClear();
  authenticateAsync.mockClear();
}
