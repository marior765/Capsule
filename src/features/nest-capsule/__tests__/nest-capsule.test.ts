// Tests for step 8.5 "capsule nesting" — written before implementation (TDD)
import type { SQLiteDatabase } from "expo-sqlite";
import { openDb, runMigrations, _resetDbForTesting } from "@/shared/db";
import {
  capsuleParentIdMigration,
  capsulesMigration,
  capsuleValuesMigration,
  getCapsuleById,
} from "@/entities/capsule";
import { createCapsule } from "@/features/create-capsule";
import { setCapsuleParent, wouldCreateCycle } from "../index";

let db: SQLiteDatabase;

beforeEach(() => {
  _resetDbForTesting();
  db = openDb();
  runMigrations(db, [
    capsulesMigration,
    capsuleValuesMigration,
    capsuleParentIdMigration,
  ]);
});

describe("setCapsuleParent — happy path", () => {
  it("nests a capsule under another", () => {
    const parent = createCapsule(db, { capsuleTypeId: "ct-1", title: "Book" });
    const child = createCapsule(db, {
      capsuleTypeId: "ct-1",
      title: "Chapter 1",
    });
    setCapsuleParent(db, child.id, parent.id);
    expect(getCapsuleById(db, child.id)?.parentCapsuleId).toBe(parent.id);
  });

  it("clears a parent when given null, promoting the capsule back to root", () => {
    const parent = createCapsule(db, { capsuleTypeId: "ct-1" });
    const child = createCapsule(db, {
      capsuleTypeId: "ct-1",
      parentCapsuleId: parent.id,
    });
    setCapsuleParent(db, child.id, null);
    expect(getCapsuleById(db, child.id)?.parentCapsuleId).toBeNull();
  });

  it("reparenting bumps updatedAt", () => {
    const parent = createCapsule(db, { capsuleTypeId: "ct-1" });
    const child = createCapsule(db, { capsuleTypeId: "ct-1" });
    const before = child.updatedAt;
    setCapsuleParent(db, child.id, parent.id);
    expect(getCapsuleById(db, child.id)!.updatedAt).toBeGreaterThanOrEqual(
      before,
    );
  });

  it("re-parenting under a grandparent (moving deep into an existing tree) works", () => {
    const grandparent = createCapsule(db, { capsuleTypeId: "ct-1" });
    const parent = createCapsule(db, {
      capsuleTypeId: "ct-1",
      parentCapsuleId: grandparent.id,
    });
    const child = createCapsule(db, { capsuleTypeId: "ct-1" });
    setCapsuleParent(db, child.id, parent.id);
    expect(getCapsuleById(db, child.id)?.parentCapsuleId).toBe(parent.id);
  });
});

describe("setCapsuleParent — cycle prevention", () => {
  it("throws when nesting a capsule under itself", () => {
    const a = createCapsule(db, { capsuleTypeId: "ct-1" });
    expect(() => setCapsuleParent(db, a.id, a.id)).toThrow();
  });

  it("throws when nesting a capsule under its own direct child", () => {
    const a = createCapsule(db, { capsuleTypeId: "ct-1" });
    const b = createCapsule(db, {
      capsuleTypeId: "ct-1",
      parentCapsuleId: a.id,
    });
    expect(() => setCapsuleParent(db, a.id, b.id)).toThrow();
  });

  it("throws when nesting a capsule under a deeper descendant (grandchild)", () => {
    const a = createCapsule(db, { capsuleTypeId: "ct-1" });
    const b = createCapsule(db, {
      capsuleTypeId: "ct-1",
      parentCapsuleId: a.id,
    });
    const c = createCapsule(db, {
      capsuleTypeId: "ct-1",
      parentCapsuleId: b.id,
    });
    expect(() => setCapsuleParent(db, a.id, c.id)).toThrow();
  });

  it("does not throw for an unrelated re-parenting between two independent trees", () => {
    const a = createCapsule(db, { capsuleTypeId: "ct-1" });
    const b = createCapsule(db, { capsuleTypeId: "ct-1" });
    expect(() => setCapsuleParent(db, a.id, b.id)).not.toThrow();
  });

  it("leaves the original parent untouched when a cycle is rejected", () => {
    const a = createCapsule(db, { capsuleTypeId: "ct-1" });
    const b = createCapsule(db, {
      capsuleTypeId: "ct-1",
      parentCapsuleId: a.id,
    });
    expect(() => setCapsuleParent(db, a.id, b.id)).toThrow();
    expect(getCapsuleById(db, a.id)?.parentCapsuleId).toBeNull();
  });
});

describe("wouldCreateCycle", () => {
  it("is true for self-parenting", () => {
    const a = createCapsule(db, { capsuleTypeId: "ct-1" });
    expect(wouldCreateCycle(db, a.id, a.id)).toBe(true);
  });

  it("is true when the proposed parent is a descendant", () => {
    const a = createCapsule(db, { capsuleTypeId: "ct-1" });
    const b = createCapsule(db, {
      capsuleTypeId: "ct-1",
      parentCapsuleId: a.id,
    });
    expect(wouldCreateCycle(db, a.id, b.id)).toBe(true);
  });

  it("is false for an unrelated capsule", () => {
    const a = createCapsule(db, { capsuleTypeId: "ct-1" });
    const b = createCapsule(db, { capsuleTypeId: "ct-1" });
    expect(wouldCreateCycle(db, a.id, b.id)).toBe(false);
  });

  it("is false when nesting a fresh root capsule under an existing one", () => {
    const parent = createCapsule(db, { capsuleTypeId: "ct-1" });
    const child = createCapsule(db, { capsuleTypeId: "ct-1" });
    expect(wouldCreateCycle(db, child.id, parent.id)).toBe(false);
  });
});
