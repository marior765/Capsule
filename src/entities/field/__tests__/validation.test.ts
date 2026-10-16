// Tests for step 6.10 — written before implementation (TDD)
// validateFields: new for 6.10's route-wiring beat.
import type { CapsuleField } from "../model";
import { validateFieldValue, validateFields } from "../validation";

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
      error: "Published must be a valid date (YYYY-MM-DD)",
    });
  });
});

// 10.2: found in the simulator — "2026-13-45" passed validation and was
// saved. `Date.parse` is engine-dependent: Hermes (the app's engine) accepts
// it, V8 (Jest's) doesn't, and both roll "2026-02-30" over into March. The
// check must be a real calendar check, independent of the JS engine.
describe("validateFieldValue — date is a real calendar date (10.2)", () => {
  const field = makeField({ fieldType: "date", name: "Finished" });
  const invalid = {
    valid: false,
    error: "Finished must be a valid date (YYYY-MM-DD)",
  };

  it.each([
    ["month 13", "2026-13-45"],
    ["month 00", "2026-00-10"],
    ["day 00", "2026-05-00"],
    ["Feb 30", "2026-02-30"],
    ["Feb 29 in a non-leap year", "2026-02-29"],
    ["Feb 29 in a century non-leap year", "1900-02-29"],
    ["Apr 31", "2026-04-31"],
    ["unpadded parts", "2026-1-5"],
    ["day-first order", "21-08-2026"],
    ["slashes", "2026/08/21"],
    ["trailing junk", "2026-08-21abc"],
    ["a bare year", "2026"],
  ])("fails %s (%s)", (_label, value) => {
    expect(validateFieldValue(field, value)).toEqual(invalid);
  });

  it.each([
    ["an ordinary date", "2026-08-21"],
    ["Feb 29 in a leap year", "2028-02-29"],
    ["Feb 29 in a 400-year leap year", "2000-02-29"],
    ["Dec 31", "2026-12-31"],
    ["an ISO timestamp", "2026-08-21T10:15:00Z"],
    ["an ISO timestamp with offset", "2026-08-21T10:15:00.000+05:00"],
    ["surrounding whitespace", " 2026-08-21 "],
  ])("passes %s (%s)", (_label, value) => {
    expect(validateFieldValue(field, value)).toEqual({ valid: true });
  });

  it("fails a timestamp whose calendar date is impossible", () => {
    expect(validateFieldValue(field, "2026-02-30T10:00:00Z")).toEqual(invalid);
  });

  it("doesn't depend on Date.parse", () => {
    const spy = jest.spyOn(Date, "parse").mockReturnValue(0);
    try {
      expect(validateFieldValue(field, "2026-13-45")).toEqual(invalid);
    } finally {
      spy.mockRestore();
    }
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

describe("validateFields", () => {
  it("returns an empty object when every field is valid", () => {
    const fields = [
      makeField({ id: "f-title", required: true }),
      makeField({ id: "f-count", fieldType: "number" }),
    ];
    const values = { "f-title": "Dune", "f-count": "5" };
    expect(validateFields(fields, values)).toEqual({});
  });

  it("collects one error per invalid field, keyed by fieldId", () => {
    const fields = [
      makeField({ id: "f-title", name: "Title", required: true }),
      makeField({ id: "f-count", name: "Count", fieldType: "number" }),
    ];
    const values = { "f-title": null, "f-count": "not-a-number" };
    expect(validateFields(fields, values)).toEqual({
      "f-title": "Title is required",
      "f-count": "Count must be a number",
    });
  });

  it("only reports the fields that are actually invalid, not every field", () => {
    const fields = [
      makeField({ id: "f-title", name: "Title", required: true }),
      makeField({ id: "f-count", name: "Count", fieldType: "number" }),
    ];
    const values = { "f-title": "Dune", "f-count": "not-a-number" };
    expect(validateFields(fields, values)).toEqual({
      "f-count": "Count must be a number",
    });
  });

  it("treats a field missing from the values map as null, not a crash", () => {
    const fields = [makeField({ id: "f-title", required: true })];
    expect(validateFields(fields, {})).toEqual({
      "f-title": "Field is required",
    });
  });

  it("returns an empty object for an empty field list", () => {
    expect(validateFields([], {})).toEqual({});
  });
});
