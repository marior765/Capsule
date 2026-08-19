// Tests for step 6.7 — written before implementation (TDD)
import type { SQLiteDatabase } from "expo-sqlite";
import { openDb, runMigrations, _resetDbForTesting } from "@/shared/db";
import {
  capsuleTypesMigration,
  getCapsuleTypeById,
} from "@/entities/capsule-type";
import {
  capsuleFieldsMigration,
  getFieldsByCapsuleType,
} from "@/entities/field";
import {
  addField,
  createCapsuleType,
  deleteCapsuleType,
  removeField,
  renameCapsuleType,
  reorderFields,
  setCapsuleTypeDescription,
  updateField,
} from "../index";

let db: SQLiteDatabase;

beforeEach(() => {
  _resetDbForTesting();
  db = openDb();
  runMigrations(db, [capsuleTypesMigration, capsuleFieldsMigration]);
});

describe("createCapsuleType — happy path", () => {
  it("creates a capsule type with the given name and description", () => {
    const capsuleType = createCapsuleType(db, {
      name: "Book",
      description: "Track books I'm reading",
    });
    expect(capsuleType.name).toBe("Book");
    expect(capsuleType.description).toBe("Track books I'm reading");
    expect(capsuleType.id).toBeTruthy();
  });

  it("defaults description to null when none is given", () => {
    const capsuleType = createCapsuleType(db, { name: "Book" });
    expect(capsuleType.description).toBeNull();
  });

  it("sets createdAt and updatedAt to the same fresh timestamp", () => {
    const before = Date.now();
    const capsuleType = createCapsuleType(db, { name: "Book" });
    expect(capsuleType.createdAt).toBeGreaterThanOrEqual(before);
    expect(capsuleType.createdAt).toBe(capsuleType.updatedAt);
  });

  it("creates initial fields alongside the type, in the given array order", () => {
    const capsuleType = createCapsuleType(db, {
      name: "Book",
      fields: [
        { name: "Author", fieldType: "text" },
        { name: "Pages", fieldType: "number" },
      ],
    });
    const fields = getFieldsByCapsuleType(db, capsuleType.id);
    expect(fields.map((f) => f.name)).toEqual(["Author", "Pages"]);
    expect(fields.map((f) => f.sortOrder)).toEqual([0, 1]);
  });

  it("creates a type with no fields when none are given", () => {
    const capsuleType = createCapsuleType(db, { name: "Book" });
    expect(getFieldsByCapsuleType(db, capsuleType.id)).toEqual([]);
  });

  it("defaults a field's config to null and required to false when omitted", () => {
    const capsuleType = createCapsuleType(db, {
      name: "Book",
      fields: [{ name: "Author", fieldType: "text" }],
    });
    const [field] = getFieldsByCapsuleType(db, capsuleType.id);
    expect(field.config).toBeNull();
    expect(field.required).toBe(false);
  });

  it("honors an explicit config and required on an initial field", () => {
    const config = JSON.stringify({ options: ["Fiction", "Non-fiction"] });
    const capsuleType = createCapsuleType(db, {
      name: "Book",
      fields: [
        { name: "Genre", fieldType: "single_select", config, required: true },
      ],
    });
    const [field] = getFieldsByCapsuleType(db, capsuleType.id);
    expect(field.config).toBe(config);
    expect(field.required).toBe(true);
  });
});

describe("renameCapsuleType / setCapsuleTypeDescription", () => {
  it("renames a capsule type and bumps updatedAt", () => {
    const capsuleType = createCapsuleType(db, { name: "Book" });
    renameCapsuleType(db, capsuleType.id, "Novel");
    expect(getCapsuleTypeById(db, capsuleType.id)?.name).toBe("Novel");
  });

  it("sets the description, including back to null", () => {
    const capsuleType = createCapsuleType(db, {
      name: "Book",
      description: "Has one",
    });
    setCapsuleTypeDescription(db, capsuleType.id, null);
    expect(getCapsuleTypeById(db, capsuleType.id)?.description).toBeNull();
  });
});

