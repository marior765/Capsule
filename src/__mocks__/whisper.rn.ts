// Mock for whisper.rn — tests must never load a real GGML model or touch native
// code.
//
// Hand-written rather than using the shipped `whisper.rn/jest-mock`: that
// subpath does match the package's `"./*"` exports pattern, but its targets are
// extensionless (`"./lib/commonjs/*"`), so resolution fails with
// MODULE_NOT_FOUND anyway. Separately, the package declares no "." entry at all,
// which is why the bare `whisper.rn` specifier needs the jest moduleNameMapper
// entry (and the tsconfig `paths` entry) that point here and at the real .d.ts.
//
// Assertions belong on *what the wrapper passed in*, never on the canned values
// handed back here — those prove nothing about our code.

export type TranscribeResult = {
  result: string;
  language: string;
  segments: { text: string; t0: number; t1: number }[];
  isAborted: boolean;
};

export type ContextOptions = {
  filePath: string | number;
  isBundleAsset?: boolean;
  useCoreMLIos?: boolean;
  useGpu?: boolean;
  useFlashAttn?: boolean;
};

export class WhisperContext {
  ptr = 1;
  id = 1;
  gpu = false;
  reasonNoGPU = "Mock context";

  transcribe = jest.fn(
    (
      _filePathOrBase64: string | number,
      _options: Record<string, unknown> = {},
    ): { stop: () => Promise<void>; promise: Promise<TranscribeResult> } => ({
      stop: jest.fn(async (): Promise<void> => {}),
      promise: Promise.resolve({
        result: " Test",
        language: "en",
        segments: [{ text: " Test", t0: 0, t1: 33 }],
        isAborted: false,
      }),
    }),
  );

  release = jest.fn(async (): Promise<void> => {});
}

export const initWhisper = jest.fn(
  async (_options: ContextOptions): Promise<WhisperContext> =>
    new WhisperContext(),
);

export const releaseAllWhisper = jest.fn(async (): Promise<void> => {});

export function __resetWhisperMock(): void {
  initWhisper.mockClear();
  releaseAllWhisper.mockClear();
}
