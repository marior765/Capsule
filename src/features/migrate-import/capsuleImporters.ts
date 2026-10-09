import type { SQLiteDatabase } from "expo-sqlite";
import { insertCapsuleType, type CapsuleType } from "@/entities/capsule-type";
import { insertCapsuleField, type FieldType } from "@/entities/field";
import {
  insertCapsule,
  upsertCapsuleValue,
  type Capsule,
} from "@/entities/capsule";
import { generateId } from "@/shared/lib";

/**
 * The CSV / JSON / Markdown half of 5.4's migration importers. Unlike the
 * ChatGPT importer (conversations), these formats carry structured or
 * note-style data, so they import into the capsule domain:
 *
 * - CSV and JSON are tabular: each row/record becomes one capsule under a
 *   NEW `CapsuleType` whose fields are the columns. The title comes from
 *   a column named "title"/"name" (any case) if present, else the first
 *   column; that column becomes the capsule's title and is not repeated
 *   as a field.
 * - Markdown is one note per document: each becomes a capsule of a new
 *   "Note" type with a single long_text "Body" field.
 *
 * Every import creates a fresh type rather than merging into an existing
 * one — same "import is new data" rule as `features/import-export`. There
 * is no column-mapping UI; the automatic mapping below is the default,
 * and the user can rename or retype fields afterwards in the schema
 * builder.
 *
 * Field types are inferred per column from its non-empty values: all
 * numeric → number, all "true"/"false" → boolean, any multi-line value →
 * long_text, otherwise text. Dates stay text — date formats in the wild
 * are too ambiguous to guess safely. An empty cell writes no value row
 * (unset), not an empty string.
 *
 * Pure parsing (`parseCsv`, `parseCsvTable`, `parseJsonTable`,
 * `parseMarkdownNote`) is separate from the db insert step, like
 * `parseChatGptExport`. No dependency: the CSV tokenizer is a small
 * RFC 4180-style parser (see `parseCsv` for its one deliberate
 * leniency). No audit entry — import isn't one of
 * CLAUDE.md's privacy-sensitive actions.
 */

export type ImportedTable = {
  columns: string[];
  rows: (string | null)[][];
};

export type CapsuleImportResult = {
  type: CapsuleType;
  capsules: Capsule[];
};

// --- CSV ---

/**
 * CSV tokenizer in the RFC 4180 style: quoted fields, `""` escapes,
 * embedded commas/newlines, CRLF / LF / CR line endings, BOM. Lenient in
 * one deliberate way: a `"` only opens a quoted field at the very start of
 * a field — anywhere else (`6" tall`, `Bob "Bobby" Smith`) it's a literal
 * character, so a stray quote in a real-world export can never silently
 * swallow the rest of the file into one cell.
 */
export function parseCsv(text: string): string[][] {
  const input = text.startsWith("﻿") ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  // True once anything (even an empty quoted field) was read on this row,
  // so a final row like `""` with no trailing newline is still emitted.
  let rowStarted = false;
  let fieldStarted = false;
  let i = 0;

  while (i < input.length) {
    const ch = input[i];
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }
    if (ch === '"' && !fieldStarted) {
      inQuotes = true;
      fieldStarted = true;
      rowStarted = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
      fieldStarted = false;
      rowStarted = true;
    } else if (ch === "\n" || ch === "\r") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      fieldStarted = false;
      rowStarted = false;
      if (ch === "\r" && input[i + 1] === "\n") i++;
    } else {
      field += ch;
      fieldStarted = true;
      rowStarted = true;
    }
    i++;
  }

  if (inQuotes) {
    throw new Error("Malformed CSV: unterminated quoted field");
  }
  // A trailing newline must not produce an extra empty row.
  if (rowStarted) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function normalizeColumns(raw: string[]): string[] {
  const counts = new Map<string, number>();
  return raw.map((name, index) => {
    const base = name.trim() || `Column ${index + 1}`;
    const seen = counts.get(base) ?? 0;
    counts.set(base, seen + 1);
    return seen === 0 ? base : `${base} (${seen + 1})`;
  });
}

