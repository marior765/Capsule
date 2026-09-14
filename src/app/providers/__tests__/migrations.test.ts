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
import {
  getAllCapsules,
  getEmbeddingByCapsule,
  getValuesByField,
  upsertEmbedding,
} from "@/entities/capsule";
import { getAllCapsuleTypes } from "@/entities/capsule-type";
import { getFieldsByCapsuleType, parseSelectOptions } from "@/entities/field";
import { groupCapsulesBySelectField } from "@/features/filter-sort-capsules";
import { getTagsByCapsule } from "@/entities/tag";
import { getLinksFrom, getLinksFromByField } from "@/entities/link";
import {
  getAttachmentsByCapsuleField,
  insertAttachment,
} from "@/entities/attachment";
import { insertSnippet, getAllSnippets } from "@/entities/snippet";
import { createCapsuleType } from "@/features/manage-schema";
import { createCapsule } from "@/features/create-capsule";
import { tagCapsule } from "@/features/tag-capsule";
import { linkCapsules } from "@/features/link-capsules";
import { setCapsuleParent } from "@/features/nest-capsule";
import {
  getCapsuleHistory,
  snapshotCapsule,
} from "@/features/capsule-versioning";
import { hasCapsuleEdits, saveCapsuleEdits } from "@/features/edit-capsule";
import { runBulkOperation } from "@/shared/lib";

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

  it("lets a capsule actually be tagged through the real migration set (6.6)", () => {
    runMigrations(openDb(), migrations);
    const db = openDb();
    const capsuleType = createCapsuleType(db, { name: "Book" });
    const capsule = createCapsule(db, {
      capsuleTypeId: capsuleType.id,
      title: "Dune",
    });
    tagCapsule(db, capsule.id, "sci-fi");
    expect(getTagsByCapsule(db, capsule.id).map((t) => t.name)).toEqual([
      "sci-fi",
    ]);
  });

  it("lets two capsules actually be linked through the real migration set (6.9)", () => {
    runMigrations(openDb(), migrations);
    const db = openDb();
    const capsuleType = createCapsuleType(db, { name: "Book" });
    const a = createCapsule(db, {
      capsuleTypeId: capsuleType.id,
      title: "Dune",
    });
    const b = createCapsule(db, {
      capsuleTypeId: capsuleType.id,
      title: "Dune Messiah",
    });
    linkCapsules(db, a.id, b.id, { label: "sequel" });
    expect(getLinksFrom(db, a.id).map((l) => l.toCapsuleId)).toEqual([b.id]);
  });

  it("lets a relation-field-backed link actually be created and queried through the real migration set (6.8)", () => {
    runMigrations(openDb(), migrations);
    const db = openDb();
    const capsuleType = createCapsuleType(db, { name: "Book" });
    const a = createCapsule(db, {
      capsuleTypeId: capsuleType.id,
      title: "Dune",
    });
    const b = createCapsule(db, {
      capsuleTypeId: capsuleType.id,
      title: "Dune Messiah",
    });
    linkCapsules(db, a.id, b.id, { fieldId: "f-sequel" });
    expect(
      getLinksFromByField(db, a.id, "f-sequel").map((l) => l.toCapsuleId),
    ).toEqual([b.id]);
  });

  it("lets an attachment record actually be created and queried through the real migration set (6.8)", () => {
    runMigrations(openDb(), migrations);
    const db = openDb();
    const capsuleType = createCapsuleType(db, { name: "Book" });
    const capsule = createCapsule(db, {
      capsuleTypeId: capsuleType.id,
      title: "Dune",
    });
    insertAttachment(db, {
      id: "att-1",
      capsuleId: capsule.id,
      fieldId: "f-cover",
      filename: "cover.jpg",
      localUri: "file:///docs/cover.jpg",
      mimeType: "image/jpeg",
      size: 2048,
      createdAt: Date.now(),
    });
    expect(
      getAttachmentsByCapsuleField(db, capsule.id, "f-cover").map(
        (a) => a.filename,
      ),
    ).toEqual(["cover.jpg"]);
  });

  it("lets a capsule embedding actually be stored and retrieved through the real migration set (7.2)", () => {
    runMigrations(openDb(), migrations);
    const db = openDb();
    const capsuleType = createCapsuleType(db, { name: "Book" });
    const capsule = createCapsule(db, {
      capsuleTypeId: capsuleType.id,
      title: "Dune",
    });
    upsertEmbedding(db, {
      capsuleId: capsule.id,
      embedding: [0.1, 0.2, 0.3],
      content: "Dune",
      updatedAt: Date.now(),
    });
    expect(getEmbeddingByCapsule(db, capsule.id)?.embedding).toEqual([
      0.1, 0.2, 0.3,
    ]);
  });

  it("lets a capsule actually be nested under another through the real migration set (8.5)", () => {
    runMigrations(openDb(), migrations);
    const db = openDb();
    const capsuleType = createCapsuleType(db, { name: "Book" });
    const parent = createCapsule(db, {
      capsuleTypeId: capsuleType.id,
      title: "Dune",
    });
    const child = createCapsule(db, {
      capsuleTypeId: capsuleType.id,
      title: "Chapter 1",
    });
    setCapsuleParent(db, child.id, parent.id);
    expect(
      getAllCapsules(db).find((c) => c.id === child.id)?.parentCapsuleId,
    ).toBe(parent.id);
  });

  it("lets a capsule version snapshot actually be taken and retrieved through the real migration set (8.5)", () => {
    runMigrations(openDb(), migrations);
    const db = openDb();
    const capsuleType = createCapsuleType(db, { name: "Book" });
    const capsule = createCapsule(db, {
      capsuleTypeId: capsuleType.id,
      title: "Dune",
    });
    snapshotCapsule(db, capsule.id);
    expect(getCapsuleHistory(db, capsule.id)).toHaveLength(1);
  });

  it("lets a bulk reparent be applied across real capsules, isolating a genuine per-item cycle failure (8.5)", () => {
    runMigrations(openDb(), migrations);
    const db = openDb();
    const capsuleType = createCapsuleType(db, { name: "Book" });
    const newParent = createCapsule(db, {
      capsuleTypeId: capsuleType.id,
      title: "Series",
    });
    const a = createCapsule(db, { capsuleTypeId: capsuleType.id, title: "A" });
    const b = createCapsule(db, { capsuleTypeId: capsuleType.id, title: "B" });

    // Bulk-reparent [a, newParent, b] under newParent — newParent nesting
    // under itself is a genuine cycle, not a synthetic test error, so this
    // proves runBulkOperation's continue-on-error semantics against real
    // business-logic rejection, not just a thrown Error in a test double.
    const result = runBulkOperation([a.id, newParent.id, b.id], (id) =>
      setCapsuleParent(db, id, newParent.id),
    );

    expect(result.succeeded.map((s) => s.id)).toEqual([a.id, b.id]);
    expect(result.failed.map((f) => f.id)).toEqual([newParent.id]);
    expect(getAllCapsules(db).find((c) => c.id === a.id)?.parentCapsuleId).toBe(
      newParent.id,
    );
    expect(getAllCapsules(db).find((c) => c.id === b.id)?.parentCapsuleId).toBe(
      newParent.id,
    );
  });

  it("snapshots a capsule's PRE-edit state before saving, matching the edit route's exact composition order (8.5)", () => {
    runMigrations(openDb(), migrations);
    const db = openDb();
    const capsuleType = createCapsuleType(db, { name: "Book" });
    const capsule = createCapsule(db, {
      capsuleTypeId: capsuleType.id,
      title: "Dune",
      values: { "f-author": "Frank Herbert" },
    });

    // Exactly `capsules/[id]/edit.tsx`'s handleSave composition: build the
    // edit input, snapshot only if it would actually change something,
    // THEN apply the edit — snapshot must run BEFORE saveCapsuleEdits or
    // it would capture the wrong (post-edit) state.
    const editInput = {
      title: "Dune Messiah",
      initialTitle: "Dune",
      values: { "f-author": "Someone Else" },
      initialValues: { "f-author": "Frank Herbert" },
      fieldIds: ["f-author"],
    };
    expect(hasCapsuleEdits(editInput)).toBe(true);
    snapshotCapsule(db, capsule.id);
    saveCapsuleEdits(db, capsule.id, editInput);

    const history = getCapsuleHistory(db, capsule.id);
    expect(history).toHaveLength(1);
    expect(history[0].title).toBe("Dune");
    expect(history[0].values).toEqual({ "f-author": "Frank Herbert" });
    expect(getAllCapsules(db).find((c) => c.id === capsule.id)?.title).toBe(
      "Dune Messiah",
    );
  });

  it("does not snapshot when the edit changes nothing, avoiding a noise history entry (8.5)", () => {
    runMigrations(openDb(), migrations);
    const db = openDb();
    const capsuleType = createCapsuleType(db, { name: "Book" });
    const capsule = createCapsule(db, {
      capsuleTypeId: capsuleType.id,
      title: "Dune",
    });

    const editInput = {
      title: "Dune",
      initialTitle: "Dune",
      values: {},
      initialValues: {},
      fieldIds: [],
    };
    expect(hasCapsuleEdits(editInput)).toBe(false);
    if (hasCapsuleEdits(editInput)) snapshotCapsule(db, capsule.id);
    saveCapsuleEdits(db, capsule.id, editInput);

    expect(getCapsuleHistory(db, capsule.id)).toEqual([]);
  });

  it("lets capsules be grouped into real board columns by a real single_select field's value (8.7)", () => {
    runMigrations(openDb(), migrations);
    const db = openDb();
    const capsuleType = createCapsuleType(db, {
      name: "Task",
      fields: [
        {
          name: "Status",
          fieldType: "single_select",
          config: JSON.stringify({ options: ["Todo", "Done"] }),
        },
      ],
    });
    const statusField = getFieldsByCapsuleType(db, capsuleType.id)[0];

    const todo = createCapsule(db, {
      capsuleTypeId: capsuleType.id,
      title: "Write beat",
      values: { [statusField.id]: "Todo" },
    });
    const done = createCapsule(db, {
      capsuleTypeId: capsuleType.id,
      title: "Plan beat",
      values: { [statusField.id]: "Done" },
    });
    const unset = createCapsule(db, {
      capsuleTypeId: capsuleType.id,
      title: "Someday",
    });

    const options = parseSelectOptions(statusField.config);
    const valueByCapsuleId = Object.fromEntries(
      getValuesByField(db, statusField.id).map((v) => [v.capsuleId, v.value]),
    );
    const columns = groupCapsulesBySelectField(
      getAllCapsules(db),
      options,
      valueByCapsuleId,
    );

    expect(
      columns.find((c) => c.key === "Todo")?.capsules.map((c) => c.id),
    ).toEqual([todo.id]);
    expect(
      columns.find((c) => c.key === "Done")?.capsules.map((c) => c.id),
    ).toEqual([done.id]);
    expect(
      columns.find((c) => c.key === "unset")?.capsules.map((c) => c.id),
    ).toEqual([unset.id]);
  });

  it("lets a snippet actually be created and listed through the real migration set (8.2)", () => {
    runMigrations(openDb(), migrations);
    const db = openDb();
    insertSnippet(db, {
      id: "s-1",
      title: "Summarize",
      content: "Summarize the following in three bullet points:",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    expect(getAllSnippets(db).map((s) => s.title)).toEqual(["Summarize"]);
  });
});
