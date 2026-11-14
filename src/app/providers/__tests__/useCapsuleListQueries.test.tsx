// Tests for step 10.56 (round 2) — written before implementation (TDD)
//
// Reviewer finding: the React Compiler wraps the capsules screen's whole
// render in one memo block keyed on every piece of state, so a tap that
// changes only, say, the selection re-ran the capsule search (a scan of all
// values) and the board's field/value queries on the JS thread. The screen's
// queries now live in a hook that memoizes each on its real inputs.
import { renderHook } from "@testing-library/react-native";
import type { SQLiteDatabase } from "expo-sqlite";
import type { Capsule } from "@/entities/capsule";
import type { CapsuleType } from "@/entities/capsule-type";
import type { CapsuleField } from "@/entities/field";
import { useCapsuleListQueries } from "../useCapsuleListQueries";

const mockSearch = jest.fn();
const mockFields = jest.fn();
const mockValues = jest.fn();

jest.mock("@/features/search-capsules", () => ({
  searchCapsules: (...args: unknown[]) => mockSearch(...args),
}));
jest.mock("@/entities/field", () => {
  const actual =
    jest.requireActual<typeof import("@/entities/field")>("@/entities/field");
  return {
    ...actual,
    getFieldsByCapsuleType: (...args: unknown[]) => mockFields(...args),
  };
});
jest.mock("@/entities/capsule", () => {
  const actual =
    jest.requireActual<typeof import("@/entities/capsule")>(
      "@/entities/capsule",
    );
  return {
    ...actual,
    getValuesByField: (...args: unknown[]) => mockValues(...args),
  };
});

const db = {} as SQLiteDatabase;
const capsule = (id: string, title: string, updatedAt: number): Capsule => ({
  id,
  capsuleTypeId: "book",
  title,
  parentCapsuleId: null,
  createdAt: updatedAt,
  updatedAt,
});
const book: CapsuleType = {
  id: "book",
  name: "Book",
  description: null,
  createdAt: 0,
  updatedAt: 0,
};
const status: CapsuleField = {
  id: "status",
  capsuleTypeId: "book",
  name: "Status",
  fieldType: "single_select",
  config: JSON.stringify({ options: ["To read", "Read"] }),
  sortOrder: 0,
  required: false,
  createdAt: 0,
  updatedAt: 0,
};

type Props = Parameters<typeof useCapsuleListQueries>[0];
const baseProps = (capsules: Capsule[]): Props => ({
  db,
  capsules,
  capsuleTypes: [book],
  query: "",
  selectedTypeId: null,
  sortKey: "updatedAt",
  sortDirection: "desc",
  viewMode: "list",
});

beforeEach(() => {
  mockSearch.mockReset();
  mockFields.mockReset();
  mockValues.mockReset();
  mockFields.mockReturnValue([status]);
  mockValues.mockReturnValue([
    {
      id: "v",
      capsuleId: "a",
      fieldId: "status",
      value: "Read",
      createdAt: 0,
      updatedAt: 0,
    },
  ]);
});

describe("useCapsuleListQueries (10.56)", () => {
  const capsules = [capsule("a", "Dune", 1), capsule("b", "Emma", 2)];

  it("filters and sorts as before", async () => {
    const { result } = await renderHook(useCapsuleListQueries, {
      initialProps: {
        ...baseProps(capsules),
        sortKey: "title",
        sortDirection: "asc",
      },
    });
    expect(result.current.visibleCapsules.map((c) => c.title)).toEqual([
      "Dune",
      "Emma",
    ]);
    expect(mockSearch).not.toHaveBeenCalled(); // empty query: no db scan
  });

  it("doesn't re-run the search on a re-render with the same inputs (a tap)", async () => {
    mockSearch.mockReturnValue([capsules[0]]);
    const props = { ...baseProps(capsules), query: "dune" };
    const { result, rerender } = await renderHook(useCapsuleListQueries, {
      initialProps: props,
    });
    expect(result.current.visibleCapsules.map((c) => c.id)).toEqual(["a"]);
    expect(mockSearch).toHaveBeenCalledTimes(1);

    await rerender({ ...props }); // e.g. a selection changed in the screen
    await rerender({ ...props });
    expect(mockSearch).toHaveBeenCalledTimes(1);
  });

  it("re-runs the search when the query or the capsules change", async () => {
    mockSearch.mockReturnValue([]);
    const props = { ...baseProps(capsules), query: "dune" };
    const { rerender } = await renderHook(useCapsuleListQueries, {
      initialProps: props,
    });
    await rerender({ ...props, query: "emma" });
    expect(mockSearch).toHaveBeenCalledTimes(2);
    // Returning to the tab reloads the capsules (a new array).
    await rerender({ ...props, query: "emma", capsules: [...capsules] });
    expect(mockSearch).toHaveBeenCalledTimes(3);
  });

  it("doesn't re-run the board's queries on a re-render with the same inputs", async () => {
    const props: Props = {
      ...baseProps(capsules),
      viewMode: "board",
      selectedTypeId: "book",
    };
    const { result, rerender } = await renderHook(useCapsuleListQueries, {
      initialProps: props,
    });
    expect(result.current.boardField?.id).toBe("status");
    const read = result.current.boardColumns.find((c) => c.key === "Read");
    expect(read?.capsules.map((c) => c.id)).toEqual(["a"]);
    const fieldCalls = mockFields.mock.calls.length;
    const valueCalls = mockValues.mock.calls.length;

    await rerender({ ...props });
    await rerender({ ...props });
    expect(mockFields).toHaveBeenCalledTimes(fieldCalls);
    expect(mockValues).toHaveBeenCalledTimes(valueCalls);
  });

  it("re-reads the board when the capsules are reloaded (an edit elsewhere)", async () => {
    const props: Props = {
      ...baseProps(capsules),
      viewMode: "board",
      selectedTypeId: "book",
    };
    const { rerender } = await renderHook(useCapsuleListQueries, {
      initialProps: props,
    });
    const valueCalls = mockValues.mock.calls.length;
    await rerender({ ...props, capsules: [...capsules] });
    expect(mockValues.mock.calls.length).toBeGreaterThan(valueCalls);
  });

  it("offers the types the board can show when none is picked", async () => {
    const { result } = await renderHook(useCapsuleListQueries, {
      initialProps: { ...baseProps(capsules), viewMode: "board" },
    });
    expect(result.current.boardField).toBeNull();
    expect(result.current.boardTypes.map((t) => t.id)).toEqual(["book"]);
  });
});
