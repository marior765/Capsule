// Tests for step 10.24 — written before implementation (TDD)
import { readFileSync } from "fs";
import { join } from "path";
import { listSubtitle, visibleTags } from "../cardSummary";

const preview = {
  tags: ["classic", "desert", "sci-fi", "space"],
  fields: [
    { name: "Author", value: "Frank Herbert" },
    { name: "Finished", value: "14 Oct 2026" },
    { name: "Pages", value: "412" },
  ],
};

describe("listSubtitle (the list row's one dense line)", () => {
  it("is the type then the first two values, dot-separated", () => {
    expect(listSubtitle("Book", preview)).toBe(
      "Book · Frank Herbert · 14 Oct 2026",
    );
  });

  it("falls back to the type alone, and to 'Unknown type'", () => {
    expect(listSubtitle("Book", { tags: [], fields: [] })).toBe("Book");
    expect(listSubtitle(null, undefined)).toBe("Unknown type");
  });
});

describe("visibleTags", () => {
  it("shows up to the limit and counts the rest", () => {
    expect(visibleTags(preview.tags, 3)).toEqual({
      shown: ["classic", "desert", "sci-fi"],
      more: 1,
    });
    expect(visibleTags(["a"], 3)).toEqual({ shown: ["a"], more: 0 });
  });
});

describe("CapsuleCard (static)", () => {
  const src = readFileSync(join(__dirname, "../CapsuleCard.tsx"), "utf8");

  it("renders tags and field values, labelled in card view", () => {
    expect(src).toMatch(/listSubtitle\(/);
    expect(src).toMatch(/visibleTags\(/);
    expect(src).toMatch(/testIDs\.texts\.fields/);
    expect(src).toMatch(/testIDs\.texts\.tags/);
    expect(src).toMatch(/\{field\.name\}/);
  });
});

describe("CapsuleList passes previews through (static)", () => {
  const src = readFileSync(
    join(__dirname, "../../CapsuleList/CapsuleList.tsx"),
    "utf8",
  );
  it("hands each card its preview", () => {
    expect(src).toMatch(/preview=\{previewsById\?\.\[item\.id\]\}/);
  });
});
