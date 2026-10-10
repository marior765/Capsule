// Tests for 6.8's shared/fs wrapper — written before implementation (TDD)
import {
  File as MockFile,
  __copiedFiles,
  __createdDirectoryUris,
  __deletedDirectoryUris,
  __deletedUris,
  __missingUris,
  __resetFsMock,
} from "@/__mocks__/expo-file-system";
import {
  appDirectoryUri,
  appFileExists,
  downloadFileInto,
  copyFileInto,
  deleteAppDirectoryIfExists,
  deleteAppFileIfExists,
  deleteCacheDirectoryIfExists,
  deleteCacheFileIfExists,
  resolveAppPath,
} from "../index";

beforeEach(() => __resetFsMock());

describe("appDirectoryUri / resolveAppPath", () => {
  it("resolves segments under the app's document directory", () => {
    expect(appDirectoryUri("attachments", "c1")).toBe(
      "file:///document/attachments/c1",
    );
  });

  it("resolves a stored relative path against the CURRENT document directory", () => {
    expect(resolveAppPath("attachments/c1/a.jpg")).toBe(
      "file:///document/attachments/c1/a.jpg",
    );
  });

  it("rejects relative paths that are absolute, empty, or try to climb out", () => {
    for (const bad of [
      "",
      "/etc/passwd",
      "file:///document/x",
      "attachments/../models/m.gguf",
      "attachments//a.jpg",
      "attachments\\a.jpg",
    ]) {
      expect(() => resolveAppPath(bad)).toThrow(/path/i);
    }
  });
});

describe("copyFileInto", () => {
  it("creates the directory, copies the source, and returns a RELATIVE path (never an absolute URI)", async () => {
    const relative = await copyFileInto(
      "file:///cache/picked/photo.jpg",
      ["attachments", "c1"],
      "a1-photo.jpg",
    );
    expect(relative).toBe("attachments/c1/a1-photo.jpg");
    expect(__createdDirectoryUris).toContain("file:///document/attachments/c1");
    expect(__copiedFiles).toEqual([
      {
        from: "file:///cache/picked/photo.jpg",
        to: "file:///document/attachments/c1/a1-photo.jpg",
      },
    ]);
  });

  it("rejects a file name or directory segment containing a path separator or '..'", async () => {
    await expect(
      copyFileInto("file:///x", ["attachments"], "../escape.jpg"),
    ).rejects.toThrow(/file name/i);
    await expect(
      copyFileInto("file:///x", ["..", "x"], "a.jpg"),
    ).rejects.toThrow(/segment/i);
    expect(__copiedFiles).toEqual([]);
  });
});

describe("deleteAppFileIfExists", () => {
  it("deletes a file inside app storage by its relative path", () => {
    deleteAppFileIfExists("attachments/c1/a.jpg");
    expect(__deletedUris).toEqual(["file:///document/attachments/c1/a.jpg"]);
  });

  it("is a no-op for a missing file (never throws)", () => {
    __missingUris.add("file:///document/attachments/c1/gone.jpg");
    expect(() =>
      deleteAppFileIfExists("attachments/c1/gone.jpg"),
    ).not.toThrow();
    expect(__deletedUris).toEqual([]);
  });

  it("refuses anything that isn't a safe relative path — it cannot delete outside app storage", () => {
    expect(() =>
      deleteAppFileIfExists("file:///document/models/m.gguf"),
    ).toThrow();
    expect(() =>
      deleteAppFileIfExists("attachments/../models/m.gguf"),
    ).toThrow();
    expect(__deletedUris).toEqual([]);
  });
});

describe("deleteAppDirectoryIfExists", () => {
  it("deletes an existing directory under documents", () => {
    deleteAppDirectoryIfExists("attachments", "c1");
    expect(__deletedDirectoryUris).toEqual(["file:///document/attachments/c1"]);
  });

  it("is a no-op when the directory doesn't exist", () => {
    __missingUris.add("file:///document/attachments/c1");
    deleteAppDirectoryIfExists("attachments", "c1");
    expect(__deletedDirectoryUris).toEqual([]);
  });

  it("refuses to delete the whole documents directory", () => {
    expect(() => deleteAppDirectoryIfExists()).toThrow(/segment/i);
  });
});

describe("cache cleanup (picker temporary copies)", () => {
  it("deletes a file inside the app's cache directory", () => {
    deleteCacheFileIfExists("file:///cache/DocumentPicker/a.pdf");
    expect(__deletedUris).toEqual(["file:///cache/DocumentPicker/a.pdf"]);
  });

  it("refuses URIs outside the cache directory or containing '..'", () => {
    for (const bad of [
      "file:///document/attachments/c1/a.jpg",
      "file:///cache/../document/x",
      "file:///cachefake/a",
      "file:///cache",
    ]) {
      expect(() => deleteCacheFileIfExists(bad)).toThrow(/cache/i);
    }
    expect(__deletedUris).toEqual([]);
  });

  it("is a no-op for a missing cache file", () => {
    __missingUris.add("file:///cache/ImagePicker/gone.jpg");
    deleteCacheFileIfExists("file:///cache/ImagePicker/gone.jpg");
    expect(__deletedUris).toEqual([]);
  });

  it("deletes a named folder inside the cache directory", () => {
    deleteCacheDirectoryIfExists("DocumentPicker");
    expect(__deletedDirectoryUris).toEqual(["file:///cache/DocumentPicker"]);
  });
});

describe("downloadFileInto / appFileExists", () => {
  it("creates the directory, downloads into it, and returns a relative path plus size", async () => {
    const result = await downloadFileInto("https://example.test/m.gguf", [
      "embedding-models",
    ]);
    expect(MockFile.downloadFileAsync).toHaveBeenCalledWith(
      "https://example.test/m.gguf",
      expect.objectContaining({ uri: "file:///document/embedding-models" }),
      { idempotent: true },
    );
    expect(__createdDirectoryUris).toContain(
      "file:///document/embedding-models",
    );
    expect(result.relativePath).toMatch(/^embedding-models\/[^/]+$/);
    expect(result.relativePath).not.toContain("file://");
    expect(result.size).toBeGreaterThan(0);
  });

  it("appFileExists reports a stored relative path's presence", () => {
    expect(appFileExists("embedding-models/a.gguf")).toBe(true);
    __missingUris.add("file:///document/embedding-models/a.gguf");
    expect(appFileExists("embedding-models/a.gguf")).toBe(false);
  });
});

describe("downloadFileInto — encoded names", () => {
  it("returns the decoded file name in the relative path", async () => {
    (MockFile.downloadFileAsync as jest.Mock).mockImplementationOnce(
      async (_url: string, dir: { uri: string }) => {
        const f = new MockFile(`${dir.uri}/a%20b.gguf`);
        f.size = 1;
        return f;
      },
    );
    const { relativePath } = await downloadFileInto("https://x/a%20b.gguf", [
      "models",
    ]);
    expect(relativePath).toBe("models/a b.gguf");
  });
});
