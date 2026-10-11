import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";

/**
 * Zip bundles for exports and backups (5.5) — the JSON plus the files it
 * refers to, in one file. Wraps `fflate` (pure JavaScript, no native code,
 * no network). Everything happens in memory, which is fine for a phone's
 * worth of notes and photos; very large videos would be slow.
 *
 * Unzipping is defensive: a bundle comes from outside the app, so entries
 * that climb out of the bundle (`..`) or are absolute are refused, and so
 * is a bundle that would expand beyond `maxTotalBytes` (a zip bomb). fflate
 * allocates each entry by its declared size, so memory stays within the
 * limit; an entry that comes out a different size is refused as damaged.
 */

export class ZipError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ZipError";
  }
}

export type ZipEntries = Record<string, Uint8Array>;

/**
 * The largest bundle (total unzipped bytes) the app opens — everything
 * unzips into memory at once, so this stays well within a phone's RAM.
 * Exporters use it too, so they never build a bundle the app can't open.
 */
export const MAX_BUNDLE_BYTES = 256_000_000; // 256 MB

/**
 * JSON is compressed; files (photos, PDFs — usually compressed already) are
 * stored as they are, which is much faster on a phone and barely larger.
 */
export function zipFiles(entries: ZipEntries): Uint8Array {
  const input: Record<string, [Uint8Array, { level: 0 | 6 }]> = {};
  for (const [name, data] of Object.entries(entries)) {
    input[name] = [data, { level: name.endsWith(".json") ? 6 : 0 }];
  }
  return zipSync(input);
}

function isSafeEntryPath(path: string): boolean {
  if (path.startsWith("/") || path.includes("\\")) return false;
  if (/[\x00-\x1f\x7f]/.test(path)) return false;
  return path
    .split("/")
    .every((segment) => segment !== ".." && segment !== ".");
}

export function unzipFiles(
  bytes: Uint8Array,
  options: { maxTotalBytes?: number } = {},
): ZipEntries {
  const limit = options.maxTotalBytes ?? MAX_BUNDLE_BYTES;
  let total = 0;
  let refusal: string | null = null;
  const declared = new Map<string, number>();
  let entries: ZipEntries;
  try {
    entries = unzipSync(bytes, {
      filter: (file) => {
        if (refusal !== null) return false;
        if (file.name.endsWith("/")) return false; // a directory entry
        if (!isSafeEntryPath(file.name)) {
          refusal = `The bundle contains an unsafe path: ${file.name}`;
          return false;
        }
        declared.set(file.name, file.originalSize);
        total += file.originalSize;
        if (total > limit) {
          refusal = "The bundle is too large to open.";
          return false;
        }
        return true;
      },
    });
  } catch {
    throw new ZipError("That file isn't a valid zip bundle.");
  }
  if (refusal !== null) throw new ZipError(refusal);
  // fflate doesn't verify checksums. Each entry must come out exactly its
  // declared size — this catches stored entries that lie and deflated ones
  // that come out short (truncated). A deflated entry that is LONGER than
  // declared is silently cut by fflate, and corruption that keeps the
  // length isn't detected at all; a damaged JSON then fails to parse.
  let actual = 0;
  for (const [name, data] of Object.entries(entries)) {
    if (data.length !== declared.get(name)) {
      throw new ZipError(`The bundle is damaged (${name} is incomplete).`);
    }
    actual += data.length;
  }
  if (actual > limit) throw new ZipError("The bundle is too large to open.");
  return entries;
}

export function textToBytes(text: string): Uint8Array {
  return strToU8(text);
}

export function textFromBytes(bytes: Uint8Array): string {
  return strFromU8(bytes);
}
