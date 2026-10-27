// Tests for step 10.28 — written before implementation (TDD)
import { readFileSync } from "fs";
import { join } from "path";
import { describeChanges } from "../describeChanges";

describe("describeChanges", () => {
  it("shows a single change as before → after", () => {
    expect(
      describeChanges([
        { label: "Author", before: "F. Herbert", after: "Frank Herbert" },
      ]),
    ).toBe("Edited Author: F. Herbert → Frank Herbert");
  });

  it("says when a value was set or cleared", () => {
    expect(
      describeChanges([{ label: "Read", before: null, after: "Yes" }]),
    ).toBe("Set Read: Yes");
    expect(
      describeChanges([{ label: "Read", before: "Yes", after: null }]),
    ).toBe("Cleared Read");
  });

  it("lists names when several things changed", () => {
    expect(
      describeChanges([
        { label: "Title", before: "a", after: "b" },
        { label: "Author", before: "c", after: "d" },
        { label: "Pages", before: null, after: "1" },
      ]),
    ).toBe("Edited Title, Author, Pages");
  });

  it("shortens long values", () => {
    const long = "x".repeat(60);
    expect(
      describeChanges([{ label: "Notes", before: null, after: long }]),
    ).toBe(`Set Notes: ${"x".repeat(29)}…`);
  });

  it("doesn't show 'a → a' when only invisible details changed", () => {
    expect(
      describeChanges([{ label: "Author", before: "F", after: "F" }]),
    ).toBe("Edited Author");
  });

  it("doesn't say Cleared when both sides read as empty", () => {
    expect(
      describeChanges([{ label: "Genres", before: null, after: null }]),
    ).toBe("Edited Genres");
  });

  it("has a plain line for an entry with no differences", () => {
    expect(describeChanges([])).toBe("No changes");
  });
});

describe("VersionHistory (static)", () => {
  const src = readFileSync(join(__dirname, "../VersionHistory.tsx"), "utf8");
  it("shows the change line under each version", () => {
    expect(src).toMatch(/describeChanges\(/);
    expect(src).toMatch(/testIDs\.texts\.changes/);
  });
});
