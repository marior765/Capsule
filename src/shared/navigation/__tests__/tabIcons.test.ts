// Tests for step 10.10 — written before implementation (TDD)
//
// Found in the simulator: every tab showed the same grey placeholder
// triangle (the default when a Tabs.Screen has no tabBarIcon). Each tab now
// gets a real symbol — SF Symbols on iOS, Material Symbols on Android via
// expo-symbols — tinted with the bar's active/inactive colour.
import { readFileSync } from "fs";
import { join } from "path";

const layout = readFileSync(
  join(__dirname, "../../../app/(app)/(tabs)/_layout.tsx"),
  "utf8",
);

describe("(tabs) tab bar icons (10.10)", () => {
  it("renders icons with expo-symbols", () => {
    expect(layout).toMatch(/from "expo-symbols"/);
    expect(layout).toMatch(/<SymbolView\b/);
  });

  /** The `<Tabs.Screen name="…" … />` element for `name`, and nothing after it. */
  function screen(name: string): string {
    const start = layout.indexOf(`<Tabs.Screen\n        name="${name}"`);
    const fallback = layout.indexOf(`<Tabs.Screen name="${name}"`);
    const from = start !== -1 ? start : fallback;
    if (from === -1) return "";
    const next = layout.indexOf("<Tabs.Screen", from + 1);
    return layout.slice(from, next === -1 ? undefined : next);
  }

  it.each(["index", "chat", "capsules", "settings"])(
    "gives the %s tab its own icon",
    (name) => {
      expect(screen(name)).toMatch(/tabBarIcon:\s*tabIcon\(/);
    },
  );

  it("names an iOS and an Android symbol for every tab", () => {
    const icons = [
      ...layout.matchAll(/ios:\s*"([^"]+)"[\s\S]*?android:\s*"([^"]+)"/g),
    ];
    expect(icons.length).toBeGreaterThanOrEqual(4);
  });

  it("tints icons with the bar's colour and fills the focused one", () => {
    expect(layout).toMatch(/tintColor=\{color\}/);
    expect(layout).toMatch(/const symbol = focused \? filled : outline/);
  });
});
