import { openDb, runMigrations, _resetDbForTesting } from "@/shared/db";
import {
  deleteModel,
  getAllModels,
  getActiveModel,
  getModelById,
  insertModel,
  modelsMigration,
  setActiveModel,
  updateModel,
  type Model,
} from "../index";
import type { SQLiteDatabase } from "expo-sqlite";

const makeModel = (overrides: Partial<Model> = {}): Model => ({
  id: `test-${Math.random().toString(36).slice(2)}`,
  name: "Llama 3.2 3B Q4_K_M",
  path: "/models/llama-3.2-3b-q4.gguf",
  size: 2_000_000_000,
  parameters: "3B",
  quantization: "Q4_K_M",
  isActive: false,
  downloadedAt: Date.now(),
  ...overrides,
});

let db: SQLiteDatabase;

beforeEach(() => {
  _resetDbForTesting();
  db = openDb();
  runMigrations(db, [modelsMigration]);
});

describe("entities/model — happy path", () => {
  it("inserts and retrieves a model by id", () => {
    const model = makeModel();
    insertModel(db, model);
    const found = getModelById(db, model.id);
    expect(found).not.toBeNull();
    expect(found?.id).toBe(model.id);
    expect(found?.name).toBe(model.name);
    expect(found?.isActive).toBe(false);
  });

  it("getAllModels returns all inserted models", () => {
    insertModel(db, makeModel({ id: "a", path: "/a.gguf" }));
    insertModel(db, makeModel({ id: "b", path: "/b.gguf" }));
    expect(getAllModels(db)).toHaveLength(2);
  });

  it("updates model fields", () => {
    const model = makeModel();
    insertModel(db, model);
    updateModel(db, model.id, { name: "Updated Name" });
    expect(getModelById(db, model.id)?.name).toBe("Updated Name");
  });

  it("deletes a model", () => {
    const model = makeModel();
    insertModel(db, model);
    deleteModel(db, model.id);
    expect(getModelById(db, model.id)).toBeNull();
  });

  it("setActiveModel marks one model active and clears others", () => {
    const a = makeModel({ id: "a", path: "/a.gguf" });
    const b = makeModel({ id: "b", path: "/b.gguf" });
    insertModel(db, a);
    insertModel(db, b);
    setActiveModel(db, "a");
    expect(getModelById(db, "a")?.isActive).toBe(true);
    expect(getModelById(db, "b")?.isActive).toBe(false);
    setActiveModel(db, "b");
    expect(getModelById(db, "a")?.isActive).toBe(false);
    expect(getModelById(db, "b")?.isActive).toBe(true);
  });

  it("getActiveModel returns the active model", () => {
    const model = makeModel();
    insertModel(db, model);
    setActiveModel(db, model.id);
    expect(getActiveModel(db)?.id).toBe(model.id);
  });
});

describe("entities/model — edge cases", () => {
  it("getModelById returns null for unknown id", () => {
    expect(getModelById(db, "nonexistent")).toBeNull();
  });

  it("getAllModels returns empty array when no models", () => {
    expect(getAllModels(db)).toEqual([]);
  });

  it("getActiveModel returns null when no model is active", () => {
    insertModel(db, makeModel());
    expect(getActiveModel(db)).toBeNull();
  });

  it("updateModel with empty patch does nothing", () => {
    const model = makeModel();
    insertModel(db, model);
    expect(() => updateModel(db, model.id, {})).not.toThrow();
    expect(getModelById(db, model.id)?.name).toBe(model.name);
  });
});

describe("entities/model — error handling", () => {
  it("throws on duplicate path", () => {
    const model = makeModel({ path: "/same.gguf" });
    insertModel(db, model);
    expect(() =>
      insertModel(db, makeModel({ id: "other", path: "/same.gguf" }))
    ).toThrow();
  });
});
