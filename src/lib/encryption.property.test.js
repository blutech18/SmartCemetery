// Property-based + unit tests for the encryption service.
// Covers spec tasks 4.2, 4.3, 4.4, 4.5 of "complete-smart-cemetery-platform".
// Design Properties 6, 7, 8 and Requirements 3.3, 3.4.

// The module reads process.env.ENCRYPTION_KEY at call time (32-byte hex).
// Set a valid key BEFORE any encrypt/decrypt runs so the happy-path tests work.
const VALID_KEY =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"; // 64 hex chars = 32 bytes
process.env.ENCRYPTION_KEY = VALID_KEY;

import { describe, it, expect, beforeAll, afterEach } from "vitest";
import fc from "fast-check";
import {
  encrypt,
  decrypt,
  assertKeyValid,
  encryptField,
  decryptField,
  EncryptionKeyError,
  DecryptionError,
} from "@/lib/encryption.js";

const NUM_RUNS = 100;

beforeAll(() => {
  process.env.ENCRYPTION_KEY = VALID_KEY;
});

// Always leave a valid key in place so tests that mutate the env for error
// conditions do not bleed into other tests in this file.
afterEach(() => {
  process.env.ENCRYPTION_KEY = VALID_KEY;
});

// Non-empty, non-whitespace-only string generator (the input space for which a
// sensitive field is actually encrypted rather than stored as null).
const nonEmptyValue = fc.string({ minLength: 1 }).filter((s) => s.trim() !== "");

describe("Property 6 (task 4.2): Sensitive-field encryption round-trips", () => {
  // **Validates: Requirements 3.5, 3.2**
  it("decryptField(encryptField(value)) === value for any non-empty string", () => {
    fc.assert(
      fc.property(nonEmptyValue, (value) => {
        const stored = encryptField(value);
        expect(stored).not.toBeNull();
        expect(decryptField(stored)).toBe(value);
      }),
      { numRuns: NUM_RUNS }
    );
  });

  it("decrypt(encrypt(x)) === x for any non-empty value", () => {
    // Empty values are never persisted (they become null via encryptField,
    // see Property 8), so the round-trip contract applies to non-empty input.
    fc.assert(
      fc.property(nonEmptyValue, (value) => {
        expect(decrypt(encrypt(value))).toBe(value);
      }),
      { numRuns: NUM_RUNS }
    );
  });
});

describe("Property 7 (task 4.3): Ciphertext never exposes plaintext", () => {
  // **Validates: Requirements 3.1**
  // Use non-trivial values so the substring check reflects true confidentiality
  // rather than coincidental single-character overlaps with the base64 envelope
  // and its ":" separators (e.g. a plaintext of just ":" or "A").
  const confidentialValue = fc
    .string({ minLength: 8, maxLength: 200 })
    .filter((s) => s.trim() !== "");

  it("encrypted form differs from plaintext and does not contain it as a substring", () => {
    fc.assert(
      fc.property(confidentialValue, (value) => {
        const stored = encryptField(value);
        expect(stored).not.toBeNull();
        expect(stored).not.toBe(value);
        expect(stored.includes(value)).toBe(false);
      }),
      { numRuns: NUM_RUNS }
    );
  });
});

describe("Property 8 (task 4.4): Empty sensitive values are stored as null without encryption", () => {
  // **Validates: Requirements 3.6**
  const emptyLike = fc.oneof(
    fc.constant(null),
    fc.constant(undefined),
    fc.constant(""),
    // whitespace-only strings
    fc
      .array(fc.constantFrom(" ", "\t", "\n", "\r", "\f", "\v"), {
        minLength: 1,
        maxLength: 10,
      })
      .map((chars) => chars.join(""))
  );

  it("encryptField returns null for null/undefined/empty/whitespace-only input", () => {
    fc.assert(
      fc.property(emptyLike, (value) => {
        expect(encryptField(value)).toBeNull();
      }),
      { numRuns: NUM_RUNS }
    );
  });
});

