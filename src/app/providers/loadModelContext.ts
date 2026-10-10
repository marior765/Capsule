import type { Model } from "@/entities/model";
import type { LlamaContext, MultimodalSupport } from "@/shared/llm";

export type ModelLoadDeps = {
  /** Stored (app-relative or legacy absolute) path → current file:// URI. */
  resolvePath: (stored: string) => string;
  initLlm: (path: string, contextLength: number) => Promise<LlamaContext>;
  initMultimodal: (ctx: LlamaContext, mmprojPath: string) => Promise<boolean>;
  getMultimodalSupport: (ctx: LlamaContext) => Promise<MultimodalSupport>;
};

export type LoadedModel = {
  ctx: LlamaContext;
  /** True only when the projector loaded AND the model reports it can see images. */
  vision: boolean;
};

/**
 * Loads the active model, and for a vision model (8.4) its multimodal
 * projector too. The non-React core of `LlmProvider`'s load step, kept
 * separate so it's testable. A projector that fails to load never fails
 * the whole load: the model is still a perfectly good text model, it just
 * reports `vision: false`. A failure to load the base model propagates.
 */
export async function loadModelContext(
  model: Model,
  contextLength: number,
  deps: ModelLoadDeps,
): Promise<LoadedModel> {
  const ctx = await deps.initLlm(deps.resolvePath(model.path), contextLength);
  if (model.mmprojPath === null) return { ctx, vision: false };

  try {
    const ok = await deps.initMultimodal(
      ctx,
      deps.resolvePath(model.mmprojPath),
    );
    if (!ok) return { ctx, vision: false };
    const support = await deps.getMultimodalSupport(ctx);
    return { ctx, vision: support.vision };
  } catch {
    return { ctx, vision: false };
  }
}
