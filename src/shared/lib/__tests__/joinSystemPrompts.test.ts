// Tests for 7.3 (shared system-prompt composition) — written before implementation (TDD)
import { joinSystemPrompts } from "../index";

describe("joinSystemPrompts", () => {
  it("joins the non-empty parts with a blank line", () => {
    expect(joinSystemPrompts("Persona", "Grounding")).toBe(
      "Persona\n\nGrounding",
    );
  });

  it("skips undefined, null, and blank parts (trimmed)", () => {
    expect(joinSystemPrompts(undefined, "  ", null, " Only ")).toBe("Only");
  });

  it("returns undefined when nothing is left", () => {
    expect(joinSystemPrompts(undefined, "", "   ")).toBeUndefined();
  });
});
