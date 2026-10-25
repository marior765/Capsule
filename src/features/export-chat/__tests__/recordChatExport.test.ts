// Tests for step 10.19 — written before implementation (TDD)
//
// Copying a conversation out of the app is an export — CLAUDE.md requires
// privacy-sensitive actions (export, decrypt, wipe, model download) to be
// written to the activity (audit) log. The chat's Export button never was.
import { readFileSync } from "fs";
import { join } from "path";
import type { SQLiteDatabase } from "expo-sqlite";
import { openDb, runMigrations, _resetDbForTesting } from "@/shared/db";
import { auditMigration, getAllAuditEntries } from "@/entities/audit";
import { recordChatExport } from "../index";

let db: SQLiteDatabase;

beforeEach(() => {
  _resetDbForTesting();
  db = openDb();
  runMigrations(db, [auditMigration]);
});

describe("recordChatExport", () => {
  it("writes an export entry naming the conversation and message count", () => {
    recordChatExport(db, { title: "Best pastry in Porto?", messageCount: 4 });
    const entries = getAllAuditEntries(db);
    expect(entries).toHaveLength(1);
    expect(entries[0].action).toBe("export");
    expect(entries[0].detail).toBe(
      'Copied conversation "Best pastry in Porto?" (4 messages) as Markdown',
    );
  });

  it("uses the singular for one message and a fallback for no title", () => {
    recordChatExport(db, { title: "  ", messageCount: 1 });
    expect(getAllAuditEntries(db)[0].detail).toBe(
      'Copied conversation "Untitled conversation" (1 message) as Markdown',
    );
  });
});

describe("chat Export button (static)", () => {
  const chat = readFileSync(
    join(__dirname, "../../../app/(app)/(tabs)/chat/[id].tsx"),
    "utf8",
  );

  it("says what it does", () => {
    expect(chat).toMatch(/"Copy as Markdown"/);
    expect(chat).not.toMatch(/\{exported \? "Copied!" : "Export"\}/);
  });

  it("logs the export only after the copy succeeded", () => {
    const fn = chat.slice(chat.indexOf("const handleExport"));
    const body = fn.slice(0, fn.indexOf("\n  };"));
    expect(body.indexOf("recordChatExport(")).toBeGreaterThan(
      body.indexOf("setStringAsync("),
    );
    expect(body).toMatch(/if \(ok\)/);
  });

  it("keeps the confirmation up long enough to notice", () => {
    expect(chat).toMatch(/COPY_CONFIRMATION_MS = [4-9]\d{3}/);
  });
});
