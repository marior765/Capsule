// Tests for 6.8 (AttachmentList size label) — written before implementation (TDD)
import { formatFileSize } from "../formatFileSize";

describe("formatFileSize", () => {
  it("returns an empty string when the size is unknown", () => {
    expect(formatFileSize(null)).toBe("");
  });

  it("uses bytes below 1 KB", () => {
    expect(formatFileSize(0)).toBe("0 B");
    expect(formatFileSize(999)).toBe("999 B");
  });

  it("uses KB / MB / GB with one decimal below 10 and none above", () => {
    expect(formatFileSize(1024)).toBe("1.0 KB");
    expect(formatFileSize(1536)).toBe("1.5 KB");
    expect(formatFileSize(20 * 1024)).toBe("20 KB");
    expect(formatFileSize(5.25 * 1024 * 1024)).toBe("5.3 MB");
    expect(formatFileSize(3 * 1024 ** 3)).toBe("3.0 GB");
  });
});
