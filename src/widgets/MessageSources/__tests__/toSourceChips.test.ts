// Tests for 7.4 (source chips under a grounded answer) — written before implementation (TDD)
import type { MessageSource } from "@/entities/message";
import { toSourceChips } from "../toSourceChips";

const source = (
  capsuleId: string,
  title: string,
  rank: number,
): MessageSource => ({
  messageId: "m1",
  conversationId: "c1",
  capsuleId,
  title,
  rank,
});

describe("toSourceChips", () => {
  it("uses the capsule's CURRENT title when it still exists, in rank order", () => {
    const chips = toSourceChips(
      [source("b", "Old B", 1), source("a", "Old A", 0)],
      (id) => ({ a: "Dentist (renamed)", b: "Insurance" })[id] ?? null,
    );
    expect(chips).toEqual([
      { capsuleId: "a", label: "Dentist (renamed)", available: true },
      { capsuleId: "b", label: "Insurance", available: true },
    ]);
  });

  it("falls back to the stored title, marked unavailable, when the capsule is gone (deleted, or imported from another device)", () => {
    const chips = toSourceChips(
      [source("gone", "Old dentist note", 0)],
      () => null,
    );
    expect(chips).toEqual([
      { capsuleId: "gone", label: "Old dentist note", available: false },
    ]);
  });

  it("returns an empty list for no sources", () => {
    expect(toSourceChips([], () => "x")).toEqual([]);
  });
});
