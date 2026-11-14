// Mock for expo-local-authentication — tests must never touch a real
// fingerprint/face sensor.

type MockAuthResult =
  | { success: true }
  | { success: false; error: string; warning?: string };

// Mirrors expo-local-authentication's SecurityLevel enum.
export enum SecurityLevel {
  NONE = 0,
  SECRET = 1,
  BIOMETRIC_WEAK = 2,
  BIOMETRIC_STRONG = 3,
}

let hardwareAvailable = true;
let enrolled = true;
/** What getEnrolledLevelAsync reports when something is enrolled. */
let enrolledLevel: SecurityLevel = SecurityLevel.BIOMETRIC_STRONG;
let nextAuthResult: MockAuthResult = { success: true };

export const hasHardwareAsync = jest.fn(
  async (): Promise<boolean> => hardwareAvailable,
);
export const isEnrolledAsync = jest.fn(async (): Promise<boolean> => enrolled);
export const getEnrolledLevelAsync = jest.fn(
  async (): Promise<SecurityLevel> =>
    // Nothing enrolled: assume a PIN / pattern is set (the common case).
    enrolled ? enrolledLevel : SecurityLevel.SECRET,
);
export const authenticateAsync = jest.fn(
  async (_options?: unknown): Promise<MockAuthResult> => nextAuthResult,
);

export function __setHasHardware(value: boolean): void {
  hardwareAvailable = value;
}

export function __setEnrolled(value: boolean): void {
  enrolled = value;
}

/** E.g. SecurityLevel.BIOMETRIC_WEAK for an Android phone with only weak face unlock. */
export function __setEnrolledLevel(level: SecurityLevel): void {
  enrolledLevel = level;
}

export function __setNextAuthResult(result: MockAuthResult): void {
  nextAuthResult = result;
}

export function __resetLocalAuthMock(): void {
  hardwareAvailable = true;
  enrolled = true;
  enrolledLevel = SecurityLevel.BIOMETRIC_STRONG;
  nextAuthResult = { success: true };
  hasHardwareAsync.mockClear();
  isEnrolledAsync.mockClear();
  getEnrolledLevelAsync.mockClear();
  authenticateAsync.mockClear();
}
