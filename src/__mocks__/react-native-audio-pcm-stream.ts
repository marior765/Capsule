// Mock for @fugood/react-native-audio-pcm-stream (10.42) — tests must never
// touch a real microphone. Mirrors the native module's JS surface (read from
// its index.js and Android source): `init` returns a promise, `start` and
// `stop` return nothing, and `on("data")` delivers base64 chunks of raw PCM.
// Not modelled automatically: the native side discards its first two buffers
// after start, and emits the buffer it was reading after stop(). Tests that
// care call __emitPcm after stop() themselves.

type DataListener = (base64Chunk: string) => void;

let listener: DataListener | null = null;
let initError: Error | null = null;

export const init = jest.fn(async (_options: Record<string, unknown>) => {
  if (initError) throw initError;
});
export const start = jest.fn(() => {});
export const stop = jest.fn(() => {});
export const removeListener = jest.fn(() => {
  listener = null;
});
export const on = jest.fn((event: string, callback: DataListener) => {
  if (event !== "data") throw new Error("Invalid event");
  listener = callback;
  return { remove: removeListener };
});

/** Delivers raw PCM bytes to the "data" listener, base64-encoded as native does. */
export function __emitPcm(bytes: Uint8Array): void {
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  listener?.(btoa(binary));
}

export function __hasListener(): boolean {
  return listener !== null;
}

export function __setInitError(error: Error | null): void {
  initError = error;
}

export function __resetPcmMock(): void {
  listener = null;
  initError = null;
  [init, start, stop, on, removeListener].forEach((fn) => fn.mockClear());
}

const AudioPcmStream = { init, start, stop, on };
export default AudioPcmStream;