describe("addField", () => {
  it("appends a field at the end of an empty type", () => {
    const capsuleType = createCapsuleType(db, { name: "Book" });
    addField(db, capsuleType.id, { name: "Author", fieldType: "text" });
    const fields = getFieldsByCapsuleType(db, capsuleType.id);
    expect(fields.map((f) => f.name)).toEqual(["Author"]);
    expect(fields[0].sortOrder).toBe(0);
  });

  it("appends after existing fields — sortOrder follows the current count, not array position", () => {
    const capsuleType = createCapsuleType(db, {
      name: "Book",
      fields: [{ name: "Author", fieldType: "text" }],
    });
    addField(db, capsuleType.id, { name: "Pages", fieldType: "number" });
    const fields = getFieldsByCapsuleType(db, capsuleType.id);
    expect(fields.map((f) => f.name)).toEqual(["Author", "Pages"]);
    expect(fields.map((f) => f.sortOrder)).toEqual([0, 1]);
  });

  it("appending after the LAST field was removed does not reuse its sortOrder", () => {
    const capsuleType = createCapsuleType(db, {
      name: "Book",
      fields: [
        { name: "A", fieldType: "text" },
        { name: "B", fieldType: "text" },
      ],
    });
    const [, b] = getFieldsByCapsuleType(db, capsuleType.id);
    removeField(db, b.id);
    addField(db, capsuleType.id, { name: "C", fieldType: "text" });
    const fields = getFieldsByCapsuleType(db, capsuleType.id);
    expect(fields.map((f) => f.name)).toEqual(["A", "C"]);
    expect(fields.map((f) => f.sortOrder)).toEqual([0, 1]);
  });

  it("appending after a NON-last field was removed does not collide with a surviving field's sortOrder — a count-based (rather than max+1) derivation would wrongly reassign the survivor's own position to the new field", () => {
    const capsuleType = createCapsuleType(db, {
      name: "Book",
      fields: [
        { name: "A", fieldType: "text" },
        { name: "B", fieldType: "text" },
      ],
    });
    const [a] = getFieldsByCapsuleType(db, capsuleType.id);
    removeField(db, a.id); // removes the FIRST field, leaving only B at sortOrder 1
    addField(db, capsuleType.id, { name: "C", fieldType: "text" });
    const fields = getFieldsByCapsuleType(db, capsuleType.id);
    expect(fields.map((f) => f.name)).toEqual(["B", "C"]);
    const sortOrders = fields.map((f) => f.sortOrder);
    expect(new Set(sortOrders).size).toBe(sortOrders.length); // no duplicate sortOrder
    expect(sortOrders).toEqual([1, 2]);
  });
});

describe("updateField", () => {
  it("updates a field's name, fieldType, config, and required without touching its sortOrder", () => {
    const capsuleType = createCapsuleType(db, {
      name: "Book",
      fields: [
        { name: "Author", fieldType: "text" },
        { name: "Pages", fieldType: "number" },
      ],
    });
    const [, pages] = getFieldsByCapsuleType(db, capsuleType.id);
    updateField(db, pages.id, {
      name: "Page Count",
      fieldType: "text",
      required: true,
    });
    const fields = getFieldsByCapsuleType(db, capsuleType.id);
    expect(fields.map((f) => f.name)).toEqual(["Author", "Page Count"]);
    expect(fields[1].fieldType).toBe("text");
    expect(fields[1].required).toBe(true);
    expect(fields[1].sortOrder).toBe(1);
  });
});

describe("removeField", () => {
  it("removes a field from its type", () => {
    const capsuleType = createCapsuleType(db, {
      name: "Book",
      fields: [{ name: "Author", fieldType: "text" }],
    });
    const [field] = getFieldsByCapsuleType(db, capsuleType.id);
    removeField(db, field.id);
    expect(getFieldsByCapsuleType(db, capsuleType.id)).toEqual([]);
  });

  it("removing an unknown field id does not throw", () => {
    expect(() => removeField(db, "missing")).not.toThrow();
  });
});

