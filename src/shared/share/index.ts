import { isAvailableAsync, shareAsync } from "expo-sharing";

/**
 * The only expo-sharing caller (5.5 / 6.9): hands a LOCAL file to the
 * system share sheet ("Save to Files", AirDrop, "Open in…"), always from a
 * user's tap. Nothing is uploaded by Capsule — the person chooses where the
 * file goes. Only `shareAsync` is used; expo-sharing's incoming-share API
 * (which can resolve web links) is deliberately not exposed.
 */

export class ShareUnavailableError extends Error {
  constructor() {
    super("Sharing isn't available on this device.");
    this.name = "ShareUnavailableError";
  }
}

/** Whether the system share sheet can be shown on this device. */
export async function canShare(): Promise<boolean> {
  return isAvailableAsync();
}

export async function shareFile(
  uri: string,
  options: { mimeType?: string; title?: string } = {},
): Promise<void> {
  if (!uri.startsWith("file://")) {
    throw new Error("Only files on this device can be shared.");
  }
  if (!(await isAvailableAsync())) throw new ShareUnavailableError();
  await shareAsync(uri, {
    ...(options.mimeType ? { mimeType: options.mimeType } : {}),
    ...(options.title ? { dialogTitle: options.title } : {}),
  });
}
