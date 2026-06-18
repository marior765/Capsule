// Tests for step 0.3 — written before implementation (TDD)
import {
  getBoolean,
  getNumber,
  getString,
  remove,
  setBoolean,
  setNumber,
  setString,
} from "../index";

describe("shared/storage — happy path", () => {
  it("stores and retrieves a string", () => {
    setString("user.name", "Denys");
    expect(getString("user.name")).toBe("Denys");
  });

  it("stores and retrieves a number", () => {
    setNumber("app.version", 42);
    expect(getNumber("app.version")).toBe(42);
  });

  it("stores and retrieves a boolean", () => {
    setBoolean("feature.enabled", true);
    expect(getBoolean("feature.enabled")).toBe(true);
  });

  it("overwrites an existing key", () => {
    setString("overwrite.test", "first");
    setString("overwrite.test", "second");
    expect(getString("overwrite.test")).toBe("second");
  });
});

describe("shared/storage — edge cases", () => {
  it("returns undefined for a missing string key", () => {
    expect(getString("nonexistent.key")).toBeUndefined();
  });

  it("returns undefined for a missing number key", () => {
    expect(getNumber("nonexistent.number")).toBeUndefined();
  });

  it("returns undefined for a missing boolean key", () => {
    expect(getBoolean("nonexistent.bool")).toBeUndefined();
  });

  it("returns undefined when key type mismatches stored type", () => {
    setString("typed.key", "hello");
    expect(getNumber("typed.key")).toBeUndefined();
    expect(getBoolean("typed.key")).toBeUndefined();
  });

  it("removes a key", () => {
    setString("removable.key", "value");
    remove("removable.key");
    expect(getString("removable.key")).toBeUndefined();
  });
});

describe("shared/storage — error handling", () => {
  it("throws when setting an empty key", () => {
    expect(() => setString("", "value")).toThrow();
  });
});
