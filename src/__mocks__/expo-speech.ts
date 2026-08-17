// Mock for expo-speech — tests must never invoke real OS speech synthesis.

type MockSpeakOptions = {
  language?: string;
  pitch?: number;
  rate?: number;
  volume?: number;
  onStart?: () => void;
  onStopped?: () => void;
  onDone?: () => void;
  onError?: (error: Error) => void;
};

type Outcome = "done" | "stopped" | { error: Error };

let nextOutcome: Outcome = "done";

export function __setNextOutcome(outcome: Outcome): void {
  nextOutcome = outcome;
}

// Invokes its completion callback synchronously — real expo-speech is async,
// but nothing in shared/tts depends on callback timing, only on which
// callback fires and with what arguments.
export const speak = jest.fn(
  (_text: string, options: MockSpeakOptions = {}) => {
    options.onStart?.();
    if (nextOutcome === "done") {
      options.onDone?.();
    } else if (nextOutcome === "stopped") {
      options.onStopped?.();
    } else {
      options.onError?.(nextOutcome.error);
    }
  },
);

export const stop = jest.fn(async (): Promise<void> => {});
export const isSpeakingAsync = jest.fn(async (): Promise<boolean> => false);

export function __resetSpeechMock(): void {
  speak.mockClear();
  stop.mockClear();
  isSpeakingAsync.mockClear();
  nextOutcome = "done";
}
