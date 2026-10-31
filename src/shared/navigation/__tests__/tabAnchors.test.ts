// Tests for step 10.34 — written before implementation (TDD)
//
// Found verifying 10.5: a screen opened straight into a tab that hadn't been
// visited yet (the palette's "Ephemeral chat", a reminder's capsule) had no
// back button — its stack held only that screen. Anchoring each tab stack to
// its list screen, and asking for the anchor when navigating there, puts the
// list underneath.
import { readFileSync } from "fs";
import { join } from "path";

const APP = join(__dirname, "../../../app/(app)");

describe.each(["chat", "capsules", "settings"])(
  "%s tab stack (static)",
  (tab) => {
    const layout = readFileSync(
      join(APP, "(tabs)", tab, "_layout.tsx"),
      "utf8",
    );
    it("anchors to its index screen", () => {
      expect(layout).toMatch(
        /export const unstable_settings = \{\s*anchor: "index",?\s*\}/,
      );
    });
  },
);

describe("navigation into a tab asks for the anchor (static)", () => {
  it("the command palette's jumps", () => {
    const palette = readFileSync(
      join(__dirname, "../../../widgets/CommandPalette/CommandPalette.tsx"),
      "utf8",
    );
    const calls = palette.match(/router\.dismissTo\([^;]*\);/g) ?? [];
    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) expect(call).toMatch(/withAnchor: true/);
  });
});

describe("cross-tab pushes ask for the anchor (static)", () => {
  // Pushing from one tab into another tab's not-yet-mounted stack builds
  // that stack from the target alone unless withAnchor is passed.
  it.each([
    ["(tabs)/index.tsx", "router.push(`/capsules/${capsule.id}`"],
    ["(tabs)/index.tsx", "router.push(`/chat/${conversation.id}`"],
    ["(tabs)/chat/[id].tsx", "router.push(`/capsules/${capsuleId}`"],
  ])("%s: %s", (file, call) => {
    const src = readFileSync(join(APP, file), "utf8");
    const at = src.indexOf(call);
    expect(at).toBeGreaterThan(-1);
    expect(src.slice(at, at + call.length + 30)).toMatch(
      /, \{ withAnchor: true \}\)/,
    );
  });
});
