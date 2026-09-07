// Tests for step 7.2 — written before implementation (TDD)
import type { Capsule } from "@/entities/capsule";
import type { CapsuleType } from "@/entities/capsule-type";
import type { CapsuleField } from "@/entities/field";
import { buildCapsuleText } from "../buildCapsuleText";

const capsule: Capsule = {
  id: "c-1",
  capsuleTypeId: "ct-1",
  title: "Dune",
  createdAt: 1000,
  updatedAt: 1000,
};

const bookType: CapsuleType = {
  id: "ct-1",
  name: "Book",
  description: null,
  createdAt: 1000,
  updatedAt: 1000,
};

const makeField = (overrides: Partial<CapsuleField> = {}): CapsuleField => ({
  id: "f-1",
  capsuleTypeId: "ct-1",
  name: "Field",
  fieldType: "text",
  config: null,
  sortOrder: 0,
  required: false,
  createdAt: 1000,
  updatedAt: 1000,
  ...overrides,
});

describe("buildCapsuleText", () => {
  it("includes the capsule's title", () => {
    const text = buildCapsuleText(capsule, bookType, [], {});
    expect(text).toContain("Dune");
  });

  it("includes the capsule type's name", () => {
    const text = buildCapsuleText(capsule, bookType, [], {});
    expect(text).toContain("Book");
  });

  it("falls back gracefully when the type is missing (deleted CapsuleType)", () => {
    expect(() => buildCapsuleText(capsule, null, [], {})).not.toThrow();
  });

  it("includes each field's name and value", () => {
    const fields = [
      makeField({ id: "f-author", name: "Author" }),
      makeField({ id: "f-year", name: "Year", fieldType: "number" }),
    ];
    const values = { "f-author": "Frank Herbert", "f-year": "1965" };
    const text = buildCapsuleText(capsule, bookType, fields, values);
    expect(text).toContain("Author");
    expect(text).toContain("Frank Herbert");
    expect(text).toContain("Year");
    expect(text).toContain("1965");
  });

  it("skips a field with no value rather than embedding a noisy 'Field: '", () => {
    const fields = [makeField({ id: "f-notes", name: "Notes" })];
    const text = buildCapsuleText(capsule, bookType, fields, {
      "f-notes": null,
    });
    expect(text).not.toContain("Notes");
  });

  it("skips a field entirely absent from the values map, same as an explicit null", () => {
    const fields = [makeField({ id: "f-notes", name: "Notes" })];
    const text = buildCapsuleText(capsule, bookType, fields, {});
    expect(text).not.toContain("Notes");
  });

  it("skips relation and attachment fields — they have no CapsuleValue to embed as text", () => {
    const fields = [
      makeField({ id: "f-author", name: "Author", fieldType: "relation" }),
      makeField({ id: "f-photo", name: "Photo", fieldType: "attachment" }),
    ];
    const text = buildCapsuleText(capsule, bookType, fields, {
      "f-author": "should never appear",
      "f-photo": "should never appear either",
    });
    expect(text).not.toContain("should never appear");
  });

  it("produces deterministic output for the same input — same capsule, same text, every time", () => {
    const fields = [makeField({ id: "f-author", name: "Author" })];
    const values = { "f-author": "Frank Herbert" };
    const first = buildCapsuleText(capsule, bookType, fields, values);
    const second = buildCapsuleText(capsule, bookType, fields, values);
    expect(first).toBe(second);
  });
});
