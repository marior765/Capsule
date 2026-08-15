// Tests for step 1.6.1 — written before implementation (TDD)
import { prepareCodeForCopy } from "../prepareCodeForCopy";

describe("prepareCodeForCopy — happy path", () => {
  it("returns code unchanged when there is no trailing newline", () => {
    expect(prepareCodeForCopy("const x = 1;")).toBe("const x = 1;");
  });

  it("trims exactly one trailing newline the markdown parser adds", () => {
    // react-native-markdown-display's own fence node.content carries this
    // extra newline — mirroring its rule so copied code matches what's shown.
    expect(prepareCodeForCopy("const x = 1;\n")).toBe("const x = 1;");
  });

  it("preserves internal blank lines and indentation", () => {
    const code = "function f() {\n  return 1;\n\n  // trailing comment\n}";
    expect(prepareCodeForCopy(code)).toBe(code);
  });
});

describe("prepareCodeForCopy — edge cases", () => {
  it("trims only one of several trailing newlines, preserving the rest", () => {
    expect(prepareCodeForCopy("const x = 1;\n\n\n")).toBe("const x = 1;\n\n");
  });

  it("returns an empty string unchanged", () => {
    expect(prepareCodeForCopy("")).toBe("");
  });

  it("reduces a single newline to an empty string", () => {
    expect(prepareCodeForCopy("\n")).toBe("");
  });

  it("does not touch a leading newline", () => {
    expect(prepareCodeForCopy("\nconst x = 1;")).toBe("\nconst x = 1;");
  });
});
