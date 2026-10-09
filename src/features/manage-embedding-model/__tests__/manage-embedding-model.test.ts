// Tests for 7.2 (dedicated embedding model download) — written before implementation (TDD)
import { File } from "expo-file-system";
import {
  __deletedUris,
  __missingUris,
  __resetFsMock,
} from "@/__mocks__/expo-file-system";
import type { SQLiteDatabase } from "expo-sqlite";
import { auditMigration, getAllAuditEntries } from "@/entities/audit";
import { openDb, runMigrations, _resetDbForTesting } from "@/shared/db";
import { _resetEgressForTesting, isEgressActive } from "@/shared/egress";
import { getString, remove, setString } from "@/shared/storage";
import {
  DEFAULT_EMBEDDING_MODEL,
  EMBEDDING_MODEL_PATH_KEY,
  deleteEmbeddingModel,
  downloadEmbeddingModel,
  getEmbeddingModelUri,
} from "../index";

let db: SQLiteDatabase;
const download = File.downloadFileAsync as jest.Mock;
const originalDownload = download.getMockImplementation();

beforeEach(() => {
  _resetDbForTesting();
  __resetFsMock();
  _resetEgressForTesting();
  jest.clearAllMocks();
  remove(EMBEDDING_MODEL_PATH_KEY);
  db = openDb();
  runMigrations(db, [auditMigration]);
});

describe("DEFAULT_EMBEDDING_MODEL", () => {
  it("is a small GGUF fetched over https from Hugging Face", () => {
    expect(DEFAULT_EMBEDDING_MODEL.url).toMatch(
      /^https:\/\/huggingface\.co\/.+\.gguf$/,
    );
    expect(DEFAULT_EMBEDDING_MODEL.contextLength).toBeGreaterThan(0);
  });
});

