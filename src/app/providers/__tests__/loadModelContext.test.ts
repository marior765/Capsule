// Tests for 8.4 (load a model, plus its vision projector when it has one) — written before implementation (TDD)
import type { LlamaContext } from "@/shared/llm";
import type { Model } from "@/entities/model";
import { loadModelContext, type ModelLoadDeps } from "../loadModelContext";

const ctx = { id: "ctx" } as unknown as LlamaContext;

const model = (overrides: Partial<Model> = {}): Model => ({
  id: "m1",
  name: "M",
  path: "models/m.gguf",
  size: 1,
  parameters: "1B",
  quantization: "Q4_K_M",
  isActive: true,
  downloadedAt: 1,
  mmprojPath: null,
  ...overrides,
});

function deps(overrides: Partial<ModelLoadDeps> = {}): ModelLoadDeps {
  return {
    resolvePath: (p) => `file:///document/${p}`,
    initLlm: jest.fn(async () => ctx),
    initMultimodal: jest.fn(async () => true),
    getMultimodalSupport: jest.fn(async () => ({ vision: true, audio: false })),
    ...overrides,
  };
}

describe("loadModelContext", () => {
  it("loads a plain chat model without touching multimodal support", async () => {
    const d = deps();
    const result = await loadModelContext(model(), 4096, d);
    expect(d.initLlm).toHaveBeenCalledWith(
      "file:///document/models/m.gguf",
      4096,
    );
    expect(d.initMultimodal).not.toHaveBeenCalled();
    expect(result).toEqual({ ctx, vision: false });
  });

  it("loads a vision model's projector from its resolved path and reports vision", async () => {
    const d = deps();
    const result = await loadModelContext(
      model({ mmprojPath: "models/mmproj.gguf" }),
      4096,
      d,
    );
    expect(d.initMultimodal).toHaveBeenCalledWith(
      ctx,
      "file:///document/models/mmproj.gguf",
    );
    expect(result).toEqual({ ctx, vision: true });
  });

  it("reports no vision when the projector loads but the model says it can't see", async () => {
    const d = deps({
      getMultimodalSupport: jest.fn(async () => ({
        vision: false,
        audio: true,
      })),
    });
    const result = await loadModelContext(
      model({ mmprojPath: "models/p.gguf" }),
      4096,
      d,
    );
    expect(result.vision).toBe(false);
  });

  it("still returns a usable text model when the projector fails to load", async () => {
    const d = deps({
      initMultimodal: jest.fn(async () => {
        throw new Error("bad mmproj");
      }),
    });
    const result = await loadModelContext(
      model({ mmprojPath: "models/p.gguf" }),
      4096,
      d,
    );
    expect(result).toEqual({ ctx, vision: false });
  });

  it("treats initMultimodal returning false as no vision, without asking for support", async () => {
    const d = deps({ initMultimodal: jest.fn(async () => false) });
    const result = await loadModelContext(
      model({ mmprojPath: "models/p.gguf" }),
      4096,
      d,
    );
    expect(result.vision).toBe(false);
    expect(d.getMultimodalSupport).not.toHaveBeenCalled();
  });

  it("propagates a failure to load the base model itself", async () => {
    const d = deps({
      initLlm: jest.fn(async () => {
        throw new Error("no model");
      }),
    });
    await expect(loadModelContext(model(), 4096, d)).rejects.toThrow(
      "no model",
    );
  });
});
