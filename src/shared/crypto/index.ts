import {
  Buffer,
  randomBytes,
  scryptSync,
  createCipheriv,
  createDecipheriv,
} from "react-native-quick-crypto";

// AES-256-GCM throughout: 32-byte key, 12-byte nonce (NIST-recommended for
// GCM), 16-byte auth tag. This module has no idea what it's encrypting —
// domain concerns (the vault master key, its passphrase-derived wrapping
// key) live in features/encrypt-vault; this is a generic primitive layer,
// same principle as shared/llm owning llama.rn.
const KEY_LENGTH_BYTES = 32;
const IV_LENGTH_BYTES = 12;

export type EncryptedPayload = {
  ivHex: string;
  authTagHex: string;
  ciphertextHex: string;
};

/** Cryptographically random bytes, hex-encoded. */
export function randomHex(byteLength: number): string {
  return randomBytes(byteLength).toString("hex");
}

/**
 * Derives a symmetric key from a low-entropy secret (a user passphrase) and
 * a salt via scrypt — deliberately slow and memory-hard, unlike a plain
 * hash, to resist brute-forcing an offline-stolen wrapped key. `saltHex`
 * must be unique per derivation (a fresh `randomHex` per vault) and stored
 * alongside the wrapped output; the salt is not a secret itself.
 */
export function deriveKeyHex(
  passphrase: string,
  saltHex: string,
  keyLengthBytes: number = KEY_LENGTH_BYTES,
): string {
  return scryptSync(
    passphrase,
    Buffer.from(saltHex, "hex"),
    keyLengthBytes,
  ).toString("hex");
}

/**
 * Encrypts hex-encoded plaintext with AES-256-GCM under a fresh, random IV
 * on every call — reusing an IV with the same key is a real GCM key-recovery
 * risk, so this never accepts a caller-supplied one.
 */
export function encryptHex(
  plaintextHex: string,
  keyHex: string,
): EncryptedPayload {
  const iv = randomBytes(IV_LENGTH_BYTES);
  const cipher = createCipheriv("aes-256-gcm", Buffer.from(keyHex, "hex"), iv);
  const ciphertext = Buffer.concat([
    cipher.update(Buffer.from(plaintextHex, "hex")),
    cipher.final(),
  ]);
  return {
    ivHex: iv.toString("hex"),
    authTagHex: cipher.getAuthTag().toString("hex"),
    ciphertextHex: ciphertext.toString("hex"),
  };
}

/**
 * Decrypts a payload produced by `encryptHex`. Throws if `keyHex` is wrong
 * or if the ciphertext/auth tag has been tampered with — GCM's auth tag
 * verification (run inside `.final()`) is what actually detects both; this
 * function does not add any check of its own beyond letting that throw.
 */
export function decryptHex(payload: EncryptedPayload, keyHex: string): string {
  const decipher = createDecipheriv(
    "aes-256-gcm",
    Buffer.from(keyHex, "hex"),
    Buffer.from(payload.ivHex, "hex"),
  );
  decipher.setAuthTag(Buffer.from(payload.authTagHex, "hex"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertextHex, "hex")),
    decipher.final(),
  ]);
  return plaintext.toString("hex");
}
