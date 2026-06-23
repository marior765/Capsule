import {
  createContext,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from "react";
import { getActiveModel, type Model } from "@/entities/model";
import { openDb } from "@/shared/db";
import { initLlm, releaseLlm, type LlamaContext } from "@/shared/llm";

export type LlmStatus = "no-model" | "loading" | "ready" | "error";

type LlmState = {
  ctx: LlamaContext | null;
  status: LlmStatus;
  activeModel: Model | null;
  /** Re-read the active model and (re)load it into memory. */
  reload: () => void;
};

const LlmContext = createContext<LlmState | null>(null);

export function LlmProvider({ children }: PropsWithChildren) {
  const [ctx, setCtx] = useState<LlamaContext | null>(null);
  const [status, setStatus] = useState<LlmStatus>("no-model");
  const [activeModel, setActiveModel] = useState<Model | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let loaded: LlamaContext | null = null;

    const load = async () => {
      const model = getActiveModel(openDb());
      setActiveModel(model);

      if (!model) {
        setStatus("no-model");
        setCtx(null);
        return;
      }

      setStatus("loading");
      try {
        loaded = await initLlm(model.path);
        if (cancelled) {
          await releaseLlm(loaded);
          return;
        }
        setCtx(loaded);
        setStatus("ready");
      } catch {
        if (!cancelled) {
          setCtx(null);
          setStatus("error");
        }
      }
    };

    load();

    return () => {
      cancelled = true;
      if (loaded) releaseLlm(loaded);
    };
  }, [reloadKey]);

  const value: LlmState = {
    ctx,
    status,
    activeModel,
    reload: () => setReloadKey((k) => k + 1),
  };

  return <LlmContext.Provider value={value}>{children}</LlmContext.Provider>;
}

export function useLlm(): LlmState {
  const value = useContext(LlmContext);
  if (!value) {
    throw new Error("useLlm must be used within an LlmProvider");
  }
  return value;
}
