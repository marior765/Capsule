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
  cancelEmbeddingDownload,
  deleteEmbeddingModel,
  downloadEmbeddingModel,
  getEmbeddingModelUri,
  isEmbeddingModelDownloading,
  waitForEmbeddingDownload,
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

describe("cancelEmbeddingDownload (e.g. a full wipe while downloading)", () => {
  it("a download that finishes after cancel stores nothing, writes no audit entry, and deletes its file", async () => {
    let finish: () => void = () => {};
    download.mockImplementationOnce(
      (_url: string, dir: { uri: string }) =>
        new Promise((resolve) => {
          finish = () => {
            const file = new File(`${dir.uri}/bge.gguf`);
            file.size = 35;
            resolve(file);
          };
        }),
    );

    const pending = downloadEmbeddingModel(db);
    await Promise.resolve();
    cancelEmbeddingDownload();
    finish();

    await expect(pending).rejects.toThrow(/cancel/i);
    expect(getString(EMBEDDING_MODEL_PATH_KEY)).toBeUndefined();
    expect(getAllAuditEntries(db)).toEqual([]);
    expect(__deletedUris).toContain(
      "file:///document/embedding-models/bge.gguf",
    );
    expect(isEgressActive()).toBe(false);
  });

  it("does not affect a download started after the cancel", async () => {
    cancelEmbeddingDownload();
    await expect(downloadEmbeddingModel(db)).resolves.toMatch(/^file:\/\//);
    expect(getString(EMBEDDING_MODEL_PATH_KEY)).toBeDefined();
  });

  it("a download requested after a cancel waits for the cancelled one to settle, so its file can't be deleted by it (same file name, as in production)", async () => {
    const name = DEFAULT_EMBEDDING_MODEL.url.split("/").pop();
    const target = `file:///document/embedding-models/${name}`;
    let finishFirst: () => void = () => {};
    download
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishFirst = () => resolve(new File(target));
          }),
      )
      .mockImplementationOnce(async () => new File(target));

    const first = downloadEmbeddingModel(db);
    await Promise.resolve();
    cancelEmbeddingDownload();
    expect(isEmbeddingModelDownloading()).toBe(true); // still settling
    const second = downloadEmbeddingModel(db);
    await Promise.resolve();
    expect(download).toHaveBeenCalledTimes(1); // second hasn't started yet

    finishFirst();
    await expect(first).rejects.toThrow(/cancel/i);
    await expect(second).resolves.toBe(target);

    // The cancelled download's cleanup ran BEFORE the second wrote its file:
    // one delete, then the second's file stays put and is stored.
    expect(__deletedUris).toEqual([target]);
    expect(download).toHaveBeenCalledTimes(2);
    expect(getEmbeddingModelUri()).toBe(target);
    expect(getAllAuditEntries(db)).toHaveLength(1);
    expect(isEmbeddingModelDownloading()).toBe(false);
  });

  it("isEmbeddingModelDownloading stays true after a cancel until the cancelled download settles", async () => {
    let finish: () => void = () => {};
    download.mockImplementationOnce(
      (_u: string, dir: { uri: string }) =>
        new Promise((resolve) => {
          finish = () => resolve(new File(`${dir.uri}/x.gguf`));
        }),
    );
    const pending = downloadEmbeddingModel(db).catch(() => undefined);
    await Promise.resolve();
    cancelEmbeddingDownload();
    expect(isEmbeddingModelDownloading()).toBe(true);
    finish();
    await pending;
    expect(isEmbeddingModelDownloading()).toBe(false);
  });
});

describe("isEmbeddingModelDownloading", () => {
  it("is true only while a download is in flight", async () => {
    expect(isEmbeddingModelDownloading()).toBe(false);
    const pending = downloadEmbeddingModel(db);
    expect(isEmbeddingModelDownloading()).toBe(true);
    await pending;
    expect(isEmbeddingModelDownloading()).toBe(false);
  });
});

describe("waitForEmbeddingDownload", () => {
  it("resolves (never rejects) once the current download settles, even if it failed", async () => {
    download.mockRejectedValueOnce(new Error("offline"));
    const pending = downloadEmbeddingModel(db).catch(() => undefined);
    await expect(waitForEmbeddingDownload()).resolves.toBeUndefined();
    await pending;
    expect(isEmbeddingModelDownloading()).toBe(false);
  });

  it("resolves immediately when nothing is downloading", async () => {
    await expect(waitForEmbeddingDownload()).resolves.toBeUndefined();
  });
});

describe("no network after a cancel", () => {
  it("a download queued behind a cancelled one, then cancelled itself, never makes its request", async () => {
    let finishFirst: () => void = () => {};
    download.mockImplementationOnce(
      (_u: string, dir: { uri: string }) =>
        new Promise((resolve) => {
          finishFirst = () => resolve(new File(`${dir.uri}/x.gguf`));
        }),
    );
    const first = downloadEmbeddingModel(db).catch(() => undefined);
    await Promise.resolve();
    cancelEmbeddingDownload(); // e.g. a wipe
    const second = downloadEmbeddingModel(db); // user taps Download again
    cancelEmbeddingDownload(); // another wipe before the first settles
    finishFirst();
    await first;
    await expect(second).rejects.toThrow(/cancel/i);
    expect(download).toHaveBeenCalledTimes(1); // the second never hit the network
    expect(isEgressActive()).toBe(false);
  });
});
