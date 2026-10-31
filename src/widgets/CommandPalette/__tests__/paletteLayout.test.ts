// Tests for step 10.4 — written before implementation (TDD)
//
// Found in the simulator: the palette's input rendered under the status bar
// and Dynamic Island — taps landed on the system clock, so nothing could be
// typed — and there was no way to close it. The palette lives in a hidden
// tab screen (`headerShown: false`), so nothing above it inset the content.
//
// This repo has no component-render test library (adding one is queued as
// a decision in BLOCKED.md), so these are static guards on the widget's
// source, in the style of shared/testing's routeTestIDs scan. The visual
// result was checked in the iOS simulator.
import { readFileSync } from "fs";
import { join } from "path";

const source = readFileSync(join(__dirname, "../CommandPalette.tsx"), "utf8");

describe("CommandPalette layout (10.4)", () => {
  it("insets its content below the status bar / Dynamic Island", () => {
    expect(source).toMatch(/from "react-native-safe-area-context"/);
    expect(source).toMatch(/<SafeAreaView[^>]*edges=\{\[\s*"top"\s*\]\}/);
  });

  it("has a close control with a testID from the testIDs object", () => {
    // Written before render tests existed (10.38), so the testIDs
    // declaration is read as text; a render test could now check this too.
    expect(source).toMatch(/buttons:\s*\[[^\]]*"close"[^\]]*\]/);
    expect(source).toMatch(/testID=\{testIDs\.buttons\.close\}/);
  });

  it("closes through a caller-supplied onClose (no navigation decided inside the widget)", () => {
    expect(source).toMatch(/onPress=\{onClose\}/);
  });

  it("focuses the input every time the palette comes into view, not only on first mount", () => {
    // Hidden tab screens stay mounted, so `autoFocus` fires once; reopening
    // the palette must focus the input again.
    expect(source).toMatch(/useFocusEffect\(/);
    expect(source).toMatch(/inputRef\.current\?\.focus\(\)/);
  });
});
