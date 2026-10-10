import type { ParameterSize, Quantization } from "@/shared/config";

export type Model = {
  id: string;
  name: string;
  path: string;
  size: number;
  parameters: ParameterSize;
  quantization: Quantization;
  isActive: boolean;
  downloadedAt: number;
  /**
   * Vision models only (8.4): path of the matching multimodal projector
   * ("mmproj") file, downloaded alongside the base model. Null for a plain
   * chat model. Like `path`, stored relative to the document directory.
   */
  mmprojPath: string | null;
};

export type ModelRow = {
  id: string;
  name: string;
  path: string;
  size: number;
  parameters: string;
  quantization: string;
  is_active: number;
  downloaded_at: number;
  mmproj_path: string | null;
};

export function rowToModel(row: ModelRow): Model {
  return {
    id: row.id,
    name: row.name,
    path: row.path,
    size: row.size,
    parameters: row.parameters as Model["parameters"],
    quantization: row.quantization as Model["quantization"],
    isActive: row.is_active === 1,
    downloadedAt: row.downloaded_at,
    mmprojPath: row.mmproj_path ?? null,
  };
}
