import type { Model } from "@/entities/model";
import { APP_CONSTANTS } from "@/shared/config";

export type RecommendedModel = Model & { fits: boolean };

/**
 * Annotates each model with whether it fits comfortably in the given RAM.
 * When `ramBytes` is null (device memory unknown), every model is marked as
 * fitting — we don't have the information to recommend against any.
 */
export function recommendModels(
  ramBytes: number | null,
  models: Model[]
): RecommendedModel[] {
  const budget =
    ramBytes == null ? null : ramBytes * APP_CONSTANTS.modelRamSafeFraction;

  return models.map((model) => ({
    ...model,
    fits: budget == null ? true : model.size <= budget,
  }));
}

/**
 * Picks the best default model for the device: the largest model that still
 * fits comfortably (best quality that runs). If none fit, returns the smallest
 * (least-bad) model. Returns null for an empty list.
 */
export function pickDefaultModel(
  ramBytes: number | null,
  models: Model[]
): Model | null {
  if (models.length === 0) return null;

  const bySize = [...models].sort((a, b) => a.size - b.size);
  const fitting = recommendModels(ramBytes, bySize).filter((m) => m.fits);

  if (fitting.length > 0) {
    return fitting[fitting.length - 1];
  }
  return bySize[0];
}
