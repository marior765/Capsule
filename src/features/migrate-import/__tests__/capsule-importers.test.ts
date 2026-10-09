// Tests for step 5.4 (CSV / JSON / Markdown importers) — written before implementation (TDD)
import type { SQLiteDatabase } from "expo-sqlite";
import { openDb, runMigrations, _resetDbForTesting } from "@/shared/db";
import {
  capsuleTypesMigration,
  getAllCapsuleTypes,
} from "@/entities/capsule-type";
import {
  capsuleFieldsMigration,
  getFieldsByCapsuleType,
} from "@/entities/field";
import {
  capsuleParentIdMigration,
  capsuleValuesMigration,
  capsulesMigration,
  getAllCapsules,
  getValuesByCapsule,
} from "@/entities/capsule";
import {
  parseCsv,
  parseCsvTable,
  parseJsonTable,
  parseMarkdownNote,
  importCsv,
  importJsonRecords,
  importMarkdownNotes,
} from "../index";

let db: SQLiteDatabase;

beforeEach(() => {
  _resetDbForTesting();
  db = openDb();
  runMigrations(db, [
    capsuleTypesMigration,
    capsuleFieldsMigration,
    capsulesMigration,
    capsuleValuesMigration,
    capsuleParentIdMigration,
  ]);
});

/** Field name -> stored value for one capsule. */
function valuesByName(capsuleId: string): Record<string, string | null> {
  const capsule = getAllCapsules(db).find((c) => c.id === capsuleId)!;
  const fields = getFieldsByCapsuleType(db, capsule.capsuleTypeId);
  const out: Record<string, string | null> = {};
  for (const v of getValuesByCapsule(db, capsuleId)) {
    out[fields.find((f) => f.id === v.fieldId)!.name] = v.value;
  }
  return out;
}

