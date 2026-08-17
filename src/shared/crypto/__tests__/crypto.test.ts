// Tests for step 4.1 — written before implementation (TDD)
// "hard" depth per CLAUDE.md's create-tests guidance for anything touching
// crypto: every test here proves a real cryptographic property (round-trip
// correctness, key sensitivity, tamper detection, nonce uniqueness), not
// just that a function returns without throwing.
import { randomHex, deriveKeyHex, encryptHex, decryptHex } from "../index";

describe("randomHex", () => {
  it("returns hex of exactly the requested byte length", () => {
    const hex = randomHex(32);
    expect(hex).toHaveLength(64);
    expect(hex).toMatch(/^[0-9a-f]{64}$/);
  });

  it("produces different output on each call", () => {
    expect(randomHex(32)).not.toBe(randomHex(32));
  });
});

describe("deriveKeyHex", () => {
  it("is deterministic for the same passphrase and salt", () => {
    const salt = randomHex(16);
    expect(deriveKeyHex("correct horse", salt)).toBe(
      deriveKeyHex("correct horse", salt),
    );
  });

  it("produces a different key for a different passphrase", () => {
    const salt = randomHex(16);
    expect(deriveKeyHex("correct horse", salt)).not.toBe(
      deriveKeyHex("wrong horse", salt),
    );
  });

  it("produces a different key for a different salt", () => {
    expect(deriveKeyHex("correct horse", randomHex(16))).not.toBe(
      deriveKeyHex("correct horse", randomHex(16)),
    );
  });

  it("returns a 32-byte (AES-256) key by default", () => {
    expect(deriveKeyHex("correct horse", randomHex(16))).toHaveLength(64);
  });
});

describe("encryptHex / decryptHex — round trip", () => {
  it("recovers the exact original plaintext", () => {
    const key = randomHex(32);
    const plaintext = "a4f29c00" + "deadbeef";
    const payload = encryptHex(plaintext, key);
    expect(decryptHex(payload, key)).toBe(plaintext);
  });

  it("round-trips an empty plaintext", () => {
    const key = randomHex(32);
    const payload = encryptHex("", key);
    expect(decryptHex(payload, key)).toBe("");
  });

  it("uses a fresh IV per call — two encryptions of the same plaintext differ", () => {
    const key = randomHex(32);
    const plaintext = "deadbeef";
    const a = encryptHex(plaintext, key);
    const b = encryptHex(plaintext, key);
    expect(a.ivHex).not.toBe(b.ivHex);
    expect(a.ciphertextHex).not.toBe(b.ciphertextHex);
  });
});

describe("decryptHex — tamper and wrong-key detection", () => {
  it("throws when decrypting with the wrong key", () => {
    const payload = encryptHex("deadbeef", randomHex(32));
    expect(() => decryptHex(payload, randomHex(32))).toThrow();
  });

  it("throws when the ciphertext has been tampered with", () => {
    const key = randomHex(32);
    const payload = encryptHex("deadbeef", key);
    const tampered = {
      ...payload,
      ciphertextHex:
        payload.ciphertextHex.slice(0, -2) +
        (payload.ciphertextHex.slice(-2) === "00" ? "ff" : "00"),
    };
    expect(() => decryptHex(tampered, key)).toThrow();
  });

  it("throws when the auth tag has been tampered with", () => {
    const key = randomHex(32);
    const payload = encryptHex("deadbeef", key);
    const tampered = {
      ...payload,
      authTagHex:
        payload.authTagHex.slice(0, -2) +
        (payload.authTagHex.slice(-2) === "00" ? "ff" : "00"),
    };
    expect(() => decryptHex(tampered, key)).toThrow();
  });
});