describe("Unit tests (task 4.5): encryption error conditions", () => {
  // **Validates: Requirements 3.3, 3.4**

  describe("invalid/absent encryption key raises EncryptionKeyError (Req 3.3)", () => {
    it("throws when ENCRYPTION_KEY is missing", () => {
      delete process.env.ENCRYPTION_KEY;
      expect(() => assertKeyValid()).toThrow(EncryptionKeyError);
      expect(() => encrypt("secret")).toThrow(EncryptionKeyError);
    });

    it("throws when ENCRYPTION_KEY is empty", () => {
      process.env.ENCRYPTION_KEY = "";
      expect(() => assertKeyValid()).toThrow(EncryptionKeyError);
      expect(() => encrypt("secret")).toThrow(EncryptionKeyError);
    });

    it("throws when ENCRYPTION_KEY is not 32 bytes (too short)", () => {
      process.env.ENCRYPTION_KEY = "00112233"; // 4 bytes
      expect(() => assertKeyValid()).toThrow(EncryptionKeyError);
      expect(() => encrypt("secret")).toThrow(EncryptionKeyError);
    });

    it("throws when ENCRYPTION_KEY is not 32 bytes (too long)", () => {
      process.env.ENCRYPTION_KEY = VALID_KEY + "abcd"; // 34 bytes
      expect(() => assertKeyValid()).toThrow(EncryptionKeyError);
      expect(() => encrypt("secret")).toThrow(EncryptionKeyError);
    });

    it("returns the 32-byte key buffer when the key is valid", () => {
      process.env.ENCRYPTION_KEY = VALID_KEY;
      const key = assertKeyValid();
      expect(key.length).toBe(32);
    });
  });

  describe("tampered/malformed ciphertext raises DecryptionError and never returns the raw value (Req 3.4)", () => {
    const PLAINTEXT = "sensitive-contact-info";

    it("throws when the ciphertext segment is tampered", () => {
      const envelope = encrypt(PLAINTEXT);
      const [iv, tag, ciphertext] = envelope.split(":");

      // Flip characters in the ciphertext segment to a different valid-base64 char.
      const mutated = ciphertext
        .split("")
        .map((c) => (c === "A" ? "B" : "A"))
        .join("");
      const tampered = `${iv}:${tag}:${mutated}`;

      expect(() => decrypt(tampered)).toThrow(DecryptionError);
      // Never leaks the original plaintext.
      let leaked = null;
      try {
        leaked = decrypt(tampered);
      } catch {
        leaked = "threw";
      }
      expect(leaked).not.toBe(PLAINTEXT);
    });

    it("throws when the auth tag is tampered", () => {
      const envelope = encrypt(PLAINTEXT);
      const [iv, , ciphertext] = envelope.split(":");
      // Replace auth tag with a valid-length but wrong tag (16 bytes -> base64).
      const wrongTag = Buffer.alloc(16, 0).toString("base64");
      const tampered = `${iv}:${wrongTag}:${ciphertext}`;
      expect(() => decrypt(tampered)).toThrow(DecryptionError);
    });

    it("throws when the envelope has the wrong number of parts", () => {
      expect(() => decrypt("onlyonepart")).toThrow(DecryptionError);
      expect(() => decrypt("two:parts")).toThrow(DecryptionError);
      expect(() => decrypt("a:b:c:d")).toThrow(DecryptionError);
    });

    it("throws on empty segments in the envelope", () => {
      expect(() => decrypt("::")).toThrow(DecryptionError);
      const envelope = encrypt(PLAINTEXT);
      const [, tag, ciphertext] = envelope.split(":");
      expect(() => decrypt(`:${tag}:${ciphertext}`)).toThrow(DecryptionError);
    });

    it("throws when the IV has the wrong length", () => {
      const envelope = encrypt(PLAINTEXT);
      const [, tag, ciphertext] = envelope.split(":");
      const shortIv = Buffer.alloc(8, 0).toString("base64"); // 8 bytes, not 16
      expect(() => decrypt(`${shortIv}:${tag}:${ciphertext}`)).toThrow(
        DecryptionError
      );
    });

    it("throws when passed a non-string value", () => {
      expect(() => decrypt(12345)).toThrow(DecryptionError);
      expect(() => decrypt({})).toThrow(DecryptionError);
    });

    it("decryptField on a tampered stored value throws and never returns raw", () => {
      const stored = encryptField(PLAINTEXT);
      const [iv, tag, ciphertext] = stored.split(":");
      const mutated = ciphertext
        .split("")
        .map((c) => (c === "A" ? "B" : "A"))
        .join("");
      const tampered = `${iv}:${tag}:${mutated}`;

      expect(() => decryptField(tampered)).toThrow(DecryptionError);
      let leaked = null;
      try {
        leaked = decryptField(tampered);
      } catch {
        leaked = "threw";
      }
      expect(leaked).not.toBe(PLAINTEXT);
      expect(leaked).not.toBe(tampered);
    });

    it("decryptField returns null for null/undefined without throwing", () => {
      expect(decryptField(null)).toBeNull();
      expect(decryptField(undefined)).toBeNull();
    });
  });
});
