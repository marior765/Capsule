// Tests for step 10.26 — written before implementation (TDD)
//
// Found in the simulator: a selected filter or sort chip was a barely
// different shade of grey from the others, so you couldn't tell what was on.
import { readFileSync } from "fs";
import { join } from "path";

const src = readFileSync(join(__dirname, "../FilterSheet.tsx"), "utf8");
const styleBlock = (name: string) => {
  const start = src.indexOf(`  ${name}: {`);
  return src.slice(start, src.indexOf("},", start));
};

describe("FilterSheet selected chips (static)", () => {
  it("fill selected chips with the accent colour, like the app's other chips", () => {
    expect(styleBlock("chipSelected")).toMatch(/theme\.colors\.accent/);
  });

  it("switch the label to a contrasting colour on every selected chip", () => {
    expect(styleBlock("chipLabelSelected")).toMatch(
      /theme\.colors\.background/,
    );
    // All, each type, and each sort option.
    expect(
      src.match(/styles\.chipLabelSelected/g)?.length,
    ).toBeGreaterThanOrEqual(3);
  });
});
