// Tests for step 10.32 — written before implementation (TDD)
//
// Found in the simulator: under the "Settings" header the screen repeated
// "Settings" as its first line (and "Inference" did the same). The header
// already names the screen.
import { readFileSync } from "fs";
import { join } from "path";

const SETTINGS = join(__dirname, "../../../app/(app)/(tabs)/settings");
const layout = readFileSync(join(SETTINGS, "_layout.tsx"), "utf8");
const titles = [
  ...layout.matchAll(/name="([^"]+)"[\s\S]*?title: "([^"]+)"/g),
].map((m) => [m[1], m[2]] as const);

describe("settings screens don't repeat their header title", () => {
  it("found the stack's titles", () => {
    expect(titles.length).toBeGreaterThanOrEqual(5);
  });

  it.each(titles)("%s (%s)", (name, title) => {
    const screen = readFileSync(join(SETTINGS, `${name}.tsx`), "utf8");
    const escaped = title.replace(/[.*+?^${}()|[\]\\&]/g, "\\$&");
    expect(screen).not.toMatch(
      new RegExp(`style=\\{styles\\.heading\\}>\\s*${escaped}\\s*</Text>`),
    );
  });
});
