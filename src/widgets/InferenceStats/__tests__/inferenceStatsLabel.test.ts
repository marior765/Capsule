// Tests for step 10.16 — written before implementation (TDD)
// Static check: the widget renders the labelled formatter, and the chat
// screen feeds it the model's real count and the configured window size.
import { readFileSync } from "fs";
import { join } from "path";

const widget = readFileSync(join(__dirname, "../InferenceStats.tsx"), "utf8");
const chat = readFileSync(
  join(__dirname, "../../../app/(app)/(tabs)/chat/[id].tsx"),
  "utf8",
);

describe("InferenceStats / chat wiring (10.16)", () => {
  it("renders the labelled context text", () => {
    expect(widget).toMatch(/formatContextUsage\(/);
    expect(widget).not.toMatch(/ ctx`/);
  });

  it("chat passes the window size and an estimate flag", () => {
    expect(chat).toMatch(/contextTotal=\{/);
    expect(chat).toMatch(/contextApproximate=\{/);
    expect(chat).toMatch(/contextLength/);
  });

  it("chat no longer sums stored reply token counts", () => {
    expect(chat).not.toMatch(/sum \+ m\.tokenCount/);
  });

  // Reviewer finding: the model's count belongs to the branch it was
  // reported for. Switching branches — or a send that failed — must fall
  // back to the "≈" estimate rather than show a stale exact number.
  it("drops the reported count on a branch switch and after a failed send", () => {
    const switchFn = chat.slice(chat.indexOf("const handleSwitchBranch"));
    expect(switchFn.slice(0, switchFn.indexOf("\n  };"))).toMatch(
      /setReportedContext\(null\)/,
    );
    const catchBlock = chat.slice(
      chat.indexOf(
        "} catch (e) {",
        chat.indexOf("const turn = await sendMessage"),
      ),
    );
    expect(catchBlock.slice(0, catchBlock.indexOf("} finally"))).toMatch(
      /setReportedContext\(null\)/,
    );
  });
});
