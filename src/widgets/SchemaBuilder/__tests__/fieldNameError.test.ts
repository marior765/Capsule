// Tests for step 10.21 — written before implementation (TDD)
import { readFileSync } from "fs";
import { join } from "path";
import { newFieldNameError } from "../fieldNameError";

const fields = [{ id: "f1", name: "Author" }];

describe("newFieldNameError", () => {
  it("explains a duplicate name", () => {
    expect(newFieldNameError(fields, "author")).toBe(
      'There\'s already a field called "Author".',
    );
  });

  it("is null for an empty draft (nothing to complain about yet) or a new name", () => {
    expect(newFieldNameError(fields, "   ")).toBeNull();
    expect(newFieldNameError(fields, "Genre")).toBeNull();
  });
});

describe("SchemaBuilder (static)", () => {
  const src = readFileSync(join(__dirname, "../SchemaBuilder.tsx"), "utf8");

  it("shows the duplicate-name message and won't add the field", () => {
    expect(src).toMatch(/testIDs\.texts\.fieldNameError/);
    expect(src).toMatch(/newFieldNameError\(/);
  });

  it("reserves both arrow slots on every row so the Required column aligns", () => {
    expect(src).not.toMatch(/\{index > 0 &&/);
    expect(src).not.toMatch(/\{index < fields\.length - 1 &&/);
    expect(src.match(/<View style=\{styles\.moveSlot\} \/>/g)).toHaveLength(2);
  });

  it("labels the per-field switch visibly", () => {
    expect(src).toMatch(/>\s*Required\s*</);
  });
});
