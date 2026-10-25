// Tests for step 10.21 — written before implementation (TDD)
//
// Found in the simulator: a type could get two "Author" fields. Values are
// shown and exported by field name, so two fields with one name are
// indistinguishable everywhere after the form.
import { findFieldNameClash, normalizeFieldName } from "../index";

describe("normalizeFieldName", () => {
  it("ignores case and surrounding / repeated spaces", () => {
    expect(normalizeFieldName("  Author ")).toBe("author");
    expect(normalizeFieldName("Page   count")).toBe("page count");
  });
});

describe("findFieldNameClash", () => {
  const fields = [
    { id: "f1", name: "Author" },
    { id: "f2", name: "Page count" },
  ];

  it("finds an existing field with the same name, whatever the case", () => {
    expect(findFieldNameClash(fields, "author")?.id).toBe("f1");
    expect(findFieldNameClash(fields, " page  COUNT ")?.id).toBe("f2");
  });

  it("is null for a new name", () => {
    expect(findFieldNameClash(fields, "Genre")).toBeNull();
  });

  it("ignores the field being renamed itself", () => {
    expect(findFieldNameClash(fields, "Author", "f1")).toBeNull();
  });
});
