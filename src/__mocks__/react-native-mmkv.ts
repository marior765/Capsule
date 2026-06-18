import { createMockMMKV } from "react-native-mmkv/lib/createMMKV/createMockMMKV";

export { createMockMMKV };

export const createMMKV = jest
  .fn()
  .mockImplementation((config?: { id?: string }) =>
    createMockMMKV({ id: config?.id ?? "mmkv.default" })
  );