describe("downloadEmbeddingModel", () => {
  it("downloads into embedding-models/ and stores a RELATIVE path (iOS may move the app container)", async () => {
    await downloadEmbeddingModel(db);
    expect(download).toHaveBeenCalledWith(
      DEFAULT_EMBEDDING_MODEL.url,
      expect.objectContaining({ uri: "file:///document/embedding-models" }),
      { idempotent: true },
    );
    const stored = getString(EMBEDDING_MODEL_PATH_KEY);
    expect(stored).toMatch(/^embedding-models\//);
    expect(stored).not.toContain("file://");
  });

  it("returns the resolved file:// URI of the downloaded model", async () => {
    const uri = await downloadEmbeddingModel(db);
    expect(uri).toBe(`file:///document/${getString(EMBEDDING_MODEL_PATH_KEY)}`);
  });

  it("writes a model_download audit entry", async () => {
    await downloadEmbeddingModel(db);
    const entries = getAllAuditEntries(db);
    expect(entries).toHaveLength(1);
    expect(entries[0].action).toBe("model_download");
    expect(entries[0].detail).toBe(DEFAULT_EMBEDDING_MODEL.name);
  });

  it("marks egress active only while the download is in flight (privacy banner)", async () => {
    let activeDuring = false;
    download.mockImplementationOnce(
      async (_url: string, dir: { uri: string }) => {
        activeDuring = isEgressActive();
        const file = new File(`${dir.uri}/m.gguf`);
        file.size = 10;
        return file;
      },
    );
    await downloadEmbeddingModel(db);
    expect(activeDuring).toBe(true);
    expect(isEgressActive()).toBe(false);
  });

  it("does not download again when the model is already present", async () => {
    await downloadEmbeddingModel(db);
    await downloadEmbeddingModel(db);
    expect(download).toHaveBeenCalledTimes(1);
    expect(getAllAuditEntries(db)).toHaveLength(1);
  });

  it("re-downloads if the stored path points at a file that's gone", async () => {
    await downloadEmbeddingModel(db);
    __missingUris.add(
      `file:///document/${getString(EMBEDDING_MODEL_PATH_KEY)}`,
    );
    await downloadEmbeddingModel(db);
    expect(download).toHaveBeenCalledTimes(2);
  });

  it("on failure: stores nothing, writes no audit entry, and clears the egress signal", async () => {
    download.mockRejectedValueOnce(new Error("offline"));
    await expect(downloadEmbeddingModel(db)).rejects.toThrow("offline");
    expect(getString(EMBEDDING_MODEL_PATH_KEY)).toBeUndefined();
    expect(getAllAuditEntries(db)).toEqual([]);
    expect(isEgressActive()).toBe(false);
  });
});

describe("downloadEmbeddingModel — retry safety", () => {
  // expo-file-system names the file from the response, so every attempt
  // targets the SAME name, and rejects with DestinationAlreadyExists unless
  // `idempotent: true` is passed. A failed partial download (Android
  // streams straight into the target) must not wedge every later retry.
  afterEach(() => {
    if (originalDownload) download.mockImplementation(originalDownload);
  });

  function realisticDownload() {
    const onDisk = new Set<string>();
    download.mockImplementation(
      async (
        url: string,
        dir: { uri: string },
        options?: { idempotent?: boolean },
      ) => {
        const target = `${dir.uri}/${url.split("/").pop()}`;
        if (onDisk.has(target) && options?.idempotent !== true) {
          throw new Error("DestinationAlreadyExists");
        }
        onDisk.add(target);
        const file = new File(target);
        file.size = 35_000_000;
        return file;
      },
    );
    return onDisk;
  }

  it("asks for an idempotent download so a leftover file is overwritten", async () => {
    const onDisk = realisticDownload();
    // A previous attempt left a partial file behind but stored nothing.
    onDisk.add(
      `file:///document/embedding-models/${DEFAULT_EMBEDDING_MODEL.url.split("/").pop()}`,
    );
    await expect(downloadEmbeddingModel(db)).resolves.toMatch(/\.gguf$/);
    expect(download).toHaveBeenCalledWith(
      DEFAULT_EMBEDDING_MODEL.url,
      expect.anything(),
      { idempotent: true },
    );
  });

  it("shares one download between concurrent calls (double tap)", async () => {
    realisticDownload();
    const [a, b] = await Promise.all([
      downloadEmbeddingModel(db),
      downloadEmbeddingModel(db),
    ]);
    expect(a).toBe(b);
    expect(download).toHaveBeenCalledTimes(1);
    expect(getAllAuditEntries(db)).toHaveLength(1);
  });

  it("writes the audit entry before storing the path, so a stored model always has its audit record", async () => {
    realisticDownload();
    _resetDbForTesting();
    const noAuditDb = openDb(); // audit table missing → insert throws
    await expect(downloadEmbeddingModel(noAuditDb)).rejects.toThrow();
    expect(getString(EMBEDDING_MODEL_PATH_KEY)).toBeUndefined();
  });
});

describe("getEmbeddingModelUri", () => {
  it("is undefined before any download", () => {
    expect(getEmbeddingModelUri()).toBeUndefined();
  });

  it("is undefined when the stored file no longer exists", async () => {
    await downloadEmbeddingModel(db);
    __missingUris.add(
      `file:///document/${getString(EMBEDDING_MODEL_PATH_KEY)}`,
    );
    expect(getEmbeddingModelUri()).toBeUndefined();
  });

  it("is never resolved from a value that isn't a safe relative path", () => {
    setString(EMBEDDING_MODEL_PATH_KEY, "file:///somewhere/else.gguf");
    expect(getEmbeddingModelUri()).toBeUndefined();
  });
});

describe("deleteEmbeddingModel", () => {
  it("deletes the file and forgets the stored path", async () => {
    const uri = await downloadEmbeddingModel(db);
    deleteEmbeddingModel();
    expect(__deletedUris).toEqual([uri]);
    expect(getString(EMBEDDING_MODEL_PATH_KEY)).toBeUndefined();
  });

  it("is a no-op when nothing was downloaded", () => {
    expect(() => deleteEmbeddingModel()).not.toThrow();
    expect(__deletedUris).toEqual([]);
  });
});
