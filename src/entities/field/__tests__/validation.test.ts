// Tests for step 6.10 — written before implementation (TDD)
import type { CapsuleField } from "../model";
import { validateFieldValue } from "../validation";

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

describe("validateFieldValue — required", () => {
  it("passes an optional field with no value", () => {
    const field = makeField({ required: false, fieldType: "text" });
    expect(validateFieldValue(field, null)).toEqual({ valid: true });
  });

  it("fails a required field with a null value", () => {
    const field = makeField({ required: true, name: "Title" });
    expect(validateFieldValue(field, null)).toEqual({
      valid: false,
      error: "Title is required",
    });
  });

  it("fails a required field with an empty-string value", () => {
    const field = makeField({ required: true, name: "Title" });
    expect(validateFieldValue(field, "")).toEqual({
      valid: false,
      error: "Title is required",
    });
  });

  it("fails a required field with a whitespace-only value", () => {
    const field = makeField({ required: true, name: "Title" });
    expect(validateFieldValue(field, "   ")).toEqual({
      valid: false,
      error: "Title is required",
    });
  });

  it("passes a required field with a real value", () => {
    const field = makeField({ required: true, fieldType: "text" });
    expect(validateFieldValue(field, "Dune")).toEqual({ valid: true });
  });
});

describe("validateFieldValue — number", () => {
  it("passes a valid numeric string", () => {
    const field = makeField({ fieldType: "number" });
    expect(validateFieldValue(field, "42")).toEqual({ valid: true });
  });

  it("passes a null value on an optional number field", () => {
    const field = makeField({ fieldType: "number", required: false });
    expect(validateFieldValue(field, null)).toEqual({ valid: true });
  });

  it("fails a non-numeric string", () => {
    const field = makeField({ fieldType: "number", name: "Year" });
    expect(validateFieldValue(field, "not-a-number")).toEqual({
      valid: false,
      error: "Year must be a number",
    });
  });

  it("passes negative and decimal numbers", () => {
    const field = makeField({ fieldType: "number" });
    expect(validateFieldValue(field, "-3.5")).toEqual({ valid: true });
  });

  it("enforces a configured minimum", () => {
    const field = makeField({
      fieldType: "number",
      name: "Rating",
      config: JSON.stringify({ min: 1 }),
    });
    expect(validateFieldValue(field, "0")).toEqual({
      valid: false,
      error: "Rating must be at least 1",
    });
    expect(validateFieldValue(field, "1")).toEqual({ valid: true });
  });

  it("enforces a configured maximum", () => {
    const field = makeField({
      fieldType: "number",
      name: "Rating",
      config: JSON.stringify({ max: 5 }),
    });
    expect(validateFieldValue(field, "6")).toEqual({
      valid: false,
      error: "Rating must be at most 5",
    });
    expect(validateFieldValue(field, "5")).toEqual({ valid: true });
  });

  it("applies no range restriction when config has none", () => {
    const field = makeField({ fieldType: "number" });
    expect(validateFieldValue(field, "999999")).toEqual({ valid: true });
  });
});

describe("validateFieldValue — date", () => {
  it("passes a well-formed date string", () => {
    const field = makeField({ fieldType: "date" });
    expect(validateFieldValue(field, "2026-08-21")).toEqual({ valid: true });
  });

  it("passes a null value on an optional date field", () => {
    const field = makeField({ fieldType: "date", required: false });
    expect(validateFieldValue(field, null)).toEqual({ valid: true });
  });

  it("fails an unparseable date string", () => {
    const field = makeField({ fieldType: "date", name: "Published" });
    expect(validateFieldValue(field, "not-a-date")).toEqual({
      valid: false,
      error: "Published must be a valid date",
    });
  });
});

describe("validateFieldValue — single_select", () => {
  it("passes a value that matches a configured option", () => {
    const field = makeField({
      fieldType: "single_select",
      config: JSON.stringify({ options: ["Fiction", "Non-fiction"] }),
    });
    expect(validateFieldValue(field, "Fiction")).toEqual({ valid: true });
  });

  it("fails a value that is not among the configured options", () => {
    const field = makeField({
      fieldType: "single_select",
      name: "Genre",
      config: JSON.stringify({ options: ["Fiction", "Non-fiction"] }),
    });
    expect(validateFieldValue(field, "Poetry")).toEqual({
      valid: false,
      error: "Poetry is not a valid option for Genre",
    });
  });

  it("passes any value when no options are configured yet — nothing to validate against", () => {
    const field = makeField({ fieldType: "single_select", config: null });
    expect(validateFieldValue(field, "anything")).toEqual({ valid: true });
  });
});

describe("validateFieldValue — multi_select", () => {
  it("passes when every selected value matches a configured option", () => {
    const field = makeField({
      fieldType: "multi_select",
      config: JSON.stringify({ options: ["Fiction", "Sci-fi", "Fantasy"] }),
    });
    const value = JSON.stringify(["Fiction", "Sci-fi"]);
    expect(validateFieldValue(field, value)).toEqual({ valid: true });
  });

  it("fails when any selected value is not among the configured options", () => {
    const field = makeField({
      fieldType: "multi_select",
      name: "Genres",
      config: JSON.stringify({ options: ["Fiction", "Sci-fi"] }),
    });
    const value = JSON.stringify(["Fiction", "Poetry"]);
    expect(validateFieldValue(field, value)).toEqual({
      valid: false,
      error: "Poetry is not a valid option for Genres",
    });
  });

  it("passes any selection when no options are configured yet", () => {
    const field = makeField({ fieldType: "multi_select", config: null });
    const value = JSON.stringify(["anything"]);
    expect(validateFieldValue(field, value)).toEqual({ valid: true });
  });
});

describe("validateFieldValue — boolean, text, long_text", () => {
  it("boolean always passes regardless of value", () => {
    const field = makeField({ fieldType: "boolean" });
    expect(validateFieldValue(field, "true")).toEqual({ valid: true });
    expect(validateFieldValue(field, "false")).toEqual({ valid: true });
  });

  it("text has no type constraint beyond required", () => {
    const field = makeField({ fieldType: "text" });
    expect(validateFieldValue(field, "anything at all")).toEqual({
      valid: true,
    });
  });

  it("long_text has no type constraint beyond required", () => {
    const field = makeField({ fieldType: "long_text" });
    expect(validateFieldValue(field, "a\nmulti\nline\nvalue")).toEqual({
      valid: true,
    });
  });
});

describe("validateFieldValue — relation, attachment", () => {
  it("relation always passes — it never has a CapsuleValue to validate here (entities/link's job)", () => {
    const field = makeField({ fieldType: "relation", required: true });
    expect(validateFieldValue(field, null)).toEqual({ valid: true });
  });

  it("attachment always passes — it never has a CapsuleValue to validate here (entities/attachment's job)", () => {
    const field = makeField({ fieldType: "attachment", required: true });
    expect(validateFieldValue(field, null)).toEqual({ valid: true });
  });
});
