// Tests for step 3.3.1 — written before implementation (TDD)
import { File } from "expo-file-system";
import { __resetFsMock, __missingUris } from "@/__mocks__/expo-file-system";
import {
  _resetEgressForTesting,
  isEgressActive,
  subscribeToEgress,
} from "@/shared/egress";
import type { SQLiteDatabase } from "expo-sqlite";
import { auditMigration, getAllAuditEntries } from "@/entities/audit";
import { openDb, runMigrations, _resetDbForTesting } from "@/shared/db";
import { getString, remove, setString } from "@/shared/storage";
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
  _resetEgressForTesting();
  db = openDb();
  runMigrations(db, [auditMigration]);
});

describe("ensureSttModelDownloaded — happy path", () => {
  it("downloads the default model and persists its local path", async () => {
    // The exact filename is the mock's own choice (expo-file-system's
    // downloadFileAsync mock is shared with the LLM download path and
    // always synthesizes one) — what matters here is that whatever URI it
    // returns is exactly what gets persisted, not any particular extension.
    // 8.12: what's persisted is the app-relative path; the returned uri is
    // that path resolved against the current documents directory.
    const uri = await ensureSttModelDownloaded(db);
    expect(uri).toBeTruthy();
    expect(uri).toBe(`file:///document/${getString(STT_MODEL_PATH_KEY)}`);
  });

  it("invokes the download with the default model's url", async () => {
    await ensureSttModelDownloaded(db);
    expect(File.downloadFileAsync).toHaveBeenCalledWith(
      DEFAULT_STT_MODEL.url,
      expect.anything(),
      expect.anything(), // { idempotent: true } — retries overwrite a partial file
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

// 8.12: the voice model moves onto shared/fs like every other download.
describe("ensureSttModelDownloaded — on shared/fs (8.12)", () => {
  it("stores the path relative to the app's documents, and returns its current file:// uri", async () => {
    const uri = await ensureSttModelDownloaded(db);
    const stored = getString(STT_MODEL_PATH_KEY)!;
    expect(stored.startsWith("stt-models/")).toBe(true);
    expect(uri).toBe(`file:///document/${stored}`);
    expect(getSttModelPath()).toBe(uri);
  });

  it("re-maps a path stored as an absolute uri by an older version", () => {
    setString(
      STT_MODEL_PATH_KEY,
      "file:///var/mobile/Containers/Data/Application/OLD-UUID/Documents/stt-models/ggml-base.en.bin",
    );
    expect(getSttModelPath()).toBe(
      "file:///document/stt-models/ggml-base.en.bin",
    );
  });

  it("treats a stored model whose file is gone as not downloaded — and downloads it again", async () => {
    setString(STT_MODEL_PATH_KEY, "stt-models/ggml-base.en.bin");
    __missingUris.add("file:///document/stt-models/ggml-base.en.bin");
    expect(getSttModelPath()).toBeUndefined();
    await ensureSttModelDownloaded(db);
    expect(File.downloadFileAsync).toHaveBeenCalledTimes(1);
  });

  it("shows as network activity while downloading, and not after", async () => {
    const seen: boolean[] = [];
    const stop = subscribeToEgress((active) => seen.push(active));
    await ensureSttModelDownloaded(db);
    stop();
    expect(seen).toEqual([true, false]);
    expect(isEgressActive()).toBe(false);
  });

  it("downloads once even when asked twice at the same time", async () => {
    const [a, b] = await Promise.all([
      ensureSttModelDownloaded(db),
      ensureSttModelDownloaded(db),
    ]);
    expect(a).toBe(b);
    expect(File.downloadFileAsync).toHaveBeenCalledTimes(1);
    expect(getAllAuditEntries(db)).toHaveLength(1);
  });
});
