/**
 * Types for @fugood/react-native-audio-pcm-stream (10.42). The package's own
 * index.d.ts declares a different module name ("react-native-live-audio-stream",
 * the project it was forked from) and gets the return types wrong, so this
 * declares the surface shared/stt calls, as read from the package's index.js
 * and its Android module: `init` returns a promise, `start` and `stop` return
 * nothing, and `on("data")` delivers base64-encoded raw PCM chunks and returns
 * a subscription.
 */
declare module "@fugood/react-native-audio-pcm-stream" {
  export type AudioPcmStreamOptions = {
    sampleRate: number;
    /** 1 (mono) or 2 (stereo). */
    channels: number;
    /** 8 or 16. */
    bitsPerSample: number;
    /** Android MediaRecorder.AudioSource; 6 = VOICE_RECOGNITION. */
    audioSource?: number;
    bufferSize?: number;
  };

  export type AudioPcmStreamSubscription = { remove: () => void };

  const AudioPcmStream: {
    init: (options: AudioPcmStreamOptions) => Promise<void>;
    start: () => void;
    stop: () => void;
    on: (
      event: "data",
      callback: (base64Chunk: string) => void,
    ) => AudioPcmStreamSubscription;
  };

  export default AudioPcmStream;
}
