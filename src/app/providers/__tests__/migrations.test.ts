// Regression test for a bug self-caught while starting step 6.6: `Providers`'
// own migrations list never registered the capsule-domain migrations
// (`capsuleTypesMigration`/`capsuleFieldsMigration`/`capsulesMigration`/
// `capsuleValuesMigration`) — a real app boot would leave those tables
// missing entirely. Every capsule test up to now passed anyway because each
// one calls `runMigrations` with its own explicit list, never this one.
//
// Imports from `../migrations`, not `../index` — `../index.tsx` pulls in
// `react-native-unistyles`, which requires a real native NitroModules
// binary and crashes under jest. That's *why* this gap was untestable and
// slipped through; the fix pulled the migrations list into its own module
// specifically so this can be tested at all.
import { openDb, runMigrations, _resetDbForTesting } from "@/shared/db";
import { migrations } from "../migrations";
import { getAllCapsules } from "@/entities/capsule";
import { getAllCapsuleTypes } from "@/entities/capsule-type";
import { getFieldsByCapsuleType } from "@/entities/field";
import { createCapsuleType } from "@/features/manage-schema";
import { createCapsule } from "@/features/create-capsule";

beforeEach(() => {
  _resetDbForTesting();
});

describe("Providers' registered migrations", () => {
  it("creates the capsule-domain tables on boot", () => {
    runMigrations(openDb(), migrations);
    const db = openDb();
    expect(() => getAllCapsules(db)).not.toThrow();
    expect(() => getAllCapsuleTypes(db)).not.toThrow();
  });

  it("lets a capsule type and a capsule with a field value actually be created through the real migration set", () => {
    runMigrations(openDb(), migrations);
    const db = openDb();
    const capsuleType = createCapsuleType(db, {
      name: "Book",
      fields: [{ name: "Author", fieldType: "text" }],
    });
    const capsule = createCapsule(db, {
      capsuleTypeId: capsuleType.id,
      title: "Dune",
    });
    expect(getAllCapsules(db).map((c) => c.id)).toContain(capsule.id);
    expect(getFieldsByCapsuleType(db, capsuleType.id)).toHaveLength(1);
  });
});
