// Tests for step 6.5 — written before implementation (TDD)
import type { Capsule } from "@/entities/capsule";
import { filterCapsulesByType, sortCapsules } from "../index";

function makeCapsule(overrides: Partial<Capsule>): Capsule {
  return {
    id: "c-1",
    capsuleTypeId: "ct-1",
    title: "Untitled",
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