/** First row = columns; blank lines skipped; rows padded/truncated to the header width. */
export function parseCsvTable(text: string): ImportedTable {
  const rows = parseCsv(text).filter((r) => r.some((cell) => cell !== ""));
  if (rows.length === 0) {
    throw new Error("CSV file is empty");
  }
  const columns = normalizeColumns(rows[0]);
  return {
    columns,
    rows: rows
      .slice(1)
      .map((r) =>
        columns.map((_, i) => (r[i] && r[i].trim() !== "" ? r[i] : null)),
      ),
  };
}

// --- JSON ---

function cellFromJson(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value.trim() === "" ? null : value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}

/** An array of plain objects; columns are the union of keys in first-seen order. */
export function parseJsonTable(json: string): ImportedTable {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new Error("Not valid JSON");
  }
  if (!Array.isArray(raw)) {
    throw new Error("Expected a JSON array of records");
  }
  const records = raw.map((item, index) => {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      throw new Error(`Record ${index + 1} is not an object`);
    }
    return item as Record<string, unknown>;
  });

  const columns: string[] = [];
  for (const record of records) {
    for (const key of Object.keys(record)) {
      if (!columns.includes(key)) columns.push(key);
    }
  }
  return {
    columns,
    rows: records.map((record) => columns.map((c) => cellFromJson(record[c]))),
  };
}

// --- Table -> capsules ---

const NUMBER_PATTERN = /^-?\d+(\.\d+)?$/;

function inferFieldType(values: (string | null)[]): FieldType {
  const present = values.filter((v): v is string => v !== null);
  if (present.length === 0) return "text";
  if (present.every((v) => NUMBER_PATTERN.test(v))) return "number";
  if (present.every((v) => v === "true" || v === "false")) return "boolean";
  if (present.some((v) => v.includes("\n"))) return "long_text";
  return "text";
}

function titleColumnIndex(columns: string[]): number {
  const named = columns.findIndex((c) => /^(title|name)$/i.test(c.trim()));
  return named === -1 ? 0 : named;
}

function createType(
  db: SQLiteDatabase,
  name: string,
  now: number,
): CapsuleType {
  const type: CapsuleType = {
    id: generateId(),
    name,
    description: null,
    createdAt: now,
    updatedAt: now,
  };
  insertCapsuleType(db, type);
  return type;
}

function importTable(
  db: SQLiteDatabase,
  table: ImportedTable,
  typeName: string,
): CapsuleImportResult {
  const now = Date.now();
  const type = createType(db, typeName, now);
  const titleIndex = titleColumnIndex(table.columns);

  const fieldColumns: { index: number; fieldId: string }[] = [];
  table.columns.forEach((name, index) => {
    if (index === titleIndex) return;
    const fieldId = generateId();
    insertCapsuleField(db, {
      id: fieldId,
      capsuleTypeId: type.id,
      name,
      fieldType: inferFieldType(table.rows.map((r) => r[index])),
      config: null,
      sortOrder: fieldColumns.length,
      required: false,
      createdAt: now,
      updatedAt: now,
    });
    fieldColumns.push({ index, fieldId });
  });

  const capsules = table.rows.map((row) => {
    const capsule: Capsule = {
      id: generateId(),
      capsuleTypeId: type.id,
      title: row[titleIndex]?.trim() || "Untitled",
      parentCapsuleId: null,
      createdAt: now,
      updatedAt: now,
    };
    insertCapsule(db, capsule);
    for (const { index, fieldId } of fieldColumns) {
      const value = row[index];
      if (value === null) continue;
      upsertCapsuleValue(db, {
        id: generateId(),
        capsuleId: capsule.id,
        fieldId,
        value,
        createdAt: now,
        updatedAt: now,
      });
    }
    return capsule;
  });

  return { type, capsules };
}

