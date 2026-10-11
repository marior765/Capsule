// Mock for expo-secure-store — tests must never touch a real Keychain/
// Keystore. Backed by a plain in-memory Map so async and sync accessors
// (both real APIs) stay consistent with each other within a test.

const store = new Map<string, string>();

// `options` (e.g. `requireAuthentication`) is accepted like the real API
// and recorded on the spy; the mock never prompts.
export const getItemAsync = jest.fn(
  async (key: string, _options?: unknown): Promise<string | null> => {
    return store.get(key) ?? null;
  },
);

export const setItemAsync = jest.fn(
  async (key: string, value: string, _options?: unknown): Promise<void> => {
    store.set(key, value);
  },
);

export const deleteItemAsync = jest.fn(
  async (key: string, _options?: unknown): Promise<void> => {
    store.delete(key);
  },
);

export const getItem = jest.fn((key: string): string | null => {
  return store.get(key) ?? null;
});

export const setItem = jest.fn((key: string, value: string): void => {
  store.set(key, value);
});

export const isAvailableAsync = jest.fn(async (): Promise<boolean> => true);

export function __resetSecureStoreMock(): void {
  store.clear();
  getItemAsync.mockClear();
  setItemAsync.mockClear();
  deleteItemAsync.mockClear();
  getItem.mockClear();
  setItem.mockClear();
  isAvailableAsync.mockClear();
}
