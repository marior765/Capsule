// Tests for step 10.13 — written before implementation (TDD)
//
// Found in the simulator: the notification-permission prompt read
// "“capsule” Would Like to Send You Notifications". iOS shows the app's
// display name, which Expo takes from `expo.name` in app.json.
import { readFileSync } from "fs";
import { join } from "path";

type AppJson = { expo: { name: string; slug: string; scheme: string } };

const appJson = JSON.parse(
  readFileSync(join(__dirname, "../../../../app.json"), "utf8"),
) as AppJson;

describe("app display name (10.13)", () => {
  it("is shown to people as “Capsule”", () => {
    expect(appJson.expo.name).toBe("Capsule");
  });

  // The slug and URL scheme are identifiers, not display text: renaming the
  // scheme would break existing capsule:// links (notification taps, deep
  // links), so they stay lowercase.
  it("keeps the slug and URL scheme unchanged", () => {
    expect(appJson.expo.slug).toBe("capsule");
    expect(appJson.expo.scheme).toBe("capsule");
  });
});
