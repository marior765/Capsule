import {
  startRecording,
  transcribeAudio,
  type WhisperContext,
} from "@/shared/stt";

/**
 * A recording in progress, offered to the caller as a decision: keep it
 * (`finish`) or throw it away (`cancel`).
 *
 * `finish` takes the STT context as its *own* parameter rather than
 * `startVoiceInput` requiring one up front — `startRecording` itself needs
 * no context at all, only transcription does. Requiring it earlier than
 * necessary would gate the actual microphone capture behind however long
 * getting a context takes, which can be arbitrarily long on a first-run
 * model download. See `createVoiceInputController` below for why that
 * distinction matters in practice, not just in principle.
 */
export type VoiceInputSession = {
  /** Stops recording and discards it. Nothing is transcribed. */
  cancel: () => Promise<void>;
  /** Stops recording and transcribes it against the given context. */
  finish: (sttCtx: WhisperContext) => Promise<{ text: string }>;
};

/** Begins recording from the microphone for voice input. */
export async function startVoiceInput(): Promise<VoiceInputSession> {
  const recording = await startRecording();

  return {
    cancel: async () => {
      await recording.stop();
    },
    finish: async (sttCtx: WhisperContext) => {
      const { uri } = await recording.stop();
      const transcription = transcribeAudio(sttCtx, uri);
      const result = await transcription.result;
      return { text: result.text };
    },
  };
}

/**
 * A `VoiceInputSession` that starts itself and never lets context-loading
 * delay recording.
 *
 * `VoiceRecordButton`'s `onHoldStart` / `onHoldCommit` / `onHoldCancel` are
 * synchronous, argument-less callbacks — but getting an `sttCtx` (via
 * `SttProvider`'s `ensureReady()`, which may itself trigger and await a
 * first-time model download, taking anywhere from instant to minutes) is
 * async. An earlier version of this function awaited `getSttContext()`
 * *before* calling `startVoiceInput` — which seemed reasonable, since
 * `startVoiceInput` was the thing that started recording, and it needed a
 * context. It was wrong: it meant the microphone didn't start capturing
 * until the context resolved, so on the exact first-run-download scenario
 * this whole feature exists for, a user could hold the button, speak, and
 * release — and nothing would have been recorded, while the button's
 * `isRecording` state showed "recording" the entire time. `startRecording`
 * needs no context; only `finish` does. Recording and context-acquisition
 * now start **at the same time**, independently — `commit()` is the only
 * place they're ever brought together.
 *
 * This is also still callable *synchronously*, which is the other half of
 * why it exists: `onHoldStart` can't itself be async, so a naive wiring —
 * call `startVoiceInput` from `onHoldStart`, stash the resulting promise,
 * `await` it in `onHoldCommit` — has a race where a fast tap fires
 * `onHoldCommit` while that promise is still pending. `commit`/`cancel`
 * each await whatever's still in flight before acting, so calling `commit()`
 * a millisecond after `createVoiceInputController()` is exactly as correct
 * as calling it a minute later — the ordering is enforced by the promise
 * chains here, not by the caller timing things right.
 */
export type VoiceInputController = {
  cancel: () => Promise<void>;
  commit: () => Promise<{ text: string }>;
};

export function createVoiceInputController(
  getSttContext: () => Promise<WhisperContext>,
): VoiceInputController {
  // Both start immediately, independently — neither waits on the other.
  const session = startVoiceInput();
  const context = getSttContext();
  // `cancel()` deliberately never touches `context` — discarding a
  // recording shouldn't care whether the STT model even loaded. But that
  // means if `context` rejects (a failed download, say) and the caller only
  // ever cancels, nothing else would ever observe that rejection — Node
  // treats an unconsumed rejected promise as unhandled. This silences that
  // specific case without changing what `commit()` sees: attaching a
  // handler here doesn't alter `context`'s own resolution, so the
  // `Promise.all` below still gets the real rejection when commit() runs.
  context.catch(() => {});

  return {
    cancel: async () => {
      const started = await session;
      await started.cancel();
    },
    commit: async () => {
      const [started, ctx] = await Promise.all([session, context]);
      return started.finish(ctx);
    },
  };
}
