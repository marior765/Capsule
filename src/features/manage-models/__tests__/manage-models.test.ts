// Tests for step 1.2 — written before implementation (TDD)
import { modelsMigration } from "@/entities/model";
import { _resetDbForTesting, openDb, runMigrations } from "@/shared/db";
import { File } from "expo-file-system";
import { __deletedUris, __resetFsMock } from "@/__mocks__/expo-file-system";
import type { SQLiteDatabase } from "expo-sqlite";
import {
  deleteModelById,
  downloadModel,
  listModels,
  selectModel,
  type ModelDownloadSpec,
} from "../index";

const spec = (
  overrides: Partial<ModelDownloadSpec> = {},
): ModelDownloadSpec => ({
  name: "Llama 3.2 3B",
  url: "https://huggingface.co/example/llama-3.2-3b-q4.gguf",
  parameters: "3B",
  quantization: "Q4_K_M",
  ...overrides,
});

let db: SQLiteDatabase;

beforeEach(() => {
  _resetDbForTesting();
  __resetFsMock();
  jest.clearAllMocks();
  db = openDb();
  runMigrations(db, [modelsMigration]);
});

describe("downloadModel — happy path", () => {
  it("downloads to disk and persists a model record", async () => {
    const model = await downloadModel(db, spec());
    expect(model.name).toBe("Llama 3.2 3B");
    expect(model.parameters).toBe("3B");
    expect(model.quantization).toBe("Q4_K_M");
    expect(model.path).toContain(".gguf");
    expect(model.size).toBeGreaterThan(0);
    expect(listModels(db)).toHaveLength(1);
  });

  it("invokes the download with the spec url", async () => {
    await downloadModel(db, spec({ url: "https://huggingface.co/x/y.gguf" }));
    expect(File.downloadFileAsync).toHaveBeenCalledWith(
      "https://huggingface.co/x/y.gguf",
      expect.anything(),
    );
  });

  it("calls onProgress with 1 on completion", async () => {
    const onProgress = jest.fn();
    await downloadModel(db, spec(), onProgress);
    expect(onProgress).toHaveBeenCalledWith(1);
  });
});

describe("downloadModel — edge cases", () => {
  it("does not auto-activate the first downloaded model", async () => {
    const model = await downloadModel(db, spec());
    expect(model.isActive).toBe(false);
  });

  it("leaves all models inactive until one is selected", async () => {
    await downloadModel(db, spec({ name: "A" }));
    await downloadModel(db, spec({ name: "B" }));
    expect(listModels(db).every((m) => !m.isActive)).toBe(true);
  });
});

describe("downloadModel — error handling", () => {
  it("leaves no DB record if the download fails", async () => {
    (File.downloadFileAsync as jest.Mock).mockRejectedValueOnce(
      new Error("network failure"),
    );
    await expect(downloadModel(db, spec())).rejects.toThrow();
    expect(listModels(db)).toHaveLength(0);
  });
});

describe("listModels", () => {
  it("returns all downloaded models", async () => {
    await downloadModel(db, spec({ name: "A" }));
    await downloadModel(db, spec({ name: "B" }));
    expect(listModels(db)).toHaveLength(2);
  });

  it("returns an empty array when none downloaded", () => {
    expect(listModels(db)).toEqual([]);
  });
});

describe("deleteModelById — happy path", () => {
  it("removes both the file and the DB record", async () => {
    const model = await downloadModel(db, spec());
    await deleteModelById(db, model.id);
    expect(listModels(db)).toHaveLength(0);
    expect(__deletedUris).toContain(model.path);
  });
});

describe("deleteModelById — edge cases", () => {
  it("deleting the active model leaves no active model", async () => {
    const model = await downloadModel(db, spec());
    selectModel(db, model.id);
    await deleteModelById(db, model.id);
    expect(listModels(db).some((m) => m.isActive)).toBe(false);
  });

  it("deleting an unknown id is a no-op and does not throw", async () => {
    await expect(deleteModelById(db, "nonexistent")).resolves.not.toThrow();
  });
});

describe("selectModel", () => {
  it("marks one model active and clears the others", async () => {
    const a = await downloadModel(db, spec({ name: "A" }));
    const b = await downloadModel(db, spec({ name: "B" }));
    selectModel(db, a.id);
    expect(listModels(db).find((m) => m.id === a.id)?.isActive).toBe(true);
    expect(listModels(db).find((m) => m.id === b.id)?.isActive).toBe(false);
  });
});
