// Tests for 5.5 (zip bundles via fflate) — written before implementation (TDD)
import { zipSync } from "fflate";
import {
  textFromBytes,
  textToBytes,
  unzipFiles,
  zipFiles,
  ZipError,
} from "../index";

describe("zipFiles / unzipFiles", () => {
  it("round-trips text and binary entries byte for byte", () => {
    const binary = new Uint8Array([0, 1, 2, 250, 255]);
    const zipped = zipFiles({
      "backup.json": textToBytes('{"a":"ünïcode"}'),
      "files/att-1-photo.jpg": binary,
    });
    const out = unzipFiles(zipped);
    expect(textFromBytes(out["backup.json"])).toBe('{"a":"ünïcode"}');
    expect(Array.from(out["files/att-1-photo.jpg"])).toEqual([
      0, 1, 2, 250, 255,
    ]);
  });

  it("refuses an entry that climbs out of the bundle", () => {
    const evil = zipSync({ "../outside.txt": textToBytes("x") });
    expect(() => unzipFiles(evil)).toThrow(ZipError);
  });

  it("refuses an absolute entry path", () => {
    const evil = zipSync({ "/etc/passwd": textToBytes("x") });
    expect(() => unzipFiles(evil)).toThrow(ZipError);
  });

  it("refuses a bundle that would expand beyond the size limit (zip bomb)", () => {
    const big = zipSync({ "a.bin": new Uint8Array(2_000_000) });
    expect(() => unzipFiles(big, { maxTotalBytes: 1_000_000 })).toThrow(
      ZipError,
    );
  });

  it("refuses something that isn't a zip at all", () => {
    expect(() => unzipFiles(textToBytes("not a zip"))).toThrow(ZipError);
  });

  it("skips directory entries", () => {
    const withDir = zipSync({
      "files/": new Uint8Array(0),
      "a.txt": textToBytes("a"),
    });
    expect(Object.keys(unzipFiles(withDir))).toEqual(["a.txt"]);
  });
});

describe("unzipFiles — more refusals (5.5a checker)", () => {
  it.each(["a\\b.txt", "./a.txt", "a/./b.txt", "a\u0000.txt", "a\nb.txt"])(
    "refuses the entry name %j",
    (name) => {
      expect(() => unzipFiles(zipSync({ [name]: textToBytes("x") }))).toThrow(
        ZipError,
      );
    },
  );

  it("stores files without recompressing them, compresses the JSON", () => {
    const photo = new Uint8Array(10_000).fill(7);
    const zipped = zipFiles({
      "files/1": photo,
      "capsules.json": textToBytes("x".repeat(10_000)),
    });
    // a stored 10 kB entry keeps the bundle above 10 kB; compressed it'd be tiny
    expect(zipped.length).toBeGreaterThan(10_000);
    expect(zipped.length).toBeLessThan(10_400);
    expect(Array.from(unzipFiles(zipped)["files/1"].slice(0, 3))).toEqual([
      7, 7, 7,
    ]);
  });
});
