// Tests for step 10.12 — written before implementation (TDD)
//
// Found in the simulator: Capsule types could only be reached from the
// command palette or the Capsules empty state (Settings didn't list them),
// and the Capsules tab had no visible way to create a capsule except Quick
// capture — the full form was palette-only.
import { readFileSync } from "fs";
import { join } from "path";

const TABS = join(__dirname, "../../../app/(app)/(tabs)");
const settings = readFileSync(join(TABS, "settings/index.tsx"), "utf8");
const capsulesLayout = readFileSync(join(TABS, "capsules/_layout.tsx"), "utf8");
const typesNew = readFileSync(
  join(__dirname, "../../../app/(app)/types/new.tsx"),
  "utf8",
);

describe("entry points (10.12)", () => {
  it("lists Capsule types in Settings", () => {
    expect(settings).toMatch(
      /label:\s*"Capsule types"[\s\S]*?href:\s*"\/types"/,
    );
  });

  it("puts a New capsule button in the Capsules list header", () => {
    const indexScreen = capsulesLayout.slice(
      capsulesLayout.indexOf('name="index"'),
      capsulesLayout.indexOf('name="new"'),
    );
    expect(indexScreen).toMatch(/headerRight:/);
    expect(capsulesLayout).toMatch(/router\.push\("\/capsules\/new"\)/);
    expect(capsulesLayout).toMatch(/testID=\{testIDs\.buttons\.newCapsule\}/);
    expect(capsulesLayout).toMatch(/accessibilityLabel="New capsule"/);
  });

  // Creating a type from the Capsules empty state used to land on the types
  // list; types/new now leaves through leaveScreen (10.3), which pops back to
  // whichever tab opened it.
  it("returns from New type to wherever it was opened from", () => {
    expect(typesNew).toMatch(/leaveScreen\(router,/);
  });
});

// Regression found on a cold launch (10.12): a module-level
// StyleSheet.create in a nested _layout.tsx runs before unistyles is
// configured — expo-router evaluates layouts before the root layout's
// providers import the unistyles setup — and crashes the app on start. Hot
// reload hid it. Layouts must read the theme at render time instead.
describe("layout files and unistyles", () => {
  const { readdirSync, statSync } =
    jest.requireActual<typeof import("fs")>("fs");
  function layouts(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) return layouts(path);
      return name === "_layout.tsx" ? [path] : [];
    });
  }

  it.each(layouts(join(__dirname, "../../../app")).map((p) => [p]))(
    "%s creates no stylesheet at module load",
    (path) => {
      expect(readFileSync(path, "utf8")).not.toMatch(/StyleSheet\.create\(/);
    },
  );
});
