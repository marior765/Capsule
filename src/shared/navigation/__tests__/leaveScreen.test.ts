// Tests for step 10.3 — written before implementation (TDD)
//
// Found in the simulator: saving a capsule edit called
// `router.replace("/capsules/<id>")`, which swaps the edit screen for a NEW
// copy of the capsule screen — the original is still underneath, so Back
// lands on a stale duplicate.
//
// Reviewer finding: `router.canGoBack()`/`back()` look past the current
// stack into the tab navigator. A capsule pushed into the (unvisited)
// Capsules tab from chat or a notification sits alone in its stack; after
// deleting it, `back()` jumps to another tab and leaves the deleted capsule
// on screen in Capsules. Leaving must pop within the CURRENT stack only, and
// fall back to replacing when this screen is the stack's root.
import { readFileSync } from "fs";
import { join } from "path";
import { leaveScreen, type ScreenRouter } from "../index";

function fakeRouter(canDismiss: boolean) {
  return {
    canDismiss: jest.fn(() => canDismiss),
    dismiss: jest.fn(),
    replace: jest.fn(),
  } satisfies ScreenRouter;
}

describe("leaveScreen", () => {
  it("pops back to the screen underneath in the same stack", () => {
    const router = fakeRouter(true);
    leaveScreen(router, "/capsules");
    expect(router.dismiss).toHaveBeenCalledTimes(1);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("replaces with the fallback when this screen is the root of its stack", () => {
    const router = fakeRouter(false);
    leaveScreen(router, "/capsules");
    expect(router.replace).toHaveBeenCalledWith("/capsules");
    expect(router.dismiss).not.toHaveBeenCalled();
  });

  it("only ever asks the current stack, never the whole navigation tree", () => {
    const router = {
      ...fakeRouter(true),
      canGoBack: jest.fn(),
      back: jest.fn(),
    };
    leaveScreen(router, "/capsules");
    expect(router.canGoBack).not.toHaveBeenCalled();
    expect(router.back).not.toHaveBeenCalled();
  });
});

// Static guard on the screens that left by replacing themselves with a fresh
// copy of the screen underneath (the bug) — each must leave via leaveScreen
// and never call router.replace / router.back directly.
const APP = join(__dirname, "../../../app/(app)");

describe.each([
  ["capsule edit → save", "capsules/[id]/edit.tsx"],
  ["capsule screen → delete", "capsules/[id].tsx"],
  ["type screen → delete", "types/[id].tsx"],
  ["new type → create", "types/new.tsx"],
])("%s", (_label, file) => {
  const source = readFileSync(join(APP, file), "utf8");

  it("leaves through leaveScreen", () => {
    expect(source).toMatch(/leaveScreen\(router,/);
  });

  it("never replaces itself or goes back across navigators directly", () => {
    expect(source).not.toMatch(/router\.(replace|back)\(/);
  });
});
