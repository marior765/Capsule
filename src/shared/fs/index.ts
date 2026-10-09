import { Directory, File, Paths } from "expo-file-system";

/**
 * `shared/fs` — owns `expo-file-system` interaction for app-managed files,
 * per docs/ARCHITECTURE.md's own extraction rule ("when a second slice
 * needs the filesystem ... same principle as `shared/llm` owning
 * llama.rn"). Introduced for 6.8's attachments. `features/manage-models`
 * and `features/manage-stt-model` still call `expo-file-system` directly;
 * moving them onto this wrapper is a separate follow-up (see
 * `.claude/loop/BLOCKED.md`, "`shared/fs` extraction").
 *
 * Files are addressed by a path RELATIVE to the app's document directory
 * (e.g. `attachments/<capsuleId>/<name>`), never by an absolute `file://`
 * URI. iOS can move the app's data container after an update or a restore
 * from backup, so an absolute path saved in the database would go stale;
 * a relative one is re-resolved against the current document directory
 * every time. Every relative path is validated segment by segment, so
 * nothing here can reach outside the app's own storage — including the
 * delete functions. Network: only `downloadFileInto`, which callers must
 * invoke solely for the one allowed action (a user-initiated model
 * download); everything else is purely local.
 */

function assertSafeSegment(segment: string, what: string): void {
  if (
    segment === "" ||
    segment === "." ||
    segment === ".." ||
    /[/\\:]/.test(segment)
  ) {
    throw new Error(`Invalid ${what}: "${segment}"`);
  }
}

function splitRelativePath(relativePath: string): string[] {
  const segments = relativePath.split("/");
  try {
    segments.forEach((s) => assertSafeSegment(s, "path segment"));
  } catch {
    throw new Error(`Invalid app-relative path: "${relativePath}"`);
  }
  return segments;
}

function appDirectory(segments: string[]): Directory {
  segments.forEach((s) => assertSafeSegment(s, "directory segment"));
  return new Directory(Paths.document, ...segments);
}

/** The `file://` URI of a directory under the app's document directory. */
export function appDirectoryUri(...segments: string[]): string {
  return appDirectory(segments).uri;
}

/** Resolves a stored app-relative path to a `file://` URI under the CURRENT document directory. */
export function resolveAppPath(relativePath: string): string {
  return new File(Paths.document, ...splitRelativePath(relativePath)).uri;
}

/**
 * Copies `sourceUri` (e.g. a picker's temporary cache file) into
 * `<documents>/<directorySegments...>/<fileName>`, creating the directory
 * if needed, and returns the new file's app-relative path. `fileName`
 * must be a single path segment.
 */
export async function copyFileInto(
  sourceUri: string,
  directorySegments: string[],
  fileName: string,
): Promise<string> {
  assertSafeSegment(fileName, "file name");
  const directory = appDirectory(directorySegments);
  directory.create({ intermediates: true, idempotent: true });
  await new File(sourceUri).copy(new File(directory, fileName));
  return [...directorySegments, fileName].join("/");
}

/** Whether a file exists at an app-relative path. Throws for an unsafe path. */
export function appFileExists(relativePath: string): boolean {
  return new File(Paths.document, ...splitRelativePath(relativePath)).exists;
}

/**
 * Downloads `url` into `<documents>/<directorySegments...>/`, creating the
 * directory if needed, and returns the file's app-relative path and size.
 * The file name comes from the server/URL (expo-file-system decides it).
 * This performs a network request — callers are responsible for it being
 * user-initiated and for marking egress (`shared/egress`), as
 * `features/manage-models` does.
 */
export async function downloadFileInto(
  url: string,
  directorySegments: string[],
): Promise<{ relativePath: string; size: number }> {
  const directory = appDirectory(directorySegments);
  directory.create({ intermediates: true, idempotent: true });
  // `idempotent: true` overwrites an existing file of the same name. The
  // name comes from the response, so every attempt targets the same file;
  // without this, a partial file left by a failed download (Android
  // streams straight into the target) makes every retry fail with
  // DestinationAlreadyExists.
  const file = await File.downloadFileAsync(url, directory, {
    idempotent: true,
  });
  const name = file.uri.split("/").pop() ?? "";
  assertSafeSegment(name, "downloaded file name");
  return {
    relativePath: [...directorySegments, name].join("/"),
    size: file.size,
  };
}

/** Deletes a file under app storage, by app-relative path, if it exists; a missing file is not an error. */
export function deleteAppFileIfExists(relativePath: string): void {
  const file = new File(Paths.document, ...splitRelativePath(relativePath));
  if (file.exists) {
    file.delete();
  }
}

/**
 * Deletes a directory (and everything in it) under the app's document
 * directory, if it exists. Requires at least one segment so it can never
 * delete the document directory itself.
 */
export function deleteAppDirectoryIfExists(...segments: string[]): void {
  if (segments.length === 0) {
    throw new Error("deleteAppDirectoryIfExists needs at least one segment");
  }
  const directory = appDirectory(segments);
  if (directory.exists) {
    directory.delete();
  }
}

// --- Cache directory (pickers' temporary copies) ---
//
// The document/image pickers copy each picked file into a folder under the
// app's cache directory before handing back its URI. Those copies are not
// app data — once an attachment has been copied into document storage the
// temporary one is redundant, and the full wipe removes the picker folders.
// These helpers only ever touch paths strictly inside `Paths.cache`.
//
// Known limit: on iOS the document picker (opened "as copy") also leaves a
// system-made copy under the app's `tmp/<bundle-id>-Inbox/` before Expo's
// own cache copy. `expo-file-system` exposes no `tmp` directory (only
// cache/document/bundle), so neither this module nor the full wipe can
// reach it; iOS purges `tmp` on its own. Tracked in `.claude/loop/BLOCKED.md`
// (6.8 device check).

function assertInsideCache(uri: string): void {
  const cacheRoot = Paths.cache.uri.replace(/\/+$/, "");
  const rest = uri.startsWith(`${cacheRoot}/`)
    ? uri.slice(cacheRoot.length + 1)
    : null;
  if (
    rest === null ||
    rest === "" ||
    rest.split("/").some((s) => s === "" || s === "." || s === "..")
  ) {
    throw new Error(`Refusing to delete outside the cache directory: "${uri}"`);
  }
}

/** Deletes a file inside the app's cache directory, if it exists. Throws for any URI outside the cache. */
export function deleteCacheFileIfExists(uri: string): void {
  assertInsideCache(uri);
  const file = new File(uri);
  if (file.exists) {
    file.delete();
  }
}

/** Deletes a named folder inside the app's cache directory, if it exists. */
export function deleteCacheDirectoryIfExists(name: string): void {
  assertSafeSegment(name, "cache folder name");
  const directory = new Directory(Paths.cache, name);
  if (directory.exists) {
    directory.delete();
  }
}
