// Tests for step 6.5 — written before implementation (TDD)
import type { Capsule } from "@/entities/capsule";
import {
  filterCapsulesByType,
  groupCapsulesBySelectField,
  sortCapsules,
} from "../index";

function makeCapsule(overrides: Partial<Capsule>): Capsule {
  return {
    id: "c-1",
    capsuleTypeId: "ct-1",
    title: "Untitled",
    parentCapsuleId: null,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

describe("filterCapsulesByType", () => {
  it("returns every capsule when no type id is given", () => {
    const capsules = [
      makeCapsule({ id: "a", capsuleTypeId: "ct-1" }),
      makeCapsule({ id: "b", capsuleTypeId: "ct-2" }),
    ];
    expect(filterCapsulesByType(capsules, null)).toEqual(capsules);
  });

  it("narrows to only capsules of the given type", () => {
    const capsules = [
      makeCapsule({ id: "a", capsuleTypeId: "ct-1" }),
      makeCapsule({ id: "b", capsuleTypeId: "ct-2" }),
      makeCapsule({ id: "c", capsuleTypeId: "ct-1" }),
    ];
    expect(filterCapsulesByType(capsules, "ct-1").map((c) => c.id)).toEqual([
      "a",
      "c",
    ]);
  });

  it("returns an empty array when no capsule matches the given type", () => {
    const capsules = [makeCapsule({ id: "a", capsuleTypeId: "ct-1" })];
    expect(filterCapsulesByType(capsules, "ct-missing")).toEqual([]);
  });

  it("does not mutate the input array", () => {
    const capsules = [
      makeCapsule({ id: "a", capsuleTypeId: "ct-1" }),
      makeCapsule({ id: "b", capsuleTypeId: "ct-2" }),
    ];
    const original = [...capsules];
    filterCapsulesByType(capsules, "ct-1");
    expect(capsules).toEqual(original);
  });
});

describe("sortCapsules", () => {
  it("sorts by title ascending, case-insensitively", () => {
    const capsules = [
      makeCapsule({ id: "a", title: "banana" }),
      makeCapsule({ id: "b", title: "Apple" }),
      makeCapsule({ id: "c", title: "cherry" }),
    ];
    expect(sortCapsules(capsules, "title", "asc").map((c) => c.id)).toEqual([
      "b",
      "a",
      "c",
    ]);
  });

  it("sorts by title descending", () => {
    const capsules = [
      makeCapsule({ id: "a", title: "banana" }),
      makeCapsule({ id: "b", title: "Apple" }),
      makeCapsule({ id: "c", title: "cherry" }),
    ];
    expect(sortCapsules(capsules, "title", "desc").map((c) => c.id)).toEqual([
      "c",
      "a",
      "b",
    ]);
  });

  it("sorts by createdAt ascending", () => {
    const capsules = [
      makeCapsule({ id: "a", createdAt: 300 }),
      makeCapsule({ id: "b", createdAt: 100 }),
      makeCapsule({ id: "c", createdAt: 200 }),
    ];
    expect(sortCapsules(capsules, "createdAt", "asc").map((c) => c.id)).toEqual(
      ["b", "c", "a"],
    );
  });

  it("sorts by updatedAt descending", () => {
    const capsules = [
      makeCapsule({ id: "a", updatedAt: 300 }),
      makeCapsule({ id: "b", updatedAt: 100 }),
      makeCapsule({ id: "c", updatedAt: 200 }),
    ];
    expect(
      sortCapsules(capsules, "updatedAt", "desc").map((c) => c.id),
    ).toEqual(["a", "c", "b"]);
  });

  it("defaults to ascending when no direction is given", () => {
    const capsules = [
      makeCapsule({ id: "a", createdAt: 200 }),
      makeCapsule({ id: "b", createdAt: 100 }),
    ];
    expect(sortCapsules(capsules, "createdAt").map((c) => c.id)).toEqual([
      "b",
      "a",
    ]);
  });

  it("does not mutate the input array", () => {
    const capsules = [
      makeCapsule({ id: "a", createdAt: 300 }),
      makeCapsule({ id: "b", createdAt: 100 }),
    ];
    const original = [...capsules];
    sortCapsules(capsules, "createdAt", "asc");
    expect(capsules).toEqual(original);
  });

  it("does not throw on an empty array", () => {
    expect(sortCapsules([], "title", "asc")).toEqual([]);
  });
});

describe("groupCapsulesBySelectField — 8.7 board view", () => {
  const options = ["Todo", "In Progress", "Done"];

  it("groups each capsule into the column matching its value", () => {
    const capsules = [
      makeCapsule({ id: "a" }),
      makeCapsule({ id: "b" }),
      makeCapsule({ id: "c" }),
    ];
    const valueByCapsuleId = { a: "Todo", b: "Done", c: "Todo" };

    const columns = groupCapsulesBySelectField(
      capsules,
      options,
      valueByCapsuleId,
    );

    expect(
      columns.find((c) => c.key === "Todo")?.capsules.map((c) => c.id),
    ).toEqual(["a", "c"]);
    expect(
      columns.find((c) => c.key === "Done")?.capsules.map((c) => c.id),
    ).toEqual(["b"]);
  });

  it("produces one column per option, in the option's own order, even when empty", () => {
    const columns = groupCapsulesBySelectField([], options, {});
    expect(columns.map((c) => c.key)).toEqual([
      "Todo",
      "In Progress",
      "Done",
      "unset",
    ]);
    expect(columns.every((c) => c.capsules.length === 0)).toBe(true);
  });

  it("puts a capsule with no value into the trailing 'unset' column", () => {
    const capsules = [makeCapsule({ id: "a" })];
    const columns = groupCapsulesBySelectField(capsules, options, {});
    expect(
      columns.find((c) => c.key === "unset")?.capsules.map((c) => c.id),
    ).toEqual(["a"]);
  });

  it("puts a capsule whose value no longer matches any option into 'unset' — graceful degradation for a stale value", () => {
    const capsules = [makeCapsule({ id: "a" })];
    const valueByCapsuleId = { a: "Archived" }; // not one of `options`
    const columns = groupCapsulesBySelectField(
      capsules,
      options,
      valueByCapsuleId,
    );
    expect(
      columns.find((c) => c.key === "unset")?.capsules.map((c) => c.id),
    ).toEqual(["a"]);
  });

  it("never drops a capsule — every input capsule appears in exactly one column", () => {
    const capsules = [
      makeCapsule({ id: "a" }),
      makeCapsule({ id: "b" }),
      makeCapsule({ id: "c" }),
    ];
    const valueByCapsuleId = { a: "Todo", b: "Nonsense" };
    const columns = groupCapsulesBySelectField(
      capsules,
      options,
      valueByCapsuleId,
    );
    const totalPlaced = columns.reduce((sum, c) => sum + c.capsules.length, 0);
    expect(totalPlaced).toBe(3);
  });

  it("does not mutate the input capsules array", () => {
    const capsules = [makeCapsule({ id: "a" })];
    const original = [...capsules];
    groupCapsulesBySelectField(capsules, options, { a: "Todo" });
    expect(capsules).toEqual(original);
  });
});
