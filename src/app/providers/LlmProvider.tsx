import {
  createContext,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from "react";
import { getActiveModel, getAllModels, type Model } from "@/entities/model";
import { getInferenceSettings } from "@/features/configure-inference";
import { resolveModelPath } from "@/features/manage-models";
import { openDb } from "@/shared/db";
import {
  getMultimodalSupport,
  initLlm,
  initMultimodalSupport,
  releaseLlm,
  type LlamaContext,
} from "@/shared/llm";
import { loadModelContext } from "./loadModelContext";

/**
 * `no-model` = nothing downloaded. `no-active-model` = models exist but none is
 * selected — a genuinely different problem, and telling the user to "download a
 * model" when they already have one is worse than saying nothing.
 */
export type LlmStatus =
  | "no-model"
  | "no-active-model"
  | "loading"
  | "ready"
  | "error";

type LlmState = {
  ctx: LlamaContext | null;
  status: LlmStatus;
  activeModel: Model | null;
  /**
   * True when the loaded model can take images (a vision model whose
   * projector loaded and reports vision support — 8.4).
   */
  vision: boolean;
  /** Re-read the active model and (re)load it into memory. */
  reload: () => void;
};

const LlmContext = createContext<LlmState | null>(null);

export function LlmProvider({ children }: PropsWithChildren) {
  const [ctx, setCtx] = useState<LlamaContext | null>(null);
  const [status, setStatus] = useState<LlmStatus>("no-model");
  const [activeModel, setActiveModel] = useState<Model | null>(null);
  const [vision, setVision] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let loaded: LlamaContext | null = null;

    const load = async () => {
      const db = openDb();
      const model = getActiveModel(db);
      setActiveModel(model);

      if (!model) {
        setStatus(getAllModels(db).length > 0 ? "no-active-model" : "no-model");
        setCtx(null);
        setVision(false);
        return;
      }

      setStatus("loading");
      try {
        // Context length is fixed at load time, so it is read here rather than
        // per completion — `reload` is what applies a change to it.
        const result = await loadModelContext(
          model,
          getInferenceSettings().contextLength,
          {
            resolvePath: resolveModelPath,
            initLlm,
            initMultimodal: initMultimodalSupport,
            getMultimodalSupport,
          },
        );
        loaded = result.ctx;
        if (cancelled) {
          await releaseLlm(loaded);
          return;
        }
        setCtx(loaded);
        setVision(result.vision);
        setStatus("ready");
      } catch {
        if (!cancelled) {
          setCtx(null);
          setVision(false);
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
    vision,
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
