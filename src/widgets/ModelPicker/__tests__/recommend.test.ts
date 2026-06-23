import type { Model } from "@/entities/model";
import { pickDefaultModel, recommendModels } from "../recommend";

const GB = 1_000_000_000;

const model = (id: string, sizeGB: number): Model => ({
  id,
  name: `model-${id}`,
  path: `/models/${id}.gguf`,
  size: sizeGB * GB,
  parameters: "3B",
  quantization: "Q4_K_M",
  isActive: false,
  downloadedAt: 0,
});

describe("recommendModels", () => {
  it("marks a model that fits within RAM × safe fraction as fitting", () => {
    // 8GB RAM × 0.6 = 4.8GB budget
    const [result] = recommendModels(8 * GB, [model("a", 2)]);
    expect(result.fits).toBe(true);
  });

  it("marks a model larger than the budget as not fitting", () => {
    const [result] = recommendModels(8 * GB, [model("a", 6)]);
    expect(result.fits).toBe(false);
  });

  it("treats a model exactly at the budget as fitting", () => {
    const [result] = recommendModels(10 * GB, [model("a", 6)]); // budget 6GB
    expect(result.fits).toBe(true);
  });

  it("marks all models as fitting when RAM is unknown (null)", () => {
    const results = recommendModels(null, [model("a", 2), model("b", 50)]);
    expect(results.every((m) => m.fits)).toBe(true);
  });

  it("preserves model fields and order", () => {
    const results = recommendModels(8 * GB, [model("a", 2), model("b", 3)]);
    expect(results.map((m) => m.id)).toEqual(["a", "b"]);
    expect(results[0].name).toBe("model-a");
  });

  it("returns an empty array for no models", () => {
    expect(recommendModels(8 * GB, [])).toEqual([]);
  });
});

describe("pickDefaultModel", () => {
  it("returns the largest model that still fits", () => {
    const picked = pickDefaultModel(8 * GB, [
      model("small", 1),
      model("mid", 4),
      model("big", 7),
    ]);
    expect(picked?.id).toBe("mid"); // big (7GB) exceeds 4.8GB budget
  });

  it("falls back to the smallest model when none fit", () => {
    const picked = pickDefaultModel(4 * GB, [model("a", 5), model("b", 8)]);
    expect(picked?.id).toBe("a"); // budget 2.4GB, neither fits → smallest
  });

  it("returns the largest model when RAM is unknown", () => {
    const picked = pickDefaultModel(null, [model("a", 2), model("b", 9)]);
    expect(picked?.id).toBe("b");
  });

  it("returns null for an empty list", () => {
    expect(pickDefaultModel(8 * GB, [])).toBeNull();
  });
});
