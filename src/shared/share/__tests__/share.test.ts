// Tests for 5.5 part D / 6.9 (sharing a local file out) — written before implementation (TDD)
import {
  __resetSharingMock,
  __shareState,
  shareAsync,
} from "@/__mocks__/expo-sharing";
import { shareFile, ShareUnavailableError } from "../index";

beforeEach(__resetSharingMock);

describe("shareFile", () => {
  it("opens the system share sheet for a local file, with its type", async () => {
    await shareFile("file:///cache/backup.zip", {
      mimeType: "application/zip",
      title: "Save backup",
    });
    expect(shareAsync).toHaveBeenCalledWith("file:///cache/backup.zip", {
      mimeType: "application/zip",
      dialogTitle: "Save backup",
    });
  });

  it("refuses anything that isn't a local file (no web links leave through here)", async () => {
    await expect(shareFile("https://example.com/x")).rejects.toThrow();
    expect(shareAsync).not.toHaveBeenCalled();
  });

  it("says plainly when sharing isn't available on this device", async () => {
    __shareState.available = false;
    await expect(shareFile("file:///cache/x.zip")).rejects.toThrow(
      ShareUnavailableError,
    );
  });
});
