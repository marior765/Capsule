// Tests for step 10.5 (reviewer finding) — written before implementation (TDD)
//
// Secondary screens sit on an outer stack above the tabs. Opening a tab
// route from one of them with `push` mounts a SECOND tab navigator; from a
// focused tab, `dismissTo` sends POP_TO to the tab router, which ignores it —
// the tap silently does nothing (and that's the cold-launch notification
// case: the app sits on Home). So: push from inside the tabs, dismissTo from
// a secondary screen.
import { openRoute, type OpeningRouter } from "../index";

function fakeRouter() {
  return { push: jest.fn(), dismissTo: jest.fn() } satisfies OpeningRouter;
}

describe("openRoute", () => {
  it.each([
    ["Home tab", ["(app)", "(tabs)"]],
    ["Chat tab", ["(app)", "(tabs)", "chat"]],
    ["deep in the Capsules tab", ["(app)", "(tabs)", "capsules", "[id]"]],
  ])("pushes when %s is focused", (_label, segments) => {
    const router = fakeRouter();
    openRoute(router, segments, "/capsules/abc");
    expect(router.push).toHaveBeenCalledWith("/capsules/abc");
    expect(router.dismissTo).not.toHaveBeenCalled();
  });

  it.each([
    ["Models", ["(app)", "models"]],
    ["the command palette", ["(app)", "search"]],
    ["a capsule type", ["(app)", "types", "[id]"]],
  ])(
    "pops back to the tabs (dismissTo) when %s is focused",
    (_label, segments) => {
      const router = fakeRouter();
      openRoute(router, segments, "/capsules/abc");
      expect(router.dismissTo).toHaveBeenCalledWith("/capsules/abc");
      expect(router.push).not.toHaveBeenCalled();
    },
  );
});
