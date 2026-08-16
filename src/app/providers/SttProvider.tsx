import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import {
  ensureSttModelDownloaded,
  getSttModelPath,
} from "@/features/manage-stt-model";
import { openDb } from "@/shared/db";
import { initStt, releaseStt, type WhisperContext } from "@/shared/stt";

export type SttStatus = "idle" | "downloading" | "loading" | "ready" | "error";

type SttState = {
  ctx: WhisperContext | null;
  status: SttStatus;
  /** 0–1. Only meaningful while `status === "downloading"`. */
  downloadProgress: number;
  /**
   * Downloads the model (first use only) and loads it, returning the ready
   * context. Idempotent and safe to call on every voice-input attempt — a
   * second call while already ready (or already in flight) returns the same
   * promise/context rather than starting over.
   *
   * Deliberately **not** run automatically on mount, unlike `LlmProvider`
   * loading the user's already-downloaded LLM model: the first call to this
   * function may itself trigger a network download, and CLAUDE.md requires
   * model downloads to be user-initiated. Only calling this from an actual
   * voice-input attempt (a real press of `VoiceRecordButton`) satisfies that
   * — mounting this provider must not.
   */
  ensureReady: () => Promise<WhisperContext>;
};

const SttContext = createContext<SttState | null>(null);

export function SttProvider({ children }: PropsWithChildren) {
  const [ctx, setCtx] = useState<WhisperContext | null>(null);
  const [status, setStatus] = useState<SttStatus>("idle");
  const [downloadProgress, setDownloadProgress] = useState(0);

  // Holds the in-flight load so concurrent callers (e.g. a fast double-tap)
  // share one download/init rather than racing two.
  const pending = useRef<Promise<WhisperContext> | null>(null);
  // Mirrors `ctx` for synchronous reads inside `ensureReady` — state updates
  // from the previous call aren't visible yet inside the same closure.
  const ctxRef = useRef<WhisperContext | null>(null);

  // Set once on unmount; checked after an in-flight load resolves so a
  // context that arrives *after* unmount still gets released rather than
  // leaking — the actual gap `LlmProvider` closes with its own `cancelled`
  // closure variable (LlmProvider.tsx), which this mirrors precisely rather
  // than only in the already-loaded case.
  const cancelled = useRef(false);

  const ensureReady = useCallback(async (): Promise<WhisperContext> => {
    if (ctxRef.current) {
      return ctxRef.current;
    }
    if (pending.current) {
      return pending.current;
    }

    const load = (async () => {
      try {
        const db = openDb();
        setDownloadProgress(0);
        setStatus(getSttModelPath() ? "loading" : "downloading");

        const path = await ensureSttModelDownloaded(db, (fraction) => {
          setDownloadProgress(fraction);
        });

        setStatus("loading");
        const loaded = await initStt(path);

        if (cancelled.current) {
          await releaseStt(loaded);
          throw new Error(
            "SttProvider unmounted before the model finished loading",
          );
        }

        ctxRef.current = loaded;
        setCtx(loaded);
        setStatus("ready");
        return loaded;
      } catch (error) {
        setStatus("error");
        throw error;
      } finally {
        pending.current = null;
      }
    })();

    pending.current = load;
    return load;
  }, []);

  // Release the native whisper context on unmount — mirrors LlmProvider's
  // own cleanup for the LLM context, including the case a load was still in
  // flight: `cancelled` is checked once it resolves, above, so the context
  // gets released even though it arrives after this effect already ran.
  useEffect(() => {
    return () => {
      cancelled.current = true;
      if (ctxRef.current) {
        releaseStt(ctxRef.current);
      }
    };
  }, []);

  const value: SttState = { ctx, status, downloadProgress, ensureReady };

  return <SttContext.Provider value={value}>{children}</SttContext.Provider>;
}

export function useStt(): SttState {
  const value = useContext(SttContext);
  if (!value) {
    throw new Error("useStt must be used within an SttProvider");
  }
  return value;
}
