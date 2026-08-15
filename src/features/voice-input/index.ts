import {
  startRecording,
  transcribeAudio,
  type WhisperContext,
} from "@/shared/stt";

/**
 * A recording in progress, offered to the caller as a decision: keep it
 * (`finish`) or throw it away (`cancel`). Shaped to be driven from
 * `VoiceRecordButton`'s `onHoldStart` / `onHoldCommit` / `onHoldCancel` —
 * but that widget's callbacks are synchronous and take no arguments, while
 * `startVoiceInput` is async and returns a session that must be held in
 * caller state between the hold starting and it later resolving. Wiring the
 * two together is real glue code a route has to write, not something this
 * shape does automatically.
 *
 * Inserting the transcribed text into `ChatInput` is left to whichever route
 * does that wiring — features cannot import widgets, only the other way
 * around — but there is currently no route that does, and it could not
 * safely fake it: unlike `shared/llm`, which has a full model lifecycle
 * (`entities/model`, download, selection, `LlmProvider`), **there is no
 * equivalent for STT models** — no entity, no download flow, no active-model
 * concept, so `startVoiceInput`'s `sttCtx: WhisperContext` parameter cannot
 * currently be obtained anywhere in the app. Wiring a route against a
 * context nothing can ever produce would be dead UI, worse than no UI. See
 * `.claude/loop/BLOCKED.md`.
 */
export type VoiceInputSession = {
  /** Stops recording and discards it. Nothing is transcribed. */
  cancel: () => Promise<void>;
  /** Stops recording and transcribes it. */
  finish: () => Promise<{ text: string }>;
};

/**
 * Begins recording from the microphone for voice input.
 *
 * `sttCtx` must already be loaded (via `initStt`) — this feature only
 * orchestrates record → transcribe, it doesn't own model lifecycle. Nothing
 * in the app currently produces one; see the module doc comment above.
 */
export async function startVoiceInput(
  sttCtx: WhisperContext,
): Promise<VoiceInputSession> {
  const recording = await startRecording();

  return {
    cancel: async () => {
      await recording.stop();
    },
    finish: async () => {
      const { uri } = await recording.stop();
      const transcription = transcribeAudio(sttCtx, uri);
      const result = await transcription.result;
      return { text: result.text };
    },
  };
}
