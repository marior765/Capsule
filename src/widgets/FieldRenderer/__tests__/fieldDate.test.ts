// Tests for step 10.22 — written before implementation (TDD)
//
// Found in the simulator: date fields were a free-text box asking for
// YYYY-MM-DD. They now open a date picker; these helpers translate between
// the stored "YYYY-MM-DD" value and the picker's Date.
import { readFileSync } from "fs";
import { join } from "path";
import {
  dateValueFromLocal,
  dateValueFromUtc,
  formatDateValue,
  pickerStartDate,
} from "../fieldDate";

describe("dateValueFromLocal (iOS calendar answers in local time)", () => {
  it("stores the local calendar day, zero-padded", () => {
    expect(dateValueFromLocal(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
    expect(dateValueFromLocal(new Date(2026, 10, 30, 0, 1))).toBe("2026-11-30");
  });
});

describe("dateValueFromUtc (Android's dialog answers midnight UTC)", () => {
  it("reads the day with the UTC getters, never the previous local day", () => {
    expect(dateValueFromUtc(new Date(Date.UTC(2026, 2, 1)))).toBe("2026-03-01");
  });
});

describe("pickerStartDate", () => {
  const today = new Date(2026, 9, 25, 14, 30);

  it("opens on the stored day", () => {
    const d = pickerStartDate("2024-02-29", today);
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2024, 1, 29]);
  });

  it("opens on today when empty or not a real date (e.g. old free text)", () => {
    for (const value of [null, "", "next tuesday", "2026-02-30"]) {
      const d = pickerStartDate(value, today);
      expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([
        2026, 9, 25,
      ]);
    }
  });

  it("ignores a time part after the date", () => {
    const d = pickerStartDate("2026-07-04T10:00:00Z", today);
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 6, 4]);
  });
});

describe("formatDateValue", () => {
  it("shows a readable day", () => {
    expect(formatDateValue("2026-10-05")).toBe("5 Oct 2026");
  });

  it("shows anything else as it was typed, so old values stay visible", () => {
    expect(formatDateValue("next tuesday")).toBe("next tuesday");
  });
});

describe("date field wiring (static)", () => {
  const renderer = readFileSync(
    join(__dirname, "../FieldRenderer.tsx"),
    "utf8",
  );
  const input = readFileSync(join(__dirname, "../FieldDateInput.tsx"), "utf8");

  it("no longer asks for YYYY-MM-DD in a text box", () => {
    expect(renderer).not.toMatch(/placeholder="YYYY-MM-DD"/);
    expect(renderer).toMatch(/<FieldDateInput/);
  });

  it("uses the native date picker and offers Clear", () => {
    expect(input).toMatch(/mode="date"/);
    expect(input).toMatch(/testIDs\.buttons\.clear/);
    expect(input).toMatch(/dateValueFromUtc\(/);
    expect(input).toMatch(/dateValueFromLocal\(/);
  });
});
