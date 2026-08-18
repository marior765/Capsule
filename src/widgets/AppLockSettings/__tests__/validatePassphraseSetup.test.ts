// Tests for step 4.4 — written before implementation (TDD)
import { validatePassphraseSetup } from "../validatePassphraseSetup";

describe("validatePassphraseSetup", () => {
  it("accepts a non-empty passphrase that matches its confirmation", () => {
    expect(validatePassphraseSetup("hunter2", "hunter2")).toBeNull();
  });

  it("rejects an empty passphrase", () => {
    expect(validatePassphraseSetup("", "")).toBe("empty");
  });

  it("rejects a whitespace-only passphrase", () => {
    expect(validatePassphraseSetup("   ", "   ")).toBe("empty");
  });

  it("rejects a mismatched confirmation", () => {
    expect(validatePassphraseSetup("hunter2", "hunter3")).toBe("mismatch");
  });

  it("checks emptiness before mismatch — an empty passphrase against a non-empty confirmation is still 'empty', not 'mismatch'", () => {
    expect(validatePassphraseSetup("", "x")).toBe("empty");
  });
});
