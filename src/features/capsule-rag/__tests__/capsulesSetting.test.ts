// Tests for step 10.18 — written before implementation (TDD)
//
// Found in the simulator: "Capsules: off" flipped to "Capsules: on" even
// though the capsule-search model wasn't downloaded — the switch claimed a
// feature that couldn't run. Without the model it stays off and says why.
import { readFileSync } from "fs";
import { join } from "path";
import { capsulesInUse, toggleCapsules } from "../capsulesSetting";

describe("toggleCapsules", () => {
  it("turns on when the model is there", () => {
    expect(toggleCapsules(false, true)).toEqual({
      enabled: true,
      needsModel: false,
    });
  });

  it("stays off without the model, and says the model is needed", () => {
    expect(toggleCapsules(false, false)).toEqual({
      enabled: false,
      needsModel: true,
    });
  });

  it("can always be turned off", () => {
    expect(toggleCapsules(true, true)).toEqual({
      enabled: false,
      needsModel: false,
    });
    expect(toggleCapsules(true, false)).toEqual({
      enabled: false,
      needsModel: false,
    });
  });
});

describe("capsulesInUse", () => {
  // A conversation remembered as "on" whose model was later deleted must not
  // show "on" — nothing can ground its replies.
  it("is on only when chosen AND the model is there", () => {
    expect(capsulesInUse(true, true)).toBe(true);
    expect(capsulesInUse(true, false)).toBe(false);
    expect(capsulesInUse(false, true)).toBe(false);
  });
});

describe("chat wiring (static)", () => {
  const chat = readFileSync(
    join(__dirname, "../../../app/(app)/(tabs)/chat/[id].tsx"),
    "utf8",
  );

  it("toggles through toggleCapsules and shows the effective state", () => {
    expect(chat).toMatch(/toggleCapsules\(/);
    expect(chat).toMatch(/capsulesInUse\(/);
  });

  it("offers a way to the Models screen when the model is missing", () => {
    expect(chat).toMatch(/testIDs\.buttons\.getCapsuleModel/);
  });

  // Reviewer finding: the notice outlived the problem — after downloading
  // the model from Settings → Models it stayed until tapped.
  it("shows the 'needs its model' notice only while the model is missing", () => {
    expect(chat).toMatch(/needsCapsuleModel && !hasCapsuleModel/);
  });

  // The overlap seen in the simulator was the list not scrolling to the
  // newest message (fixed with the follow-scroll), so the last bubble was cut
  // at the list's edge beside the notice. The notice must stay in normal
  // layout flow — never absolutely positioned over the thread.
  it("keeps the capsule notices in layout flow, never overlaid", () => {
    const style = chat.slice(chat.indexOf("  capsuleNotice: {"));
    expect(style.slice(0, style.indexOf("},"))).not.toMatch(/position:/);
  });
});
