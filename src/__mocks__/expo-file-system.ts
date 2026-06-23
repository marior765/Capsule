// Mock for expo-file-system — tests must never hit the network or real disk.

let downloadCounter = 0;
export const __deletedUris: string[] = [];

export function __resetFsMock(): void {
  downloadCounter = 0;
  __deletedUris.length = 0;
}

type UriPart = string | { uri: string };
const join = (...parts: UriPart[]): string =>
  parts.map((p) => (typeof p === "string" ? p : p.uri)).join("/");

export class Directory {
  uri: string;
  exists = true;
  constructor(...parts: UriPart[]) {
    this.uri = join(...parts);
  }
  create(): void {}
}

export class File {
  uri: string;
  size: number;
  exists = true;

  constructor(...parts: UriPart[]) {
    this.uri = join(...parts);
    this.size = 0;
  }

  delete(): void {
    __deletedUris.push(this.uri);
  }

  static downloadFileAsync = jest.fn(
    async (_url: string, destination: Directory | File): Promise<File> => {
      downloadCounter += 1;
      const file = new File(`${destination.uri}/model-${downloadCounter}.gguf`);
      file.size = 2_000_000_000;
      return file;
    }
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
