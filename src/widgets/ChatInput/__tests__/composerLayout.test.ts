// Tests for step 10.7 — written before implementation (TDD)
//
// Found in the simulator: the message box shared one row with the mic AND
// the "Snippets" / "Capsules: off" / "Image" labels, so it was squeezed to a
// few characters ("Mes / sag / e") and its width jumped whenever a label
// changed ("Snippets" ↔ "Close", "Capsules: on" ↔ "off"). The labels now
// live in their own toolbar row; the input row holds only the mic and the
// box. Static checks (no render library here — see BLOCKED.md).
import { readFileSync } from "fs";
import { join } from "path";

const APP = join(__dirname, "../../../app/(app)/(tabs)/chat");
const chatInput = readFileSync(join(__dirname, "../ChatInput.tsx"), "utf8");

/** The JSX of the first `<View style={styles.<name>}>…</View>` block. */
function viewBlock(source: string, styleName: string): string {
  const open = `<View style={styles.${styleName}}>`;
  const start = source.indexOf(open);
  if (start === -1) return "";
  let depth = 0;
  const tag = /<View\b|<\/View>/g;
  tag.lastIndex = start;
  for (let m = tag.exec(source); m; m = tag.exec(source)) {
    depth += m[0] === "</View>" ? -1 : 1;
    if (depth === 0) return source.slice(start, m.index + m[0].length);
  }
  return source.slice(start);
}

describe.each([["[id].tsx"], ["ephemeral.tsx"]])("chat/%s composer", (file) => {
  const source = readFileSync(join(APP, file), "utf8");

  it("has a toolbar row holding the text controls", () => {
    const toolbar = viewBlock(source, "toolbar");
    expect(toolbar).toContain("testIDs.buttons.snippets");
    if (file === "[id].tsx") {
      expect(toolbar).toContain("testIDs.buttons.capsules");
      expect(toolbar).toContain("testIDs.buttons.image");
    }
  });

  it("keeps only the mic and the message box in the input row", () => {
    const inputRow = viewBlock(source, "inputRow");
    expect(inputRow).toContain("<VoiceRecordButton");
    expect(inputRow).toContain("<ChatInput");
    expect(inputRow).not.toMatch(/testIDs\.buttons\.(snippets|capsules|image)/);
  });
});

describe("ChatInput", () => {
  it("disables Send (look and behaviour) until there's text", () => {
    expect(chatInput).toMatch(/const sendable = canSend\(text, disabled\)/);
    expect(chatInput).toMatch(/disabled=\{!sendable\}/);
    expect(chatInput).toMatch(/!sendable && styles\.sendDisabled/);
  });
});
