import { getDocumentAsync } from "expo-document-picker";
import { launchImageLibraryAsync } from "expo-image-picker";

/**
 * `shared/picker` — the only place that calls the native file/image
 * pickers (same principle as `shared/llm` owning llama.rn). Both pickers
 * return different result shapes; this normalizes them to one
 * `PickedSource`. Purely local: both open the OS's own picker UI and hand
 * back a file already on the device.
 *
 * Both pickers write a temporary copy into a folder under the app's cache
 * directory (verified in the installed native code: `DocumentPicker` and
 * `ImagePicker`, same names on iOS and Android) — the caller copies the
 * file into permanent storage and can then delete that temporary copy.
 */

export const PICKER_CACHE_DIRECTORIES = ["DocumentPicker", "ImagePicker"];

export type PickedSource = {
  /** Temporary `file://` URI inside the app's cache directory. */
  uri: string;
  name: string;
  mimeType: string | null;
  size: number | null;
};

type DocumentResultLike = {
  canceled: boolean;
  assets:
    | { uri: string; name: string; mimeType?: string; size?: number }[]
    | null;
};

type ImageResultLike = {
  canceled: boolean;
  assets:
    | {
        uri: string;
        fileName?: string | null;
        fileSize?: number;
        mimeType?: string;
      }[]
    | null;
};

export function normalizeDocumentResult(
  result: DocumentResultLike,
): PickedSource | null {
  const asset = result.canceled ? undefined : result.assets?.[0];
  if (!asset) return null;
  return {
    uri: asset.uri,
    name: asset.name,
    mimeType: asset.mimeType ?? null,
    size: asset.size ?? null,
  };
}

export function normalizeImageResult(
  result: ImageResultLike,
): PickedSource | null {
  const asset = result.canceled ? undefined : result.assets?.[0];
  if (!asset) return null;
  const fallbackName = asset.uri.split("/").pop() || "image";
  return {
    uri: asset.uri,
    name: asset.fileName || fallbackName,
    mimeType: asset.mimeType ?? null,
    size: asset.fileSize ?? null,
  };
}

/** Opens the system file picker (any type, one file). Resolves to null if the user cancels. */
export async function pickDocument(): Promise<PickedSource | null> {
  const result = await getDocumentAsync({
    type: "*/*",
    copyToCacheDirectory: true,
    multiple: false,
  });
  return normalizeDocumentResult(result);
}

/** Opens the system photo library (images only, one item). Resolves to null if the user cancels. */
export async function pickImage(): Promise<PickedSource | null> {
  const result = await launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsMultipleSelection: false,
  });
  return normalizeImageResult(result);
}
