// Tests for step 10.31 — written before implementation (TDD)
//
// Found in the simulator: the Models screen didn't list the voice (Whisper)
// model at all, so its ~148 MB couldn't be seen or freed, and downloadable
// models showed no size.
import { readFileSync } from "fs";
import { join } from "path";
import type { SQLiteDatabase } from "expo-sqlite";
import { __deletedUris, __resetFsMock } from "@/__mocks__/expo-file-system";
import { auditMigration } from "@/entities/audit";
import { RECOMMENDED_MODELS } from "@/shared/config";
import { openDb, runMigrations, _resetDbForTesting } from "@/shared/db";
import { getString, remove } from "@/shared/storage";
import {
  DEFAULT_STT_MODEL,
  deleteSttModel,
  ensureSttModelDownloaded,
  getSttModelPath,
  isSttModelDownloading,
  STT_MODEL_PATH_KEY,
  waitForSttDownload,
} from "../index";

let db: SQLiteDatabase;

beforeEach(() => {
  _resetDbForTesting();
  __resetFsMock();
  remove(STT_MODEL_PATH_KEY);
  db = openDb();
  runMigrations(db, [auditMigration]);
});

describe("deleteSttModel", () => {
  it("removes the downloaded file and forgets it", async () => {
    const uri = await ensureSttModelDownloaded(db);
    deleteSttModel();
    expect(__deletedUris).toContain(uri);
    expect(getString(STT_MODEL_PATH_KEY)).toBeUndefined();
    expect(getSttModelPath()).toBeUndefined();
  });

  it("is a no-op when nothing is downloaded", () => {
    expect(() => deleteSttModel()).not.toThrow();
  });
});

describe("isSttModelDownloading", () => {
  it("is true only while a download is in flight", async () => {
    expect(isSttModelDownloading()).toBe(false);
    const download = ensureSttModelDownloaded(db);
    expect(isSttModelDownloading()).toBe(true);
    await download;
    expect(isSttModelDownloading()).toBe(false);
  });
});

describe("waitForSttDownload", () => {
  it("resolves when a download started elsewhere finishes (or right away if none)", async () => {
    await expect(waitForSttDownload()).resolves.toBeUndefined();
    const download = ensureSttModelDownloaded(db);
    const waited = waitForSttDownload().then(() => getSttModelPath());
    await download;
    expect(await waited).toBeTruthy();
  });
});

describe("download sizes are shown before downloading", () => {
  it("every downloadable model has a size label", () => {
    expect(DEFAULT_STT_MODEL.sizeLabel).toMatch(/\d.*(MB|GB)/);
    for (const spec of RECOMMENDED_MODELS) {
      expect(spec.sizeLabel).toMatch(/\d.*(MB|GB)/);
    }
  });
});

describe("models screen (static)", () => {
  const screen = readFileSync(
    join(__dirname, "../../../app/(app)/models/index.tsx"),
    "utf8",
  );

  it("lists the voice model with download and delete", () => {
    expect(screen).toMatch(/DEFAULT_STT_MODEL\.name/);
    expect(screen).toMatch(/deleteSttModel\(\)/);
    // A loaded whisper context must be let go before its file is deleted.
    expect(screen).toMatch(/stt\.release\(\)/);
    // A download started from the mic is waited for here too.
    expect(screen).toMatch(/waitForSttDownload\(\)/);
  });

  it("shows each download's size on an explicit Download button", () => {
    expect(screen).toMatch(/Download \(\$\{spec\.sizeLabel\}\)/);
  });
});

describe("SttProvider.release (static)", () => {
  const provider = readFileSync(
    join(__dirname, "../../../app/providers/SttProvider.tsx"),
    "utf8",
  );
  it("waits for a model that is still loading before letting it go", () => {
    const release = provider.slice(
      provider.indexOf("const release = useCallback"),
    );
    expect(release.slice(0, 400)).toMatch(/await pending\.current/);
  });
});
