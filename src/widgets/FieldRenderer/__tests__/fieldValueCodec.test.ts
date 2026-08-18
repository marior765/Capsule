// Tests for step 6.2 — written before implementation (TDD)
import {
  parseSelectOptions,
  parseBooleanValue,
  serializeBooleanValue,
  parseMultiSelectValue,
  serializeMultiSelectValue,
} from "../fieldValueCodec";

describe("parseSelectOptions", () => {
  it("parses a valid options config", () => {
    const config = JSON.stringify({ options: ["Fiction", "Non-fiction"] });
    expect(parseSelectOptions(config)).toEqual(["Fiction", "Non-fiction"]);
  });

  it("returns an empty array for null config", () => {
    expect(parseSelectOptions(null)).toEqual([]);
  });

  it("returns an empty array for malformed JSON, never throws", () => {
    expect(() => parseSelectOptions("not json")).not.toThrow();
    expect(parseSelectOptions("not json")).toEqual([]);
  });

  it("returns an empty array when the options key is missing", () => {
    expect(parseSelectOptions(JSON.stringify({ other: "thing" }))).toEqual([]);
  });

  it("returns an empty array when options is not an array", () => {
    expect(
      parseSelectOptions(JSON.stringify({ options: "not-array" })),
    ).toEqual([]);
  });

  it("filters out non-string entries rather than crashing on mixed data", () => {
    const config = JSON.stringify({ options: ["Fiction", 42, null, "Sci-fi"] });
    expect(parseSelectOptions(config)).toEqual(["Fiction", "Sci-fi"]);
  });
});

describe("parseBooleanValue / serializeBooleanValue", () => {
  it("parses 'true' as true", () => {
    expect(parseBooleanValue("true")).toBe(true);
  });

  it("parses 'false' as false", () => {
    expect(parseBooleanValue("false")).toBe(false);
  });

  it("parses null as false — an unset boolean field defaults to false", () => {
    expect(parseBooleanValue(null)).toBe(false);
  });

  it("parses any other unexpected string as false, never throws", () => {
    expect(parseBooleanValue("garbage")).toBe(false);
  });

  it("round-trips true and false through serialize/parse", () => {
    expect(parseBooleanValue(serializeBooleanValue(true))).toBe(true);
    expect(parseBooleanValue(serializeBooleanValue(false))).toBe(false);
  });
});

describe("parseMultiSelectValue / serializeMultiSelectValue", () => {
  it("round-trips a list of selections", () => {
    const values = ["Fiction", "Sci-fi"];
    expect(parseMultiSelectValue(serializeMultiSelectValue(values))).toEqual(
      values,
    );
  });

  it("parses null as an empty selection", () => {
    expect(parseMultiSelectValue(null)).toEqual([]);
  });

  it("parses malformed JSON as an empty selection, never throws", () => {
    expect(() => parseMultiSelectValue("not json")).not.toThrow();
    expect(parseMultiSelectValue("not json")).toEqual([]);
  });

  it("parses a non-array JSON value as an empty selection", () => {
    expect(parseMultiSelectValue(JSON.stringify({ not: "an array" }))).toEqual(
      [],
    );
  });

  it("filters out non-string entries", () => {
    const malformed = JSON.stringify(["Fiction", 42, null, "Sci-fi"]);
    expect(parseMultiSelectValue(malformed)).toEqual(["Fiction", "Sci-fi"]);
  });

  it("serializes an empty selection as an empty array, not null", () => {
    expect(serializeMultiSelectValue([])).toBe("[]");
  });
});
