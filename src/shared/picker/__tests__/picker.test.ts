// Tests for 6.8 (picker wrapper) — written before implementation (TDD)
import { getDocumentAsync } from "expo-document-picker";
import { launchImageLibraryAsync } from "expo-image-picker";
import {
  PICKER_CACHE_DIRECTORIES,
  normalizeDocumentResult,
  normalizeImageResult,
  pickDocument,
  pickImage,
} from "../index";

jest.mock("expo-document-picker", () => ({ getDocumentAsync: jest.fn() }));
jest.mock("expo-image-picker", () => ({ launchImageLibraryAsync: jest.fn() }));

const mockedGetDocument = getDocumentAsync as jest.Mock;
const mockedLaunchLibrary = launchImageLibraryAsync as jest.Mock;

beforeEach(() => {
  mockedGetDocument.mockReset();
  mockedLaunchLibrary.mockReset();
});

describe("normalizeDocumentResult", () => {
  it("returns null when the user cancels", () => {
    expect(
      normalizeDocumentResult({ canceled: true, assets: null }),
    ).toBeNull();
  });

  it("maps the first asset, turning missing mimeType/size into null", () => {
    expect(
      normalizeDocumentResult({
        canceled: false,
        assets: [{ uri: "file:///cache/DocumentPicker/a.pdf", name: "a.pdf" }],
      }),
    ).toEqual({
      uri: "file:///cache/DocumentPicker/a.pdf",
      name: "a.pdf",
      mimeType: null,
      size: null,
    });
  });

  it("returns null for a success result with no assets", () => {
    expect(normalizeDocumentResult({ canceled: false, assets: [] })).toBeNull();
  });
});

describe("normalizeImageResult", () => {
  it("uses fileName and fileSize when present", () => {
    expect(
      normalizeImageResult({
        canceled: false,
        assets: [
          {
            uri: "file:///cache/ImagePicker/x.jpeg",
            fileName: "IMG_0001.HEIC",
            fileSize: 1234,
            mimeType: "image/heic",
          },
        ],
      }),
    ).toEqual({
      uri: "file:///cache/ImagePicker/x.jpeg",
      name: "IMG_0001.HEIC",
      mimeType: "image/heic",
      size: 1234,
    });
  });

  it("falls back to the uri's last segment when fileName is missing (Android often omits it)", () => {
    const picked = normalizeImageResult({
      canceled: false,
      assets: [
        { uri: "file:///cache/ImagePicker/abc-123.jpg", fileName: null },
      ],
    });
    expect(picked?.name).toBe("abc-123.jpg");
    expect(picked?.size).toBeNull();
    expect(picked?.mimeType).toBeNull();
  });

  it("returns null when canceled", () => {
    expect(normalizeImageResult({ canceled: true, assets: null })).toBeNull();
  });
});

describe("pickDocument / pickImage", () => {
  it("asks the document picker for any file type, copied to cache, single selection", async () => {
    mockedGetDocument.mockResolvedValue({ canceled: true, assets: null });
    await expect(pickDocument()).resolves.toBeNull();
    expect(mockedGetDocument).toHaveBeenCalledWith({
      type: "*/*",
      copyToCacheDirectory: true,
      multiple: false,
    });
  });

  it("asks the image library for images only, single selection", async () => {
    mockedLaunchLibrary.mockResolvedValue({
      canceled: false,
      assets: [{ uri: "file:///cache/ImagePicker/p.jpg", fileName: "p.jpg" }],
    });
    await expect(pickImage()).resolves.toMatchObject({ name: "p.jpg" });
    expect(mockedLaunchLibrary).toHaveBeenCalledWith({
      mediaTypes: ["images"],
      allowsMultipleSelection: false,
    });
  });
});

describe("PICKER_CACHE_DIRECTORIES", () => {
  it("names the cache folders both pickers write temporary copies into", () => {
    expect(PICKER_CACHE_DIRECTORIES).toEqual(["DocumentPicker", "ImagePicker"]);
  });
});
