// Tests for step 10.24 — written before implementation (TDD)
//
// Capsule cards now show key field values; a stored value is shown the way a
// person reads it, not as stored ("true", '["a","b"]', "2026-10-05").
import type { CapsuleField, FieldType } from "../index";
import { formatDateValue, formatFieldValue } from "../index";

const field = (fieldType: FieldType): CapsuleField => ({
  id: "f",
  capsuleTypeId: "t",
  name: "Field",
  fieldType,
  config: null,
  sortOrder: 0,
  required: false,
  createdAt: 0,
  updatedAt: 0,
});

describe("formatFieldValue", () => {
  it("is null for empty values", () => {
    expect(formatFieldValue(field("text"), null)).toBeNull();
    expect(formatFieldValue(field("text"), "   ")).toBeNull();
    expect(formatFieldValue(field("multi_select"), "[]")).toBeNull();
  });

  it("shows text, numbers and single selects as written (first line, trimmed)", () => {
    expect(formatFieldValue(field("text"), " Frank Herbert ")).toBe(
      "Frank Herbert",
    );
    expect(formatFieldValue(field("long_text"), "Line one\nline two")).toBe(
      "Line one",
    );
    expect(formatFieldValue(field("number"), "412")).toBe("412");
    expect(formatFieldValue(field("single_select"), "Reading")).toBe("Reading");
  });

  it("reads booleans, multi selects and dates", () => {
    expect(formatFieldValue(field("boolean"), "true")).toBe("Yes");
    expect(formatFieldValue(field("boolean"), "false")).toBe("No");
    expect(
      formatFieldValue(field("multi_select"), '["Sci-fi","Classic"]'),
    ).toBe("Sci-fi, Classic");
    expect(formatFieldValue(field("date"), "2026-10-05")).toBe("5 Oct 2026");
  });

  it("has nothing to show for relations and attachments (they live elsewhere)", () => {
    expect(formatFieldValue(field("relation"), "x")).toBeNull();
    expect(formatFieldValue(field("attachment"), "x")).toBeNull();
  });
});

describe("formatDateValue", () => {
  it("shows anything that isn't a real date as stored", () => {
    expect(formatDateValue("2026-13-45")).toBe("2026-13-45");
  });
});