/** Imports a CSV file (header row required) as capsules of a new type named `typeName`. */
export function importCsv(
  db: SQLiteDatabase,
  text: string,
  typeName: string,
): CapsuleImportResult {
  return importTable(db, parseCsvTable(text), typeName);
}

/** Imports a JSON array of records as capsules of a new type named `typeName`. */
export function importJsonRecords(
  db: SQLiteDatabase,
  json: string,
  typeName: string,
): CapsuleImportResult {
  return importTable(db, parseJsonTable(json), typeName);
}

// --- Markdown ---

export type MarkdownNote = { title: string; body: string };

function stripExtension(name: string): string {
  return name.replace(/\.(md|markdown)$/i, "");
}

/** Removes blank lines at the start and end only — leading indentation is meaningful in Markdown. */
function trimBlankLines(lines: string[]): string {
  let from = 0;
  let to = lines.length;
  while (from < to && lines[from].trim() === "") from++;
  while (to > from && lines[to - 1].trim() === "") to--;
  return lines.slice(from, to).join("\n");
}

/**
 * Title = the first ATX level-1 heading (`# Title`, optional closing
 * `#`s only after a space, per CommonMark) that is outside YAML front
 * matter and outside fenced code blocks; that one line is removed from
 * the body. Without one, the title is `fallbackName` minus its .md
 * extension. Everything else — front matter included — is kept as-is;
 * only blank lines at the very start/end of the body are dropped.
 */
export function parseMarkdownNote(
  text: string,
  fallbackName: string,
): MarkdownNote {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");

  let start = 0;
  if (lines[0] === "---") {
    const close = lines.findIndex((l, i) => i > 0 && /^(---|\.\.\.)$/.test(l));
    if (close !== -1) start = close + 1;
  }

  let fence: { char: string; length: number } | null = null;
  for (let i = start; i < lines.length; i++) {
    const line = lines[i];
    const fenceMatch = /^ {0,3}(`{3,}|~{3,})/.exec(line);
    if (fenceMatch) {
      const marker = fenceMatch[1];
      if (fence === null) {
        fence = { char: marker[0], length: marker.length };
      } else if (marker[0] === fence.char && marker.length >= fence.length) {
        fence = null;
      }
      continue;
    }
    if (fence !== null) continue;
    const heading = /^ {0,3}#[ \t]+(.+?)(?:[ \t]+#+)?[ \t]*$/.exec(line);
    if (heading) {
      return {
        title: heading[1],
        body: trimBlankLines([...lines.slice(0, i), ...lines.slice(i + 1)]),
      };
    }
  }
  return { title: stripExtension(fallbackName), body: trimBlankLines(lines) };
}

/** Imports Markdown documents as capsules of a new "Note" type (one long_text "Body" field). */
export function importMarkdownNotes(
  db: SQLiteDatabase,
  notes: { name: string; text: string }[],
): CapsuleImportResult {
  const now = Date.now();
  const type = createType(db, "Note", now);
  const bodyFieldId = generateId();
  insertCapsuleField(db, {
    id: bodyFieldId,
    capsuleTypeId: type.id,
    name: "Body",
    fieldType: "long_text",
    config: null,
    sortOrder: 0,
    required: false,
    createdAt: now,
    updatedAt: now,
  });

  const capsules = notes.map(({ name, text }) => {
    const { title, body } = parseMarkdownNote(text, name);
    const capsule: Capsule = {
      id: generateId(),
      capsuleTypeId: type.id,
      title: title || "Untitled",
      parentCapsuleId: null,
      createdAt: now,
      updatedAt: now,
    };
    insertCapsule(db, capsule);
    if (body !== "") {
      upsertCapsuleValue(db, {
        id: generateId(),
        capsuleId: capsule.id,
        fieldId: bodyFieldId,
        value: body,
        createdAt: now,
        updatedAt: now,
      });
    }
    return capsule;
  });

  return { type, capsules };
}
