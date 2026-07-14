/**
 * Requests module (Requirement 7)
 *
 * Reusable, mostly-pure building blocks for the client Request flow:
 *   - `REQUEST_SCHEMA`      declarative validation schema for `validateBody`
 *   - `generateReferenceId` pure-ish, crypto-backed Reference_ID generator
 *   - `createUniqueReferenceId` async wrapper that guarantees DB uniqueness by
 *                              retrying on the `@unique` constraint collision
 *
 * Prisma is dependency-injected (no top-level Prisma import) so the pure parts
 * of this module can be imported and property-tested without a database
 * connection — the same pattern used by `search.js` and `validation.js`.
 */

import crypto from "crypto";

/**
 * Allowed Request types (Req 7.3). Kept as an exported constant so routes,
 * schema, and tests share a single source of truth.
 */
export const REQUEST_TYPES = ["reservation", "record_update", "inquiry"];

/** Description bounds after trimming (Req 7.4). */
export const DESCRIPTION_MIN = 1;
export const DESCRIPTION_MAX = 2000;

/**
 * Declarative validation schema for a Request submission, consumable by
 * `validateBody(body, schema)` from "@/lib/validation".
 *
 *   - type:        required string, must be one of REQUEST_TYPES (Req 7.2, 7.3)
 *   - description: required string, trimmed length 1–2000 (Req 7.2, 7.4)
 *
 * `userId` is intentionally NOT part of this schema — per the design the acting
 * user's identity comes from the authenticated session, never the request body.
 */
export const REQUEST_SCHEMA = {
  type: {
    required: true,
    type: "string",
    enum: REQUEST_TYPES,
  },
  description: {
    required: true,
    type: "string",
    trim: true,
    min: DESCRIPTION_MIN,
    max: DESCRIPTION_MAX,
  },
};

/**
 * Reference_ID format constants.
 *
 * The DB column is `VarChar(20)` and unique. To be strongly collision-resistant
 * within that width we keep the human-recognizable `REQ-` prefix and fill the
 * remaining 16 characters with a large random component (8 bytes → 16 hex
 * chars → 64 bits of entropy). A full embedded timestamp plus a 6+ byte random
 * tail would exceed 20 characters, so entropy is favoured for uniqueness
 * (Req 7.7); the `createUniqueReferenceId` wrapper is the authoritative
 * guarantee against the astronomically rare collision.
 */
export const REFERENCE_ID_PREFIX = "REQ-";
export const REFERENCE_ID_RANDOM_BYTES = 8; // 16 hex chars
export const REFERENCE_ID_MAX_LENGTH = 20;

/**
 * Generate a single collision-resistant, human-usable Reference_ID.
 *
 * Format: `REQ-<16 uppercase hex chars>` (exactly 20 characters).
 *
 * The random source is injectable purely for deterministic testing; by default
 * it uses Node's CSPRNG (`crypto.randomBytes`).
 *
 * @param {{ randomBytes?: (size: number) => Buffer }} [options]
 * @returns {string} a Reference_ID no longer than REFERENCE_ID_MAX_LENGTH
 */
export function generateReferenceId({ randomBytes = crypto.randomBytes } = {}) {
  const random = randomBytes(REFERENCE_ID_RANDOM_BYTES)
    .toString("hex")
    .toUpperCase();

  return `${REFERENCE_ID_PREFIX}${random}`;
}

/**
 * Produce a Reference_ID that is not already used by an existing Request,
 * retrying on collision with the DB `@unique` constraint (Req 7.7).
 *
 * Because the generator alone cannot observe other rows, this wrapper probes
 * the unique `referenceId` column via Prisma and regenerates on the (extremely
 * rare) collision. It returns the reserved ID string; the caller persists the
 * Request with it (route wiring lives in a separate task).
 *
 * @param {{ request: { findUnique: Function } }} prisma - injected Prisma client
 * @param {() => string} [generate] - ID generator (defaults to generateReferenceId)
 * @param {{ maxRetries?: number }} [options]
 * @returns {Promise<string>} a Reference_ID guaranteed unused at check time
 * @throws {Error} if a unique ID cannot be found within maxRetries attempts
 */
export async function createUniqueReferenceId(
  prisma,
  generate = generateReferenceId,
  { maxRetries = 5 } = {}
) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const referenceId = generate();

    const existing = await prisma.request.findUnique({
      where: { referenceId },
      select: { id: true },
    });

    if (!existing) {
      return referenceId;
    }
  }

  throw new Error(
    `Unable to generate a unique Reference_ID after ${maxRetries} attempts`
  );
}
