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
  };
}