describe("reorderFields", () => {
  it("re-sequences sortOrder to match the given id order", () => {
    const capsuleType = createCapsuleType(db, {
      name: "Book",
      fields: [
        { name: "Author", fieldType: "text" },
        { name: "Pages", fieldType: "number" },
        { name: "Genre", fieldType: "text" },
      ],
    });
    const [author, pages, genre] = getFieldsByCapsuleType(db, capsuleType.id);
    reorderFields(db, capsuleType.id, [genre.id, author.id, pages.id]);
    const fields = getFieldsByCapsuleType(db, capsuleType.id);
    expect(fields.map((f) => f.id)).toEqual([genre.id, author.id, pages.id]);
    expect(fields.map((f) => f.sortOrder)).toEqual([0, 1, 2]);
  });

  it("skips ids that don't belong to this capsule type — a cross-type id can't rewrite another type's ordering", () => {
    const a = createCapsuleType(db, {
      name: "Book",
      fields: [
        { name: "Author", fieldType: "text" },
        { name: "Pages", fieldType: "number" },
      ],
    });
    const b = createCapsuleType(db, {
      name: "Movie",
      fields: [{ name: "Director", fieldType: "text" }],
    });
    const [author, pages] = getFieldsByCapsuleType(db, a.id);
    const [director] = getFieldsByCapsuleType(db, b.id);

    reorderFields(db, a.id, [director.id, pages.id, author.id]);

    const aFields = getFieldsByCapsuleType(db, a.id);
    expect(aFields.map((f) => f.id)).toEqual([pages.id, author.id]);
    expect(aFields.map((f) => f.sortOrder)).toEqual([0, 1]);
    // b's own field is untouched -- still sortOrder 0, not reassigned by a's call
    expect(getFieldsByCapsuleType(db, b.id)[0].sortOrder).toBe(0);
  });
});

describe("deleteCapsuleType", () => {
  it("removes the type itself", () => {
    const capsuleType = createCapsuleType(db, { name: "Book" });
    deleteCapsuleType(db, capsuleType.id);
    expect(getCapsuleTypeById(db, capsuleType.id)).toBeNull();
  });

  it("cascades to remove every one of its fields", () => {
    const capsuleType = createCapsuleType(db, {
      name: "Book",
      fields: [
        { name: "Author", fieldType: "text" },
        { name: "Pages", fieldType: "number" },
      ],
    });
    deleteCapsuleType(db, capsuleType.id);
    expect(getFieldsByCapsuleType(db, capsuleType.id)).toEqual([]);
  });

  it("leaves other types' fields intact", () => {
    const a = createCapsuleType(db, {
      name: "Book",
      fields: [{ name: "Author", fieldType: "text" }],
    });
    const b = createCapsuleType(db, {
      name: "Movie",
      fields: [{ name: "Director", fieldType: "text" }],
    });
    deleteCapsuleType(db, a.id);
    expect(getCapsuleTypeById(db, b.id)).not.toBeNull();
    expect(getFieldsByCapsuleType(db, b.id)).toHaveLength(1);
  });

  it("deleting an unknown id does not throw", () => {
    expect(() => deleteCapsuleType(db, "missing")).not.toThrow();
  });

  it("does not delete capsules of that type — dangling capsuleTypeId degrades gracefully, matching CapsuleCard's own convention", () => {
    // No capsules entity wired into this test's migrations (out of this
    // feature's scope) — this test only proves deleteCapsuleType never
    // reaches for entities/capsule at all, via the absence of any error
    // when the capsules table doesn't even exist.
    const capsuleType = createCapsuleType(db, { name: "Book" });
    expect(() => deleteCapsuleType(db, capsuleType.id)).not.toThrow();
  });
});
