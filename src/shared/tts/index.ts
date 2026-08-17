import { speak as _speak, stop, isSpeakingAsync } from "expo-speech";

/**
 * Wrapper-level speak options. expo-speech's own options are already
 * camelCase, so these pass through by name — but they are re-declared
 * rather than re-exported so features never import an expo-speech type
 * directly, matching `shared/llm`/`shared/stt`'s conventions.
 */
export type SpeakOptions = {
  language?: string;
  pitch?: number;
  rate?: number;
  volume?: number;
};

/**
 * Speaks text aloud via the OS-level Speech API (baseline TTS — see
 * CLAUDE.md's phased roadmap; a local neural TTS may replace this later
 * without changing this module's public shape).
 *
 * expo-speech's own `speak()` is fire-and-forget with callback-style
 * completion (`onDone`/`onStopped`/`onError`), not promise-based — this
 * wraps it in a promise to match the async style of every other `shared/`
 * wrapper. Resolves on either a normal finish or an explicit stop (the
 * caller asked for that; it isn't a failure) and rejects only on a real
 * synthesis error.
 */
export function speak(text: string, options: SpeakOptions = {}): Promise<void> {
  if (!text.trim()) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve, reject) => {
    // Only forward keys the caller actually set — matches transcribeAudio's
    // and startRecording's convention of not sending explicit `undefined`s.
    const forwarded: SpeakOptions = {};
    if (options.language !== undefined) forwarded.language = options.language;
    if (options.pitch !== undefined) forwarded.pitch = options.pitch;
    if (options.rate !== undefined) forwarded.rate = options.rate;
    if (options.volume !== undefined) forwarded.volume = options.volume;

    _speak(text, {
      ...forwarded,
      onDone: () => resolve(),
      onStopped: () => resolve(),
      onError: (error) => reject(error),
    });
  });
}

/** Stops any speech currently in progress. */
export async function stopSpeaking(): Promise<void> {
  await stop();
}

/** Whether the OS is currently speaking an utterance from this app. */
export async function isSpeaking(): Promise<boolean> {
  return isSpeakingAsync();
}
