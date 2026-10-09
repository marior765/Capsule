// Mock for expo-file-system — tests must never hit the network or real disk.

let downloadCounter = 0;
export const __deletedUris: string[] = [];
export const __deletedDirectoryUris: string[] = [];
export const __createdDirectoryUris: string[] = [];
export const __copiedFiles: { from: string; to: string }[] = [];
/** URIs that report `exists === false` — everything else exists, matching the original default. */
export const __missingUris = new Set<string>();

export function __resetFsMock(): void {
  downloadCounter = 0;
  __deletedUris.length = 0;
  __deletedDirectoryUris.length = 0;
  __createdDirectoryUris.length = 0;
  __copiedFiles.length = 0;
  __missingUris.clear();
}

type UriPart = string | { uri: string };
const join = (...parts: UriPart[]): string =>
  parts.map((p) => (typeof p === "string" ? p : p.uri)).join("/");

export class Directory {
  uri: string;
  constructor(...parts: UriPart[]) {
    this.uri = join(...parts);
  }
  get exists(): boolean {
    return !__missingUris.has(this.uri);
  }
  create(_options?: { intermediates?: boolean; idempotent?: boolean }): void {
    __createdDirectoryUris.push(this.uri);
  }
  delete(): void {
    __deletedDirectoryUris.push(this.uri);
  }
}

export class File {
  uri: string;
  size: number;

  constructor(...parts: UriPart[]) {
    this.uri = join(...parts);
    this.size = 0;
  }

  get exists(): boolean {
    return !__missingUris.has(this.uri);
  }

  delete(): void {
    __deletedUris.push(this.uri);
  }

  /** SDK 56: `copy` is async (verified against the installed types). */
  async copy(destination: Directory | File): Promise<void> {
    __copiedFiles.push({ from: this.uri, to: destination.uri });
  }

  static downloadFileAsync = jest.fn(
    async (_url: string, destination: Directory | File): Promise<File> => {
      downloadCounter += 1;
      const file = new File(`${destination.uri}/model-${downloadCounter}.gguf`);
      file.size = 2_000_000_000;
      return file;
    },
  );
}

export class Paths {
  static get document(): Directory {
    return new Directory("file:///document");
  }
  static get cache(): Directory {
    return new Directory("file:///cache");
  }
}
