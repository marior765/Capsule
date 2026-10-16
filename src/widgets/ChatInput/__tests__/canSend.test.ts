// Tests for step 10.7 — written before implementation (TDD)
//
// Found in the simulator: Send looked tappable with an empty box. The button
// should look and act disabled until there's something to send.
import { canSend } from "../canSend";

describe("canSend", () => {
  it("is false for an empty box", () => {
    expect(canSend("", false)).toBe(false);
  });

  it("is false for whitespace only", () => {
    expect(canSend("  \n\t ", false)).toBe(false);
  });

  it("is true once there's text", () => {
    expect(canSend("hi", false)).toBe(true);
  });

  it("is false while the input is disabled (a reply is coming)", () => {
    expect(canSend("hi", true)).toBe(false);
  });
});
