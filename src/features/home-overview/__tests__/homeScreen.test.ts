// Tests for step 10.11 — written before implementation (TDD)
//
// Static checks on the Home route (no render library here — see BLOCKED.md):
// the title clears the status bar (it sat under the clock), and the screen
// shows recent capsules and conversations, refreshed whenever Home is shown.
import { readFileSync } from "fs";
import { join } from "path";

const home = readFileSync(
  join(__dirname, "../../../app/(app)/(tabs)/index.tsx"),
  "utf8",
);

describe("Home route (10.11)", () => {
  it("insets its content below the status bar", () => {
    expect(home).toMatch(/from "react-native-safe-area-context"/);
    expect(home).toMatch(/<SafeAreaView[^>]*edges=\{\[\s*"top"\s*\]\}/);
  });

  it("loads recent activity, again on every visit", () => {
    expect(home).toMatch(/from "@\/features\/home-overview"/);
    expect(home).toMatch(/useFocusEffect\(/);
    expect(home).toMatch(/getRecentActivity\(db\)/);
  });

  it("lists recent capsules and conversations with testIDs from the testIDs object", () => {
    expect(home).toMatch(/testID=\{`\$\{testIDs\.pressables\.capsule\}_\$\{/);
    expect(home).toMatch(
      /testID=\{`\$\{testIDs\.pressables\.conversation\}_\$\{/,
    );
  });

  it("opens a capsule or conversation with push (Home is inside the tabs)", () => {
    expect(home).toMatch(/router\.push\(`\/capsules\/\$\{/);
    expect(home).toMatch(/router\.push\(`\/chat\/\$\{/);
  });

  it("says so when there's nothing yet", () => {
    expect(home).toMatch(/No capsules yet/);
    expect(home).toMatch(/No conversations yet/);
  });
});