describe("parseCsv — RFC 4180 tokenizing", () => {
  it("splits simple rows and columns", () => {
    expect(parseCsv("a,b\n1,2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("handles quoted fields containing commas, newlines, and escaped quotes", () => {
    expect(
      parseCsv('name,quote\n"Smith, J","He said ""hi""\nthen left"'),
    ).toEqual([
      ["name", "quote"],
      ["Smith, J", 'He said "hi"\nthen left'],
    ]);
  });

  it("accepts CRLF line endings and ignores a trailing newline", () => {
    expect(parseCsv("a,b\r\n1,2\r\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("strips a UTF-8 byte-order mark (Excel adds one)", () => {
    expect(parseCsv("﻿a,b\n1,2")[0]).toEqual(["a", "b"]);
  });

  it("keeps empty trailing fields", () => {
    expect(parseCsv("a,b,c\n1,,")).toEqual([
      ["a", "b", "c"],
      ["1", "", ""],
    ]);
  });

  it("treats a quote in the middle of an unquoted field as a literal character, never merging rows", () => {
    expect(parseCsv('name,height\nBob,6" tall\nAmy,5"\n')).toEqual([
      ["name", "height"],
      ["Bob", '6" tall'],
      ["Amy", '5"'],
    ]);
    expect(parseCsv('a,Bob "Bobby" Smith,c')).toEqual([
      ["a", 'Bob "Bobby" Smith', "c"],
    ]);
  });

  it("supports CR-only line endings", () => {
    expect(parseCsv("a,b\r1,2\r")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("emits a final row that is only a quoted empty field", () => {
    expect(parseCsv('h\n""')).toEqual([["h"], [""]]);
  });

  it("throws on an unterminated quoted field rather than guessing", () => {
    expect(() => parseCsv('a\n"oops')).toThrow(/unterminated/i);
  });
});

describe("parseCsvTable — header + rows", () => {
  it("uses the first row as columns and turns empty cells into null", () => {
    expect(parseCsvTable("Title,Year\nDune,1965\nEmpty,")).toEqual({
      columns: ["Title", "Year"],
      rows: [
        ["Dune", "1965"],
        ["Empty", null],
      ],
    });
  });

  it("treats whitespace-only cells as empty, so they don't block number inference", () => {
    expect(parseCsvTable("Title,Year\nA,   ").rows).toEqual([["A", null]]);
  });

  it("skips fully blank lines", () => {
    expect(parseCsvTable("Title\nA\n\nB").rows).toEqual([["A"], ["B"]]);
  });

  it("pads short rows and drops cells beyond the header", () => {
    expect(parseCsvTable("a,b\n1\n1,2,3").rows).toEqual([
      ["1", null],
      ["1", "2"],
    ]);
  });

  it("names blank headers and de-duplicates repeated ones", () => {
    expect(parseCsvTable("Name,,Name\nx,y,z").columns).toEqual([
      "Name",
      "Column 2",
      "Name (2)",
    ]);
  });

  it("throws on an empty file", () => {
    expect(() => parseCsvTable("")).toThrow(/empty/i);
  });
});

describe("parseJsonTable — array of flat records", () => {
  it("unions keys in first-seen order and stringifies scalars", () => {
    expect(
      parseJsonTable(
        JSON.stringify([
          { title: "Dune", pages: 412 },
          { title: "Emma", read: true, pages: null },
        ]),
      ),
    ).toEqual({
      columns: ["title", "pages", "read"],
      rows: [
        ["Dune", "412", null],
        ["Emma", null, "true"],
      ],
    });
  });

  it("serializes nested objects and arrays as JSON text instead of dropping them", () => {
    const table = parseJsonTable(
      JSON.stringify([{ title: "A", meta: { x: 1 }, tags: ["a", "b"] }]),
    );
    expect(table.rows[0]).toEqual(["A", '{"x":1}', '["a","b"]']);
  });

  it("rejects non-JSON, non-arrays, and arrays of non-objects", () => {
    expect(() => parseJsonTable("{")).toThrow(/valid JSON/);
    expect(() => parseJsonTable('{"a":1}')).toThrow(/array/);
    expect(() => parseJsonTable("[1,2]")).toThrow(/object/);
  });
});

describe("importCsv — rows become capsules of a new type", () => {
  it("creates one type named as given, one field per non-title column, one capsule per row", () => {
    const { type, capsules } = importCsv(
      db,
      "Title,Author,Pages\nDune,Herbert,412\nEmma,Austen,",
      "Books",
    );

    expect(type.name).toBe("Books");
    expect(getAllCapsuleTypes(db)).toHaveLength(1);
    expect(
      getFieldsByCapsuleType(db, type.id).map((f) => [f.name, f.sortOrder]),
    ).toEqual([
      ["Author", 0],
      ["Pages", 1],
    ]);
    expect(capsules.map((c) => c.title)).toEqual(["Dune", "Emma"]);
    expect(valuesByName(capsules[0].id)).toEqual({
      Author: "Herbert",
      Pages: "412",
    });
    // An empty cell writes no value row at all (unset), not an empty string.
    expect(valuesByName(capsules[1].id)).toEqual({ Author: "Austen" });
  });

  it("prefers a column named title/name (any case) for the capsule title", () => {
    const { type, capsules } = importCsv(db, "Id,NAME\n7,Alice", "People");
    expect(capsules[0].title).toBe("Alice");
    expect(getFieldsByCapsuleType(db, type.id).map((f) => f.name)).toEqual([
      "Id",
    ]);
  });

  it("falls back to 'Untitled' when a row's title cell is empty", () => {
    const { capsules } = importCsv(db, "Title,Note\n,hello", "T");
    expect(capsules[0].title).toBe("Untitled");
  });

  it("infers number, boolean, and long_text field types from the column's values", () => {
    const { type } = importCsv(
      db,
      'Title,Pages,Read,Notes,Isbn\nA,10,true,"line1\nline2",978-0\nB,2.5,false,short,',
      "T",
    );
    expect(
      getFieldsByCapsuleType(db, type.id).map((f) => [f.name, f.fieldType]),
    ).toEqual([
      ["Pages", "number"],
      ["Read", "boolean"],
      ["Notes", "long_text"],
      ["Isbn", "text"],
    ]);
  });

  it("imports a header-only CSV as a type with no capsules", () => {
    const { type, capsules } = importCsv(db, "Title,Author", "Empty");
    expect(capsules).toEqual([]);
    expect(getFieldsByCapsuleType(db, type.id)).toHaveLength(1);
  });
});

describe("importJsonRecords", () => {
  it("imports records like CSV rows, typing JSON numbers/booleans", () => {
    const { type, capsules } = importJsonRecords(
      db,
      JSON.stringify([
        { name: "Dune", pages: 412, owned: true },
        { name: "Emma", pages: 300, owned: false },
      ]),
      "Books",
    );
    expect(capsules.map((c) => c.title)).toEqual(["Dune", "Emma"]);
    expect(
      getFieldsByCapsuleType(db, type.id).map((f) => [f.name, f.fieldType]),
    ).toEqual([
      ["pages", "number"],
      ["owned", "boolean"],
    ]);
    expect(valuesByName(capsules[1].id)).toEqual({
      pages: "300",
      owned: "false",
    });
  });
});

describe("parseMarkdownNote", () => {
  it("takes the first level-1 heading as the title and removes it from the body", () => {
    expect(parseMarkdownNote("# Trip plan\n\n- pack\n- go\n", "file")).toEqual({
      title: "Trip plan",
      body: "- pack\n- go",
    });
  });

  it("uses the fallback name when there's no level-1 heading, keeping the full text", () => {
    expect(parseMarkdownNote("## Sub\ntext", "notes.md")).toEqual({
      title: "notes",
      body: "## Sub\ntext",
    });
  });

  it("keeps a trailing '#' that is part of the title text (CommonMark needs a space before closing hashes)", () => {
    expect(parseMarkdownNote("# C#\nbody", "x").title).toBe("C#");
    expect(parseMarkdownNote("# Title ##\nbody", "x").title).toBe("Title");
  });

  it("never takes a title from YAML front matter, and keeps the front matter in the body untouched", () => {
    const text = "---\n# yaml comment\ntitle: Real\n---\n# Real Title\nbody";
    expect(parseMarkdownNote(text, "x")).toEqual({
      title: "Real Title",
      body: "---\n# yaml comment\ntitle: Real\n---\nbody",
    });
  });

  it("only closes a fence with the same fence marker", () => {
    expect(
      parseMarkdownNote("~~~\n```\n# inside\n~~~\n# Outside", "x").title,
    ).toBe("Outside");
  });

  it("preserves leading indentation of the body (an indented code block stays code)", () => {
    expect(parseMarkdownNote("    code line\ntext", "x").body).toBe(
      "    code line\ntext",
    );
  });

  it("ignores a '# ' line inside a fenced code block", () => {
    expect(
      parseMarkdownNote("```sh\n# not a title\n```\nbody", "Doc").title,
    ).toBe("Doc");
  });
});

describe("importMarkdownNotes", () => {
  it("creates one 'Note' type with a long_text Body field and one capsule per note", () => {
    const { type, capsules } = importMarkdownNotes(db, [
      { name: "a.md", text: "# Alpha\nfirst" },
      { name: "b.md", text: "second" },
    ]);

    expect(type.name).toBe("Note");
    const fields = getFieldsByCapsuleType(db, type.id);
    expect(fields.map((f) => [f.name, f.fieldType])).toEqual([
      ["Body", "long_text"],
    ]);
    expect(capsules.map((c) => c.title)).toEqual(["Alpha", "b"]);
    expect(valuesByName(capsules[0].id)).toEqual({ Body: "first" });
    expect(valuesByName(capsules[1].id)).toEqual({ Body: "second" });
  });

  it("writes no Body value for a heading-only note", () => {
    const { capsules } = importMarkdownNotes(db, [
      { name: "x.md", text: "# Only a title\n" },
    ]);
    expect(valuesByName(capsules[0].id)).toEqual({});
  });
});
