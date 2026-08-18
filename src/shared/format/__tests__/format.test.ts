// Tests for step 5.1 — written before implementation (TDD)
import {
  CURRENT_FORMAT_VERSION,
  wrapPortable,
  unwrapPortable,
  serializePortable,
  parsePortable,
  PortableFormatError,
} from "../index";

type FakeConversation = { id: string; title: string };

describe("wrapPortable", () => {
  it("wraps data with the current format version, kind, and a timestamp", () => {
    const envelope = wrapPortable("conversation", { id: "c1", title: "Hi" });
    expect(envelope.formatVersion).toBe(CURRENT_FORMAT_VERSION);
    expect(envelope.kind).toBe("conversation");
    expect(typeof envelope.exportedAt).toBe("number");
    expect(envelope.data).toEqual({ id: "c1", title: "Hi" });
  });
});

describe("unwrapPortable — happy path", () => {
  it("returns the original data when kind matches", () => {
    const envelope = wrapPortable("conversation", { id: "c1", title: "Hi" });
    const data = unwrapPortable<FakeConversation>(envelope, "conversation");
    expect(data).toEqual({ id: "c1", title: "Hi" });
  });
});

describe("unwrapPortable — error handling", () => {
  it("rejects a mismatched kind", () => {
    const envelope = wrapPortable("conversation", { id: "c1", title: "Hi" });
    expect(() => unwrapPortable(envelope, "capsule")).toThrow(
      PortableFormatError,
    );
  });

  it("rejects an envelope from a newer, unsupported format version", () => {
    const envelope = wrapPortable("conversation", { id: "c1", title: "Hi" });
    const fromTheFuture = {
      ...envelope,
      formatVersion: CURRENT_FORMAT_VERSION + 1,
    };
    expect(() => unwrapPortable(fromTheFuture, "conversation")).toThrow(
      PortableFormatError,
    );
  });

  it("names both the expected and actual kind in the error message", () => {
    const envelope = wrapPortable("conversation", { id: "c1", title: "Hi" });
    try {
      unwrapPortable(envelope, "capsule");
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(PortableFormatError);
      expect((e as Error).message).toContain("capsule");
      expect((e as Error).message).toContain("conversation");
    }
  });
});

describe("serializePortable / parsePortable — round trip", () => {
  it("round-trips a plain object exactly", () => {
    const original: FakeConversation = { id: "c1", title: "Hello, world" };
    const json = serializePortable("conversation", original);
    const restored = parsePortable<FakeConversation>(json, "conversation");
    expect(restored).toEqual(original);
  });

  it("round-trips nested structures (arrays, nested objects)", () => {
    const original = {
      id: "c1",
      messages: [
        { id: "m1", role: "user", content: "hi" },
        { id: "m2", role: "assistant", content: "hello" },
      ],
      meta: { model: "llama-3.2", tags: ["a", "b"] },
    };
    const json = serializePortable("conversation", original);
    const restored = parsePortable(json, "conversation");
    expect(restored).toEqual(original);
  });

  it("produces human-readable (indented) JSON, not a minified blob", () => {
    const json = serializePortable("conversation", { id: "c1" });
    expect(json).toContain("\n");
  });
});

describe("parsePortable — error handling", () => {
  it("rejects malformed JSON", () => {
    expect(() => parsePortable("not json {{{", "conversation")).toThrow(
      PortableFormatError,
    );
  });

  it("rejects valid JSON missing a formatVersion field", () => {
    const json = JSON.stringify({ kind: "conversation", data: {} });
    expect(() => parsePortable(json, "conversation")).toThrow(
      PortableFormatError,
    );
  });

  it("rejects valid JSON missing a data field", () => {
    const json = JSON.stringify({
      formatVersion: CURRENT_FORMAT_VERSION,
      kind: "conversation",
    });
    expect(() => parsePortable(json, "conversation")).toThrow(
      PortableFormatError,
    );
  });

  it("rejects a kind mismatch, same as unwrapPortable", () => {
    const json = serializePortable("conversation", { id: "c1" });
    expect(() => parsePortable(json, "capsule")).toThrow(PortableFormatError);
  });

  it("rejects a non-object JSON value (e.g. a bare array or string)", () => {
    expect(() =>
      parsePortable(JSON.stringify([1, 2, 3]), "conversation"),
    ).toThrow(PortableFormatError);
    expect(() =>
      parsePortable(JSON.stringify("just a string"), "conversation"),
    ).toThrow(PortableFormatError);
  });
});
