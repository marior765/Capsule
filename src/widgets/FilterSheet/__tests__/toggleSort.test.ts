// Tests for step 6.5 — written before implementation (TDD)
import { toggleSort } from "../toggleSort";

describe("toggleSort", () => {
  it("pressing the currently-active key flips direction from asc to desc", () => {
    expect(toggleSort("title", "asc", "title")).toEqual({
      key: "title",
      direction: "desc",
    });
  });

  it("pressing the currently-active key flips direction from desc to asc", () => {
    expect(toggleSort("title", "desc", "title")).toEqual({
      key: "title",
      direction: "asc",
    });
  });

  it("pressing a different key selects it fresh at ascending, regardless of the previous direction", () => {
    expect(toggleSort("title", "desc", "createdAt")).toEqual({
      key: "createdAt",
      direction: "asc",
    });
  });

  it("pressing a different key from an already-ascending state still resets to ascending", () => {
    expect(toggleSort("createdAt", "asc", "updatedAt")).toEqual({
      key: "updatedAt",
      direction: "asc",
    });
  });
});
