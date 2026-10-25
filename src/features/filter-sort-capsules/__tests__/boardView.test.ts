// Tests for step 10.25 — written before implementation (TDD)
//
// Found in the simulator: the view toggle's label sometimes named the view
// you were in and sometimes read like the next one, and board view with "All"
// types hid every capsule behind a hint.
import { readFileSync } from "fs";
import { join } from "path";
import type { CapsuleField, FieldType } from "@/entities/field";
import { boardableTypeIds, findBoardField } from "../index";

const field = (
  id: string,
  capsuleTypeId: string,
  fieldType: FieldType,
  sortOrder = 0,
): CapsuleField => ({
  id,
  capsuleTypeId,
  name: id,
  fieldType,
  config: null,
  sortOrder,
  required: false,
  createdAt: 0,
  updatedAt: 0,
});

describe("findBoardField", () => {
  it("is the first single-select field by field order", () => {
    const fields = [
      field("genre", "book", "single_select", 2),
      field("title", "book", "text", 0),
      field("status", "book", "single_select", 1),
    ];
    expect(findBoardField(fields)?.id).toBe("status");
  });

  it("is null when the type has none", () => {
    expect(findBoardField([field("title", "book", "text")])).toBeNull();
  });
});

describe("boardableTypeIds", () => {
  it("keeps only types with a single-select field, in the given order", () => {
    const fieldsByType = {
      book: [field("status", "book", "single_select")],
      note: [field("body", "note", "long_text")],
      film: [field("seen", "film", "single_select")],
    };
    expect(boardableTypeIds(["book", "note", "film"], fieldsByType)).toEqual([
      "book",
      "film",
    ]);
  });
});

describe("capsules screen (static)", () => {
  const screen = readFileSync(
    join(__dirname, "../../../app/(app)/(tabs)/capsules/index.tsx"),
    "utf8",
  );

  it("picks the view with a List / Cards / Board control that marks the current one", () => {
    expect(screen).not.toMatch(/NEXT_VIEW_MODE/);
    expect(screen).toMatch(/VIEW_MODES\.map/);
    expect(screen).toMatch(
      /accessibilityState=\{\{ selected: viewMode === mode \}\}/,
    );
  });

  it("never leaves board view empty: the capsules stay listed under the hint", () => {
    expect(screen).toMatch(/testIDs\.pressables\.boardType/);
    expect(screen).not.toMatch(/Select a capsule type above \(Filter & sort\)/);
    expect(screen).toMatch(/boardReady \?/);
  });
});
