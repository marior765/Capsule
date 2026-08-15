// Tests for step 3.3.1 — written before implementation (TDD)
import { File } from "expo-file-system";
import { __resetFsMock } from "@/__mocks__/expo-file-system";
import type { SQLiteDatabase } from "expo-sqlite";
import { auditMigration, getAllAuditEntries } from "@/entities/audit";
import { openDb, runMigrations, _resetDbForTesting } from "@/shared/db";
import { getString, remove } from "@/shared/storage";
import {
  DEFAULT_STT_MODEL,
  ensureSttModelDownloaded,
  getSttModelPath,
  STT_MODEL_PATH_KEY,
} from "../index";

let db: SQLiteDatabase;

beforeEach(() => {
  _resetDbForTesting();
  __resetFsMock();
  jest.clearAllMocks();
  remove(STT_MODEL_PATH_KEY);
  db = openDb();
  runMigrations(db, [auditMigration]);
});

describe("ensureSttModelDownloaded — happy path", () => {
  it("downloads the default model and persists its local path", async () => {
    // The exact filename is the mock's own choice (expo-file-system's
    // downloadFileAsync mock is shared with the LLM download path and
    // always synthesizes one) — what matters here is that whatever URI it
    // returns is exactly what gets persisted, not any particular extension.
    const uri = await ensureSttModelDownloaded(db);
    expect(uri).toBeTruthy();
    expect(getString(STT_MODEL_PATH_KEY)).toBe(uri);
  });

  it("invokes the download with the default model's url", async () => {
    await ensureSttModelDownloaded(db);
    expect(File.downloadFileAsync).toHaveBeenCalledWith(
      DEFAULT_STT_MODEL.url,
      expect.anything(),
    );
  });

  it("writes a model_download audit entry", async () => {
    const before = Date.now();
    const uri = await ensureSttModelDownloaded(db);
    const [entry] = getAllAuditEntries(db);
    expect(entry).toBeDefined();
    expect(entry.action).toBe("model_download");
    expect(entry.detail).toBe(DEFAULT_STT_MODEL.name);
    expect(entry.createdAt).toBeGreaterThanOrEqual(before);
    void uri;
  });

  it("calls onProgress with 1 on completion", async () => {
    const onProgress = jest.fn();
    await ensureSttModelDownloaded(db, onProgress);
    expect(onProgress).toHaveBeenCalledWith(1);
  });
});

describe("ensureSttModelDownloaded — edge cases", () => {
  it("does not re-download when a path is already stored", async () => {
    const first = await ensureSttModelDownloaded(db);
    (File.downloadFileAsync as jest.Mock).mockClear();

    const second = await ensureSttModelDownloaded(db);

    expect(second).toBe(first);
    expect(File.downloadFileAsync).not.toHaveBeenCalled();
  });

  it("does not write a second audit entry when skipping an already-downloaded model", async () => {
    await ensureSttModelDownloaded(db);
    await ensureSttModelDownloaded(db);
    expect(getAllAuditEntries(db)).toHaveLength(1);
  });

  it("getSttModelPath returns undefined before any download", () => {
    expect(getSttModelPath()).toBeUndefined();
  });

  it("getSttModelPath returns the stored path after a download", async () => {
    const uri = await ensureSttModelDownloaded(db);
    expect(getSttModelPath()).toBe(uri);
  });
});

describe("ensureSttModelDownloaded — error handling", () => {
  it("propagates a download failure without storing a path", async () => {
    (File.downloadFileAsync as jest.Mock).mockRejectedValueOnce(
      new Error("network unreachable"),
    );
    await expect(ensureSttModelDownloaded(db)).rejects.toThrow(
      "network unreachable",
    );
    expect(getSttModelPath()).toBeUndefined();
  });

  it("propagates a download failure without writing an audit entry", async () => {
    (File.downloadFileAsync as jest.Mock).mockRejectedValueOnce(
      new Error("network unreachable"),
    );
    await expect(ensureSttModelDownloaded(db)).rejects.toThrow();
    expect(getAllAuditEntries(db)).toHaveLength(0);
  });
});
