// Tests for step 4.3 — written before implementation (TDD)
import type { SQLiteDatabase } from "expo-sqlite";
import { openDb, runMigrations, _resetDbForTesting } from "@/shared/db";
import * as auditEntity from "../index";
import {
  auditMigration,
  getAllAuditEntries,
  getAuditEntryById,
  insertAuditEntry,
  type AuditEntry,
} from "../index";

const makeEntry = (overrides: Partial<AuditEntry> = {}): AuditEntry => ({
  id: `a-${Math.random().toString(36).slice(2)}`,
  action: "export",
  detail: null,
  createdAt: 1000,
  ...overrides,
});

let db: SQLiteDatabase;

beforeEach(() => {
  _resetDbForTesting();
  db = openDb();
  runMigrations(db, [auditMigration]);
});

describe("entities/audit — happy path", () => {
  it("inserts and retrieves an audit entry", () => {
    const entry = makeEntry({ action: "wipe", detail: "full vault wipe" });
    insertAuditEntry(db, entry);
    const found = getAuditEntryById(db, entry.id);
    expect(found?.id).toBe(entry.id);
    expect(found?.action).toBe("wipe");
    expect(found?.detail).toBe("full vault wipe");
  });

  it("getAllAuditEntries orders by createdAt descending — newest privacy event first", () => {
    insertAuditEntry(db, makeEntry({ id: "old", createdAt: 100 }));
    insertAuditEntry(db, makeEntry({ id: "new", createdAt: 300 }));
    insertAuditEntry(db, makeEntry({ id: "mid", createdAt: 200 }));
    expect(getAllAuditEntries(db).map((e) => e.id)).toEqual([
      "new",
      "mid",
      "old",
    ]);
  });

  it("records every action named in CLAUDE.md's hard privacy rule", () => {
    const actions: AuditEntry["action"][] = [
      "export",
      "decrypt",
      "wipe",
      "model_download",
    ];
    actions.forEach((action, i) =>
      insertAuditEntry(db, makeEntry({ id: `${i}`, action })),
    );
    expect(
      getAllAuditEntries(db)
        .map((e) => e.action)
        .sort(),
    ).toEqual([...actions].sort());
  });
});

describe("entities/audit — edge cases", () => {
  it("stores a null detail when none is given", () => {
    insertAuditEntry(db, makeEntry({ detail: null }));
    const [entry] = getAllAuditEntries(db);
    expect(entry.detail).toBeNull();
  });

  it("preserves a long, free-form detail string untruncated", () => {
    const detail = "capsule-".repeat(200);
    insertAuditEntry(db, makeEntry({ detail }));
    const [entry] = getAllAuditEntries(db);
    expect(entry.detail).toBe(detail);
  });

  // Same createdAt is possible when two privacy events land in the same
  // millisecond. Without a deterministic secondary sort the tie's order is
  // unspecified and the log could visually reshuffle between renders.
  it("breaks a timestamp tie deterministically by id, descending", () => {
    insertAuditEntry(db, makeEntry({ id: "a", createdAt: 500 }));
    insertAuditEntry(db, makeEntry({ id: "b", createdAt: 500 }));
    expect(getAllAuditEntries(db).map((e) => e.id)).toEqual(["b", "a"]);
  });
});

describe("entities/audit — error handling", () => {
  it("getAllAuditEntries returns an empty array when nothing was logged", () => {
    expect(getAllAuditEntries(db)).toEqual([]);
  });

  it("getAuditEntryById returns null for an id that was never inserted", () => {
    expect(getAuditEntryById(db, "does-not-exist")).toBeNull();
  });

  // Real enforcement, not just an absent export: a JS-level omission is
  // trivially reversed by anyone adding the function back later. A database
  // trigger holds even against a stray hand-written UPDATE/DELETE anywhere
  // else in the app, since these tests run against a real SQLite engine
  // (better-sqlite3, see src/__mocks__/expo-sqlite.ts) rather than a fake.
  it("refuses an UPDATE against the audit table at the database level", () => {
    const entry = makeEntry();
    insertAuditEntry(db, entry);
    expect(() =>
      db.runSync(
        "UPDATE audit_entries SET action = 'export' WHERE id = ?;",
        entry.id,
      ),
    ).toThrow(/append-only/);
    // The row itself is untouched — the throw aborted the statement.
    expect(getAuditEntryById(db, entry.id)?.action).toBe(entry.action);
  });

  it("refuses a DELETE against the audit table at the database level", () => {
    const entry = makeEntry();
    insertAuditEntry(db, entry);
    expect(() =>
      db.runSync("DELETE FROM audit_entries WHERE id = ?;", entry.id),
    ).toThrow(/append-only/);
    expect(getAuditEntryById(db, entry.id)).not.toBeNull();
  });

  // The public API omitting updateAuditEntry/deleteAuditEntry is a second,
  // weaker layer of defense on top of the trigger above — not the only one.
  it("exposes no way to mutate or remove an existing entry", () => {
    const entryModule: Record<string, unknown> = auditEntity;
    expect(entryModule.updateAuditEntry).toBeUndefined();
    expect(entryModule.deleteAuditEntry).toBeUndefined();
  });
});
