// Tests for step 0.4 — written before implementation (TDD)
import {
  BottomTabInset,
  Colors,
  Fonts,
  MaxContentWidth,
  Spacing,
} from "../theme";

const REQUIRED_COLOR_TOKENS = [
  "text",
  "background",
  "backgroundElement",
  "backgroundSelected",
  "textSecondary",
] as const;

const REQUIRED_SPACING_TOKENS = [
  "half",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
] as const;

const REQUIRED_FONT_TOKENS = ["sans", "serif", "rounded", "mono"] as const;

describe("Colors", () => {
  it("defines light and dark modes", () => {
    expect(Colors.light).toBeDefined();
    expect(Colors.dark).toBeDefined();
  });

  it.each(REQUIRED_COLOR_TOKENS)(
    "light.%s is a non-empty hex string",
    (token) => {
      expect(Colors.light[token]).toMatch(/^#[0-9a-fA-F]{6}$/);
    },
  );

  it.each(REQUIRED_COLOR_TOKENS)(
    "dark.%s is a non-empty hex string",
    (token) => {
      expect(Colors.dark[token]).toMatch(/^#[0-9a-fA-F]{6}$/);
    },
  );

  it("light and dark have the same token set", () => {
    expect(Object.keys(Colors.light).sort()).toEqual(
      Object.keys(Colors.dark).sort(),
    );
  });
});

describe("Spacing", () => {
  it.each(REQUIRED_SPACING_TOKENS)("%s is a positive number", (token) => {
    expect(typeof Spacing[token]).toBe("number");
    expect(Spacing[token]).toBeGreaterThan(0);
  });

  it("tokens are in ascending order", () => {
    const values = REQUIRED_SPACING_TOKENS.map((t) => Spacing[t]);
    const sorted = [...values].sort((a, b) => a - b);
    expect(values).toEqual(sorted);
  });
});

describe("Fonts", () => {
  it("is defined", () => {
    expect(Fonts).toBeDefined();
  });

  it.each(REQUIRED_FONT_TOKENS)("defines %s font", (token) => {
    expect(Fonts?.[token]).toBeTruthy();
  });
});

describe("Layout constants", () => {
  it("MaxContentWidth is a positive number", () => {
    expect(typeof MaxContentWidth).toBe("number");
    expect(MaxContentWidth).toBeGreaterThan(0);
  });

  it("BottomTabInset is a non-negative number", () => {
    expect(typeof BottomTabInset).toBe("number");
    expect(BottomTabInset).toBeGreaterThanOrEqual(0);
  });
});
