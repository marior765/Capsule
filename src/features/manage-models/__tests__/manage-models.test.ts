// Tests for step 1.2 — written before implementation (TDD)
// The "downloadModel — egress tracking" block below is for step 4.3, also
// TDD (written before that wiring existed).
import {
  insertModel,
  modelsMigration,
  modelsMmprojMigration,
} from "@/entities/model";
import { auditMigration, getAllAuditEntries } from "@/entities/audit";
import { _resetDbForTesting, openDb, runMigrations } from "@/shared/db";
import { File } from "expo-file-system";
import { __deletedUris, __resetFsMock } from "@/__mocks__/expo-file-system";
import type { SQLiteDatabase } from "expo-sqlite";
import {
  isEgressActive,
  subscribeToEgress,
  _resetEgressForTesting,
} from "@/shared/egress";
import {
  deleteModelById,
  downloadModel,
  listModels,
  resolveModelPath,
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
  _resetEgressForTesting();
  jest.clearAllMocks();
  db = openDb();
  runMigrations(db, [modelsMigration, modelsMmprojMigration, auditMigration]);
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
      { idempotent: true },
    );
  });

  it("calls onProgress with 1 on completion", async () => {
    const onProgress = jest.fn();
    await downloadModel(db, spec(), onProgress);
    expect(onProgress).toHaveBeenCalledWith(1);
  });

  // CLAUDE.md hard rule: "Privacy-sensitive actions (export, decrypt, wipe,
  // model download) must write to the audit entity." This is the one live
  // caller of that rule today.
  it("writes a model_download audit entry", async () => {
    const model = await downloadModel(db, spec({ name: "Llama 3.2 3B" }));
    const [entry] = getAllAuditEntries(db);
    expect(entry).toBeDefined();
    expect(entry.action).toBe("model_download");
    expect(entry.detail).toBe("Llama 3.2 3B");
    expect(entry.createdAt).toBe(model.downloadedAt);
  });
});

