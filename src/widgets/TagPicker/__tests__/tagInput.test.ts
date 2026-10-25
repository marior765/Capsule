// Tests for step 10.23 — written before implementation (TDD)
//
// Found in the simulator: the tag box had autocorrect on, so a tag could be
// changed by the keyboard before Add. Tags are names the user chooses, not prose.
import { readFileSync } from "fs";
import { join } from "path";

describe("TagPicker's tag input (static)", () => {
  const src = readFileSync(join(__dirname, "../TagPicker.tsx"), "utf8");
  const input = src.slice(
    src.indexOf("<TextInput"),
    src.indexOf("/>", src.indexOf("<TextInput")),
  );

  it("turns off autocorrect, capitalisation and spelling suggestions", () => {
    expect(input).toMatch(/autoCorrect=\{false\}/);
    expect(input).toMatch(/autoCapitalize="none"/);
    expect(input).toMatch(/spellCheck=\{false\}/);
  });
});
