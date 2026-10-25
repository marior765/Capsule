// Tests for step 10.21 — written before implementation (TDD)
import type { SQLiteDatabase } from "expo-sqlite";
import { openDb, runMigrations, _resetDbForTesting } from "@/shared/db";
import { capsuleTypesMigration } from "@/entities/capsule-type";
import {
  capsuleFieldsMigration,
  getFieldsByCapsuleType,
} from "@/entities/field";
import {
  addField,
  createCapsuleType,
  DuplicateFieldNameError,
  updateField,
} from "../index";

let db: SQLiteDatabase;

beforeEach(() => {
  _resetDbForTesting();
  db = openDb();
  runMigrations(db, [capsuleTypesMigration, capsuleFieldsMigration]);
});

describe("duplicate field names", () => {
  it("addField refuses a name the type already has, and stores nothing", () => {
    const type = createCapsuleType(db, {
      name: "Book",
      fields: [{ name: "Author", fieldType: "text" }],
    });
    expect(() =>
      addField(db, type.id, { name: " author ", fieldType: "long_text" }),
    ).toThrow(DuplicateFieldNameError);
    expect(getFieldsByCapsuleType(db, type.id)).toHaveLength(1);
  });

  it("the error says which name clashed", () => {
    const type = createCapsuleType(db, {
      name: "Book",
      fields: [{ name: "Author", fieldType: "text" }],
    });
    expect(() =>
      addField(db, type.id, { name: "AUTHOR", fieldType: "text" }),
    ).toThrow(/already has a field called "Author"/);
  });

  it("createCapsuleType refuses duplicate names in its field list", () => {
    expect(() =>
      createCapsuleType(db, {
        name: "Book",
        fields: [
          { name: "Author", fieldType: "text" },
          { name: "author", fieldType: "text" },
        ],
      }),
    ).toThrow(DuplicateFieldNameError);
  });

  it("the same name on two different types is fine", () => {
    createCapsuleType(db, {
      name: "Book",
      fields: [{ name: "Author", fieldType: "text" }],
    });
    const film = createCapsuleType(db, { name: "Film" });
    expect(() =>
      addField(db, film.id, { name: "Author", fieldType: "text" }),
    ).not.toThrow();
  });

  it("updateField refuses renaming onto another field's name, allows keeping its own", () => {
    const type = createCapsuleType(db, {
      name: "Book",
      fields: [
        { name: "Author", fieldType: "text" },
        { name: "Title", fieldType: "text" },
      ],
    });
    const [author, title] = getFieldsByCapsuleType(db, type.id);
    expect(() => updateField(db, title.id, { name: "author" })).toThrow(
      DuplicateFieldNameError,
    );
    expect(() => updateField(db, author.id, { name: "AUTHOR" })).not.toThrow();
    expect(() => updateField(db, title.id, { required: true })).not.toThrow();
  });
});
