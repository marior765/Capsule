// Tests for 6.8's shared/fs wrapper — written before implementation (TDD)
import {
  __copiedFiles,
  __createdDirectoryUris,
  __deletedDirectoryUris,
  __deletedUris,
  __missingUris,
  __resetFsMock,
} from "@/__mocks__/expo-file-system";
import {
  appDirectoryUri,
  copyFileInto,
  deleteAppDirectoryIfExists,
  deleteAppFileIfExists,
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
