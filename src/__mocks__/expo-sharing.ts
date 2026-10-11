// Mock for expo-sharing — tests never open a real share sheet.
export const __shareState = { available: true };

export const isAvailableAsync = jest.fn(async () => __shareState.available);

export const shareAsync = jest.fn(
  async (
    _url: string,
    _options?: { mimeType?: string; dialogTitle?: string; UTI?: string },
  ) => {},
);

export function __resetSharingMock(): void {
  __shareState.available = true;
  isAvailableAsync.mockClear();
  shareAsync.mockClear();
}
