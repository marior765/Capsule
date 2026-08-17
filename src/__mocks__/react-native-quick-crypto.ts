// Mock for react-native-quick-crypto — its own public API is intentionally
// modeled on Node's builtin `crypto` module (its own .d.ts imports Node's
// `crypto` types for cipher options). Rather than hand-fake AES-GCM/scrypt
// behavior, this delegates straight to real Node crypto — jest itself runs
// on Node, so this is genuine encryption, genuine key derivation, and a
// genuine auth-tag check on decrypt, not an approximation of one. Only the
// native (Nitro) binding is mocked; the cryptographic behavior is real.
import { Buffer as NodeBuffer } from "node:buffer";
import * as nodeCrypto from "node:crypto";

export const Buffer = NodeBuffer;
export const randomBytes = nodeCrypto.randomBytes;
export const scryptSync = nodeCrypto.scryptSync;
export const createCipheriv = nodeCrypto.createCipheriv;
export const createDecipheriv = nodeCrypto.createDecipheriv;