describe("downloadModel — egress tracking", () => {
  it("is active while the download is in flight", async () => {
    const promise = downloadModel(db, spec());
    // downloadModel is async and hasn't awaited anything yet at this point
    // in the microtask queue — if beginEgress() runs synchronously before
    // the first await (File.downloadFileAsync), this is already true.
    expect(isEgressActive()).toBe(true);
    await promise;
  });

  it("is inactive again once the download completes", async () => {
    await downloadModel(db, spec());
    expect(isEgressActive()).toBe(false);
  });

  it("ends egress even when the download fails — no stuck 'active' state", async () => {
    (File.downloadFileAsync as jest.Mock).mockRejectedValueOnce(
      new Error("network failure"),
    );
    await expect(downloadModel(db, spec())).rejects.toThrow();
    expect(isEgressActive()).toBe(false);
  });

  it("notifies subscribers that egress started and then ended", async () => {
    const listener = jest.fn();
    subscribeToEgress(listener);
    await downloadModel(db, spec());
    expect(listener).toHaveBeenCalledWith(true);
    expect(listener).toHaveBeenCalledWith(false);
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
    expect(__deletedUris).toContain(resolveModelPath(model.path));
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

describe("model paths survive the app container moving (iOS update/restore)", () => {
  it("stores the path RELATIVE to the document directory", async () => {
    const model = await downloadModel(db, spec());
    expect(model.path).toMatch(/^models\//);
    expect(model.path).not.toContain("file://");
    expect(resolveModelPath(model.path)).toBe(`file:///document/${model.path}`);
  });

  it("re-resolves a legacy absolute path from an old container under the CURRENT one", () => {
    expect(
      resolveModelPath(
        "file:///var/mobile/Containers/Data/Application/OLD-UUID/Documents/models/llama.gguf",
      ),
    ).toBe("file:///document/models/llama.gguf");
  });

  it("downloads idempotently, so a partial file from a failed attempt can't block a retry", async () => {
    await downloadModel(db, spec());
    expect(File.downloadFileAsync).toHaveBeenCalledWith(
      expect.any(String),
      expect.anything(),
      { idempotent: true },
    );
  });
});

describe("vision models: base + projector downloaded together (8.4)", () => {
  const visionSpec = spec({
    name: "Vision",
    url: "https://huggingface.co/example/vision.gguf",
    mmprojUrl: "https://huggingface.co/example/mmproj-vision.gguf",
  });

  it("downloads both files and records them as one model", async () => {
    const model = await downloadModel(db, visionSpec);
    expect(File.downloadFileAsync).toHaveBeenCalledTimes(2);
    expect(File.downloadFileAsync).toHaveBeenCalledWith(
      "https://huggingface.co/example/mmproj-vision.gguf",
      expect.anything(),
      { idempotent: true },
    );
    expect(model.mmprojPath).toMatch(/^models\//);
    expect(model.mmprojPath).not.toBe(model.path);
    expect(listModels(db)[0].mmprojPath).toBe(model.mmprojPath);
    expect(getAllAuditEntries(db)).toHaveLength(1);
  });

  it("a plain chat model has no projector", async () => {
    const model = await downloadModel(db, spec());
    expect(model.mmprojPath).toBeNull();
  });

  it("if the projector download fails, deletes the base file and records nothing", async () => {
    (File.downloadFileAsync as jest.Mock)
      .mockImplementationOnce(async (_url: string, dir: { uri: string }) => {
        const f = new File(`${dir.uri}/vision.gguf`);
        f.size = 10;
        return f;
      })
      .mockRejectedValueOnce(new Error("network failure"));

    await expect(downloadModel(db, visionSpec)).rejects.toThrow(
      "network failure",
    );
    expect(listModels(db)).toEqual([]);
    expect(__deletedUris).toContain("file:///document/models/vision.gguf");
    expect(getAllAuditEntries(db)).toEqual([]);
    expect(isEgressActive()).toBe(false);
  });

  it("deleting a vision model removes both files", async () => {
    const model = await downloadModel(db, visionSpec);
    await deleteModelById(db, model.id);
    expect(__deletedUris).toEqual(
      expect.arrayContaining([
        resolveModelPath(model.path),
        resolveModelPath(model.mmprojPath!),
      ]),
    );
  });
});

describe("manage-models — robustness", () => {
  it("never deletes a file that another model row still uses when recording fails (same file name re-downloaded)", async () => {
    insertModel(db, {
      id: "existing",
      name: "Existing",
      path: "models/shared.gguf",
      size: 1,
      parameters: "1B",
      quantization: "Q4_K_M",
      isActive: true,
      downloadedAt: 1,
      mmprojPath: null,
    });
    (File.downloadFileAsync as jest.Mock)
      .mockImplementationOnce(async (_u: string, dir: { uri: string }) => {
        const f = new File(`${dir.uri}/shared.gguf`); // same name → UNIQUE clash
        f.size = 1;
        return f;
      })
      .mockImplementationOnce(async (_u: string, dir: { uri: string }) => {
        const f = new File(`${dir.uri}/mmproj-new.gguf`);
        f.size = 1;
        return f;
      });

    await expect(
      downloadModel(
        db,
        spec({ name: "Renamed", mmprojUrl: "https://x/mmproj-new.gguf" }),
      ),
    ).rejects.toThrow(/UNIQUE/);

    // The existing (active) model's file is untouched; only the projector
    // nobody references is cleaned up.
    expect(__deletedUris).not.toContain("file:///document/models/shared.gguf");
    expect(__deletedUris).toContain("file:///document/models/mmproj-new.gguf");
    expect(listModels(db).map((m) => m.id)).toEqual(["existing"]);
    expect(isEgressActive()).toBe(false);
  });

  it("keeps the downloaded files when it can't even read which files are in use (an orphan is safer than a deleted model)", async () => {
    _resetDbForTesting();
    const brokenDb = openDb(); // no models table → insert and the reference check both fail
    runMigrations(brokenDb, [auditMigration]);
    await expect(
      downloadModel(
        brokenDb,
        spec({
          url: "https://huggingface.co/example/vision.gguf",
          mmprojUrl: "https://huggingface.co/example/mmproj.gguf",
        }),
      ),
    ).rejects.toThrow();
    expect(__deletedUris).toEqual([]);
    expect(isEgressActive()).toBe(false);
  });

  it("stores a URL-encoded downloaded file name decoded, so it isn't double-encoded on resolve", async () => {
    (File.downloadFileAsync as jest.Mock).mockImplementationOnce(
      async (_url: string, dir: { uri: string }) => {
        const f = new File(`${dir.uri}/my%20model.gguf`);
        f.size = 5;
        return f;
      },
    );
    const model = await downloadModel(db, spec());
    expect(model.path).toBe("models/my model.gguf");
  });

  it("re-maps a legacy absolute path with encoded characters", () => {
    expect(
      resolveModelPath("file:///old/Documents/models/my%20model.gguf"),
    ).toBe("file:///document/models/my model.gguf");
  });

  it("deletes a legacy absolute-path model's file", async () => {
    insertModel(db, {
      id: "legacy",
      name: "Old",
      path: "file:///var/mobile/Containers/Data/Application/OLD/Documents/models/old.gguf",
      size: 1,
      parameters: "1B",
      quantization: "Q4_K_M",
      isActive: false,
      downloadedAt: 1,
      mmprojPath: null,
    });
    await deleteModelById(db, "legacy");
    expect(__deletedUris).toContain("file:///document/models/old.gguf");
    expect(listModels(db)).toEqual([]);
  });
});
