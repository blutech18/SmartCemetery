import crypto from "crypto";

/**
 * AES-256-GCM Encryption Helpers
 * For encrypting sensitive fields in the database
 */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32; // AES-256 requires a 32-byte key

/**
 * Sensitive GraveDetail fields that must be encrypted at rest.
 * `notes` and other fields are intentionally left untouched.
 */
export const SENSITIVE_GRAVE_FIELDS = [
  "contactPerson",
  "contactPhone",
  "causeOfDeath",
];

const KEY_VERSION_PATTERN = /^[A-Za-z0-9_-]{1,40}$/;

export function getCurrentKeyVersion() {
  const version = (process.env.ENCRYPTION_KEY_VERSION || "v1").trim();
  if (!KEY_VERSION_PATTERN.test(version)) {
    throw new EncryptionKeyError("encryption key version is invalid");
  }
  return version;
}

function previousKeyring() {
  const raw = process.env.ENCRYPTION_KEY_PREVIOUS;
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    throw new EncryptionKeyError("previous encryption keyring is invalid");
  }
}

/**
 * Raised when ENCRYPTION_KEY is absent or does not decode to a valid 32-byte key.
 * Signals the encryption key is unavailable/invalid (Req 3.3).
 */
export class EncryptionKeyError extends Error {
  constructor(message = "encryption key unavailable/invalid") {
    super(message);
    this.name = "EncryptionKeyError";
  }
}

/**
 * Raised when a stored value cannot be decrypted (malformed envelope or failed
 * GCM authentication tag). The raw stored value is never returned (Req 3.4).
 */
export class DecryptionError extends Error {
  constructor(message = "value could not be decrypted") {
    super(message);
    this.name = "DecryptionError";
  }
}

/**
 * Decode and validate ENCRYPTION_KEY, returning the 32-byte key buffer.
 * @returns {Buffer} the validated 32-byte key
 * @throws {EncryptionKeyError} if the key is absent or not exactly 32 bytes
 */
export function assertKeyValid(version = getCurrentKeyVersion()) {
  const currentVersion = getCurrentKeyVersion();
  const key = version === currentVersion
    ? process.env.ENCRYPTION_KEY
    : previousKeyring()[version];

  if (!key || typeof key !== "string" || !/^[0-9a-fA-F]{64}$/.test(key)) {
    throw new EncryptionKeyError("encryption key unavailable/invalid");
  }

  const keyBuffer = Buffer.from(key, "hex");
  if (keyBuffer.length !== KEY_LENGTH) {
    throw new EncryptionKeyError("encryption key unavailable/invalid");
  }

  return keyBuffer;
}

/** Encrypt with the configured current key. The version is stored per row. */
export function encrypt(plaintext, version = getCurrentKeyVersion()) {
  const key = assertKeyValid(version);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "base64");
  encrypted += cipher.final("base64");
  const authTag = cipher.getAuthTag();

  return `${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted}`;
}

/** Decrypt a legacy three-part envelope using its row-level key version. */
export function decrypt(encryptedData, version = getCurrentKeyVersion()) {
  if (typeof encryptedData !== "string") {
    throw new DecryptionError("value could not be decrypted");
  }

  const parts = encryptedData.split(":");
  if (parts.length !== 3) {
    throw new DecryptionError("value could not be decrypted");
  }

  const [ivB64, authTagB64, ciphertext] = parts;
  if (!ivB64 || !authTagB64 || !ciphertext) {
    throw new DecryptionError("value could not be decrypted");
  }

  try {
    const key = assertKeyValid(version);
    const iv = Buffer.from(ivB64, "base64");
    const authTag = Buffer.from(authTagB64, "base64");

    if (iv.length !== IV_LENGTH || authTag.length !== AUTH_TAG_LENGTH) {
      throw new DecryptionError("value could not be decrypted");
    }

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertext, "base64", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (err) {
    if (err instanceof DecryptionError) throw err;
    throw new DecryptionError("value could not be decrypted");
  }
}

/**
 * Encrypt a single sensitive field value.
 * Null, empty, or whitespace-only values return null WITHOUT invoking the
 * cipher (Req 3.6). Otherwise the value is encrypted.
 * @param {string|null|undefined} value
 * @returns {string|null} ciphertext envelope, or null
 */
export function encryptField(value) {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string" || value.trim() === "") return null;
  return encrypt(value);
}

/**
 * Decrypt a single sensitive field value.
 * Null/undefined returns null; otherwise decrypts (Req 3.4).
 * @param {string|null|undefined} value
 * @returns {string|null} decrypted plaintext, or null
 * @throws {DecryptionError} if the stored value cannot be decrypted
 */
export function decryptField(value, version = getCurrentKeyVersion()) {
  if (value === null || value === undefined) return null;
  return decrypt(value, version);
}

/** Encrypt every classified GraveDetail field with the current key. */
export function encryptGraveDetail(detail) {
  if (detail === null || detail === undefined) return detail;
  const version = getCurrentKeyVersion();
  const result = { ...detail };
  for (const field of SENSITIVE_GRAVE_FIELDS) {
    if (field in result) result[field] = encryptField(result[field]);
  }
  if ("notes" in result) result.notes = encryptField(result.notes);
  result.encryptionKeyVersion = version;
  result.notesEncrypted = Boolean(result.notes);
  return result;
}

/**
 * Decrypt classified fields with the row key version. Legacy plaintext notes
 * remain readable until the resumable rotation command encrypts them.
 */
export function decryptGraveDetail(detail) {
  if (detail === null || detail === undefined) return detail;
  const result = { ...detail };
  const version = detail.encryptionKeyVersion || "v1";
  for (const field of SENSITIVE_GRAVE_FIELDS) {
    if (field in result) result[field] = decryptField(result[field], version);
  }
  if (result.notesEncrypted && "notes" in result) {
    result.notes = decryptField(result.notes, version);
  }
  return result;
}
