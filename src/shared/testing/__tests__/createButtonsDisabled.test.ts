// Tests for step 10.30 — written before implementation (TDD)
//
// Found in the simulator: "Create persona" / "Create snippet" looked tappable
// with empty fields and silently did nothing, while "Create type" is greyed
// out until its name is filled. All three now behave the same way.
import { readFileSync } from "fs";
import { join } from "path";

const read = (route: string) =>
  readFileSync(join(__dirname, "../../../app/(app)", route), "utf8");

describe.each([
  ["personas/index.tsx", "name", "systemPrompt"],
  ["snippets/index.tsx", "title", "content"],
])("%s save button (static)", (route, first, second) => {
  const src = read(route);

  it("is enabled only once both required fields have text", () => {
    expect(src).toMatch(
      new RegExp(
        `const canSave =\\s*${first}\\.trim\\(\\) !== "" && ${second}\\.trim\\(\\) !== "";`,
      ),
    );
    expect(src).toMatch(/disabled=\{!canSave\}/);
    expect(src).toMatch(/accessibilityState=\{\{ disabled: !canSave \}\}/);
    expect(src).toMatch(/!canSave && styles\.primaryDisabled/);
  });
});

describe("other add/save buttons that ignored empty input (static)", () => {
  it.each([
    ["app/(app)/types/[id].tsx", "!name.trim()"],
    ["widgets/QuickCapture/QuickCapture.tsx", "!title.trim()"],
    ["widgets/TagPicker/TagPicker.tsx", "!draftName.trim()"],
  ])("%s is disabled while empty", (file, condition) => {
    const src = readFileSync(join(__dirname, "../../..", file), "utf8");
    expect(src).toContain(`disabled={${condition}}`);
    expect(src).toContain(`accessibilityState={{ disabled: ${condition} }}`);
  });
});
