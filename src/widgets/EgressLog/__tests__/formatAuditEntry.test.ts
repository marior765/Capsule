// Tests for step 4.3 — written before implementation (TDD)
import { formatAuditAction, formatAuditTimestamp } from "../formatAuditEntry";

describe("formatAuditAction", () => {
  it.each([
    ["export", "Exported data"],
    ["decrypt", "Vault unlocked"],
    ["wipe", "Data wiped"],
    ["model_download", "Model downloaded"],
  ] as const)("formats %s as a human-readable label", (action, expected) => {
    expect(formatAuditAction(action)).toBe(expected);
  });
});

describe("formatAuditTimestamp", () => {
  it("returns a non-empty string", () => {
    expect(formatAuditTimestamp(Date.now())).not.toBe("");
  });

  it("produces different output for different timestamps", () => {
    const a = formatAuditTimestamp(new Date("2020-01-01T00:00:00Z").getTime());
    const b = formatAuditTimestamp(new Date("2026-08-17T12:00:00Z").getTime());
    expect(a).not.toBe(b);
  });
});
