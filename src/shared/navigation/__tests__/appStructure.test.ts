// Tests for step 10.5 — written before implementation (TDD)
//
// Found in the simulator: Models, Personas and Snippets drew their content
// under the status bar with no header or back button, and the capsule types
// screens had no way back either. They were hidden screens of the TAB
// navigator (`href: null`, `headerShown: false`) — nothing gave them a
// header, and Back from them meant "switch tab".
//
// The fix is the pattern expo-router documents for detail screens: the tabs
// live in a `(tabs)` group inside an outer Stack, and secondary screens are
// pushed on that Stack — so they get a header with a back button that
// returns to whichever tab opened them. Group folders don't change URLs, so
// every existing `/models`, `/types/new`, … href keeps working.
import { existsSync, readFileSync } from "fs";
import { join } from "path";

const APP = join(__dirname, "../../../app/(app)");
const read = (p: string) => readFileSync(join(APP, p), "utf8");

describe("outer stack: (app)/_layout.tsx", () => {
  const layout = read("_layout.tsx");

  it("is a Stack, not Tabs", () => {
    expect(layout).toMatch(/<Stack[\s>]/);
    expect(layout).not.toMatch(/<Tabs[\s>]/);
  });

  it("hosts the tab navigator as a header-less (tabs) screen", () => {
    expect(layout).toMatch(
      /<Stack\.Screen\s+name="\(tabs\)"\s+options=\{\{\s*headerShown:\s*false\s*\}\}/,
    );
  });

  it.each([
    ["models/index", "Models"],
    ["personas/index", "Personas"],
    ["snippets/index", "Snippets"],
    ["types/index", "Capsule types"],
    ["types/new", "New type"],
    ["types/[id]", "Capsule type"],
  ])("pushes %s with a header titled %s", (name, title) => {
    const screen = new RegExp(
      `<Stack\\.Screen\\s+name="${name.replace(/[[\]]/g, "\\$&")}"\\s+options=\\{\\{[^}]*title:\\s*"${title}"`,
    );
    expect(layout).toMatch(screen);
  });

  // Found in the simulator: the back button read "(tabs)" — the group's
  // folder name. A chevron-only back button never shows a route name.
  it("never labels the back button with the previous route's name", () => {
    expect(layout).toMatch(
      /<Stack\s+screenOptions=\{\{[^}]*headerBackButtonDisplayMode:\s*"minimal"/,
    );
  });

  // Reviewer finding: without an initial route, a cold deep link to e.g.
  // /models opens with no tabs beneath it — no back button, the exact
  // symptom this step fixes.
  it("always keeps the tabs beneath a deep-linked secondary screen", () => {
    expect(layout).toMatch(
      /export const unstable_settings = \{\s*initialRouteName:\s*"\(tabs\)"/,
    );
  });

  // Reviewer findings: from a secondary screen, push to a tab route stacks a
  // second tab navigator; from a focused tab, dismissTo silently does
  // nothing. The notification tap must pick per current location.
  it("opens a capsule from a notification via openRoute, using the current segments", () => {
    expect(layout).toMatch(
      /openRoute\(router, segmentsRef\.current, `\/capsules\/\$\{capsuleId\}`\)/,
    );
    expect(layout).not.toMatch(/router\.(push|dismissTo)\(/);
  });

  it("keeps the notification-tap handler (8.11)", () => {
    expect(layout).toMatch(/onNotificationTapped\(/);
  });
});

describe("tab navigator: (app)/(tabs)/_layout.tsx", () => {
  it("exists and declares exactly the four real tabs", () => {
    const tabs = read("(tabs)/_layout.tsx");
    expect(tabs).toMatch(/<Tabs[\s>]/);
    const names = [...tabs.matchAll(/<Tabs\.Screen\s+name="([^"]+)"/g)].map(
      (m) => m[1],
    );
    expect(names).toEqual(["index", "chat", "capsules", "settings"]);
  });

  it("has no hidden pseudo-tab screens", () => {
    expect(read("(tabs)/_layout.tsx")).not.toMatch(/href:\s*null/);
  });
});

describe("file placement", () => {
  it.each(["index.tsx", "chat", "capsules", "settings"])(
    "%s lives inside (tabs)",
    (entry) => {
      expect(existsSync(join(APP, "(tabs)", entry))).toBe(true);
      expect(existsSync(join(APP, entry))).toBe(false);
    },
  );

  it.each(["models", "personas", "snippets", "types", "search.tsx"])(
    "%s stays on the outer stack",
    (entry) => {
      expect(existsSync(join(APP, entry))).toBe(true);
      expect(existsSync(join(APP, "(tabs)", entry))).toBe(false);
    },
  );

  it("types has no stack of its own (its screens sit on the outer stack, so its root gets a back button)", () => {
    expect(existsSync(join(APP, "types/_layout.tsx"))).toBe(false);
  });
});

describe("command palette navigation (10.5 reviewer finding)", () => {
  const palette = readFileSync(
    join(__dirname, "../../../widgets/CommandPalette/CommandPalette.tsx"),
    "utf8",
  );

  it("navigates with dismissTo, so a tab target reuses the existing tabs", () => {
    expect(palette).toMatch(/router\.dismissTo\(/);
    expect(palette).not.toMatch(/router\.push\(/);
  });
});
