import { prisma } from "@/lib/db";

/**
 * Audit logging helpers.
 *
 * The existing `UserLog` Prisma model IS the Audit_Log: it stores
 * { userId, action (VarChar 255), ipAddress (VarChar 45, nullable), createdAt }.
 * `action` encodes the affected entity type + operation, e.g. "grave.create",
 * "plot.update".
 *
 * Auditing is best-effort and always runs AFTER a mutation has been persisted,
 * so an audit-write failure never reverts the mutation (Req 14.1, 14.3, 14.4).
 */

/**
 * Read a header value from either a Fetch `Headers` object (has `.get`) or a
 * plain object map. Case-insensitive for plain objects.
 * @returns {string} the header value, or "" if absent
 */
function readHeader(headers, name) {
  if (!headers) return "";

  // Fetch API Headers (Next.js request.headers)
  if (typeof headers.get === "function") {
    return headers.get(name) ?? "";
  }

  // Plain object: match case-insensitively
  const lower = name.toLowerCase();
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === lower) {
      const value = headers[key];
      return value == null ? "" : String(value);
    }
  }
  return "";
}

/**
 * PURE: extract the client IP address from a request's headers.
 *
 * Prefers the first value of `x-forwarded-for` (a comma-separated list where
 * the left-most entry is the originating client), then falls back to
 * `x-real-ip`. Returns "" (empty string) when neither is present (Req 14.2).
 *
 * @param {{ headers?: Headers | Record<string, string> }} request
 * @returns {string} the client IP, or "" if unavailable
 */
export function getClientIp(request) {
  const headers = request?.headers;

  const forwardedFor = readHeader(headers, "x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0].trim();
    if (first) return first;
  }

  const realIp = readHeader(headers, "x-real-ip").trim();
  if (realIp) return realIp;

  return "";
}

/**
 * Write ONE audit log entry (a `UserLog` row) after a mutation is persisted.
 *
 * Best-effort: any failure is caught and logged via console.error and NOT
 * rethrown, so it can never revert the already-persisted mutation (Req 14.4).
 *
 * @param {Object} params
 * @param {number} params.userId - acting user's identifier
 * @param {string} params.action - entity type + operation, e.g. "grave.create"
 * @param {string} [params.ipAddress] - client IP; empty string is stored as null
 * @param {import("@prisma/client").Prisma.TransactionClient} [params.tx]
 *        optional Prisma transaction client; falls back to the shared client
 * @returns {Promise<void>}
 */
export async function writeAuditLog({ userId, action, ipAddress, tx } = {}) {
  const client = tx ?? prisma;

  try {
    // `UserLog.userId` is an Int FK, but callers often pass the JWT `id` claim
    // which is a string. Coerce defensively so every call site writes a valid
    // audit entry (Req 14.1).
    const numericUserId =
      typeof userId === "number" ? userId : Number.parseInt(userId, 10);
    if (!Number.isInteger(numericUserId)) {
      throw new Error(`invalid audit userId: ${String(userId)}`);
    }

    await client.userLog.create({
      data: {
        userId: numericUserId,
        action,
        // Store empty/absent IP as null (schema ipAddress is nullable)
        ipAddress: ipAddress ? ipAddress : null,
      },
    });
  } catch (error) {
    // Do NOT rethrow: the mutation is already persisted and must be retained.
    console.error(
      `[audit] failed to write audit log for action "${action}" (userId=${userId}):`,
      error,
    );
  }
}
