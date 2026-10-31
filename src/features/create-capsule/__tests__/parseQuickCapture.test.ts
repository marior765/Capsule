// Tests for step 10.43 — written before implementation (TDD)
//
// Found in the simulator: typing "Dune by Frank Herbert" into quick capture
// put the whole string in the title and left Author empty. The user chose
// simple deterministic patterns (no model): "X by Y" fills an author-like
// text field, a trailing "(1965)" fills a Year number field. Anything that
// doesn't match, or a type without such a field, keeps the whole text as the
// title, so nothing the user typed is lost.
import type { CapsuleField, FieldType } from "@/entities/field";
import { parseQuickCapture } from "../index";

let nextId = 0;
const field = (name: string, fieldType: FieldType = "text"): CapsuleField => ({
  id: `f${++nextId}`,
  capsuleTypeId: "book",
  name,
  fieldType,
  config: null,
  sortOrder: nextId,
  required: false,
  createdAt: 0,
  updatedAt: 0,
});

const author = field("Author");
const year = field("Year", "number");
const notes = field("Notes", "long_text");
const book = [author, year, notes];

describe("parseQuickCapture (10.43)", () => {
  it('splits "X by Y" into the title and the Author field', () => {
    expect(parseQuickCapture("Dune by Frank Herbert", book)).toEqual({
      title: "Dune",
      values: { [author.id]: "Frank Herbert" },
    });
  });

  it('splits on the LAST " by ", so a title may contain "by"', () => {
    expect(parseQuickCapture("Stand by Me by Stephen King", book)).toEqual({
      title: "Stand by Me",
      values: { [author.id]: "Stephen King" },
    });
  });

  it("matches the word case-insensitively and trims both sides", () => {
    expect(parseQuickCapture("  Dune   BY  Frank Herbert ", book)).toEqual({
      title: "Dune",
      values: { [author.id]: "Frank Herbert" },
    });
  });

  it("fills a trailing (year) into a number field named Year", () => {
    expect(parseQuickCapture("Dune (1965)", book)).toEqual({
      title: "Dune",
      values: { [year.id]: "1965" },
    });
  });

  it("combines both patterns", () => {
    expect(parseQuickCapture("Dune by Frank Herbert (1965)", book)).toEqual({
      title: "Dune",
      values: { [author.id]: "Frank Herbert", [year.id]: "1965" },
    });
  });

  it.each([
    ["Artist", "Kind of Blue by Miles Davis", "Kind of Blue", "Miles Davis"],
    ["creator", "Tetris by Alexey Pajitnov", "Tetris", "Alexey Pajitnov"],
    ["Writer", "Dune by Frank Herbert", "Dune", "Frank Herbert"],
    ["Director", "Alien by Ridley Scott", "Alien", "Ridley Scott"],
    [" by ", "Dune by Frank Herbert", "Dune", "Frank Herbert"],
  ])(
    "recognises a field named %p as the 'by' field",
    (name, text, title, who) => {
      const f = field(name);
      expect(parseQuickCapture(text, [f])).toEqual({
        title,
        values: { [f.id]: who },
      });
    },
  );

  describe("keeps the whole text as the title when it can't be sure", () => {
    it("no pattern in the text", () => {
      expect(parseQuickCapture("Buy milk", book)).toEqual({
        title: "Buy milk",
        values: {},
      });
    });

    it("the type has no author-like field", () => {
      expect(parseQuickCapture("Dune by Frank Herbert", [notes])).toEqual({
        title: "Dune by Frank Herbert",
        values: {},
      });
    });

    it("the author-like field isn't a text field", () => {
      const select = field("Author", "single_select");
      expect(parseQuickCapture("Dune by Frank Herbert", [select])).toEqual({
        title: "Dune by Frank Herbert",
        values: {},
      });
    });

    it("more than one author-like field (ambiguous)", () => {
      const a = field("Author");
      const b = field("Artist");
      expect(parseQuickCapture("Dune by Frank Herbert", [a, b])).toEqual({
        title: "Dune by Frank Herbert",
        values: {},
      });
    });

    it('either side of "by" is empty', () => {
      expect(parseQuickCapture("by Frank Herbert", book).title).toBe(
        "by Frank Herbert",
      );
      expect(parseQuickCapture("Dune by", book).title).toBe("Dune by");
    });

    it('"by" inside a word', () => {
      expect(parseQuickCapture("Abbey Road", book)).toEqual({
        title: "Abbey Road",
        values: {},
      });
      expect(parseQuickCapture("Lullaby Song", book).values).toEqual({});
    });

    it("a trailing (year) when the type has no Year number field", () => {
      expect(parseQuickCapture("Dune (1965)", [author])).toEqual({
        title: "Dune (1965)",
        values: {},
      });
      const textYear = field("Year", "text");
      expect(parseQuickCapture("Dune (1965)", [textYear]).values).toEqual({});
    });

    it("a parenthesis that isn't a plausible year", () => {
      expect(parseQuickCapture("Dune (abridged)", book).title).toBe(
        "Dune (abridged)",
      );
      expect(parseQuickCapture("Dune (65)", book).title).toBe("Dune (65)");
      expect(parseQuickCapture("Dune (19650)", book).title).toBe(
        "Dune (19650)",
      );
    });

    it("the year is all there is", () => {
      expect(parseQuickCapture("(1965)", book)).toEqual({
        title: "(1965)",
        values: {},
      });
    });
  });

  // Reviewer finding (10.43): a filled value must pass the field's own rules,
  // or the capsule's next edit is refused over a value the user never typed
  // into that field. Out-of-range text stays in the title instead.
  describe("only fills values the field itself accepts", () => {
    const rangedYear: CapsuleField = {
      ...field("Year", "number"),
      config: JSON.stringify({ min: 1900, max: 2100 }),
    };

    it("leaves an out-of-range year in the title", () => {
      expect(parseQuickCapture("Old Book (1850)", [rangedYear])).toEqual({
        title: "Old Book (1850)",
        values: {},
      });
    });

    it("fills an in-range year", () => {
      expect(parseQuickCapture("New Book (1999)", [rangedYear])).toEqual({
        title: "New Book",
        values: { [rangedYear.id]: "1999" },
      });
    });
  });

  // Pinned on purpose: with an Author field, the last " by " always splits.
  // The value is editable afterwards, and nothing typed is lost.
  it('"Stand by Me" alone splits into title "Stand", Author "Me"', () => {
    expect(parseQuickCapture("Stand by Me", book)).toEqual({
      title: "Stand",
      values: { [author.id]: "Me" },
    });
  });

  it('treats tabs and non-breaking spaces around "by" as spaces', () => {
    expect(parseQuickCapture("Dune\tby\tFrank Herbert", book).values).toEqual({
      [author.id]: "Frank Herbert",
    });
    expect(
      parseQuickCapture("Dune\u00a0by\u00a0Frank Herbert", book).values,
    ).toEqual({ [author.id]: "Frank Herbert" });
  });

  it("accepts a year with no space before the parenthesis", () => {
    expect(parseQuickCapture("Dune(1965)", book)).toEqual({
      title: "Dune",
      values: { [year.id]: "1965" },
    });
  });

  it("trims the text when nothing matches", () => {
    expect(parseQuickCapture("  Buy milk  ", book).title).toBe("Buy milk");
  });
});

// The capsules screen is what quick capture runs on; it must go through
// captureQuickCapsule, or the patterns never reach the user.
describe("capsules screen wiring (10.43, static)", () => {
  const { readFileSync } = jest.requireActual<typeof import("fs")>("fs");
  const { join } = jest.requireActual<typeof import("path")>("path");
  const source = readFileSync(
    join(__dirname, "../../../app/(app)/(tabs)/capsules/index.tsx"),
    "utf8",
  );

  it("creates quick-captured capsules through captureQuickCapsule", () => {
    expect(source).toMatch(/captureQuickCapsule\(db,/);
    expect(source).not.toMatch(/\bcreateCapsule\(db, input\)/);
  });
});
