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
 * delete functions. Purely local: no network.
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
