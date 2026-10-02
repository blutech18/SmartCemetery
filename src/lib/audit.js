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
 * Number of trusted reverse proxies in front of the app, from
 * `TRUSTED_PROXY_COUNT`. 0 (unset) keeps the legacy behavior of reading the
 * left-most `x-forwarded-for` entry.
 */
function trustedProxyCount() {
  const n = Number.parseInt(process.env.TRUSTED_PROXY_COUNT || "", 10);
  return Number.isInteger(n) && n > 0 && n <= 10 ? n : 0;
}

/**
 * PURE (given the environment): extract the client IP address from a
 * request's headers.
 *
 * The left-most `x-forwarded-for` entry is client-controlled, so when
 * `TRUSTED_PROXY_COUNT=N` is set the address is taken N entries from the
 * RIGHT — the one appended by the nearest trusted proxy — which a client
 * cannot spoof. This matters because rate limits are keyed on this value.
 * When unset, the left-most entry is used (correct only if the edge proxy
 * overwrites the header). Falls back to `x-real-ip`, then "" (Req 14.2).
 *
 * @param {{ headers?: Headers | Record<string, string> }} request
 * @returns {string} the client IP, or "" if unavailable
 */
export function getClientIp(request) {
  const headers = request?.headers;

  const forwardedFor = readHeader(headers, "x-forwarded-for");
  if (forwardedFor) {
    const parts = forwardedFor.split(",").map((p) => p.trim()).filter(Boolean);
    const trusted = trustedProxyCount();
    const picked = trusted > 0
      ? parts[Math.max(0, parts.length - trusted)]
      : parts[0];
    if (picked) return picked;
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
 * `details` is optional structured context (e.g. affected counts). The
 * `UserLog` model only has an `action` column, so details are appended to the
 * action string, bounded to the column's 255-char limit.
 *
 * @param {Object} params
 * @param {number|string|null} params.userId - acting user's identifier, or `null` when
 *        there is no known account (e.g. a failed sign-in for an unknown email)
 * @param {string} params.action - entity type + operation, e.g. "grave.create"
 * @param {string} [params.ipAddress] - client IP; empty string is stored as null
 * @param {object|string} [params.details] - optional structured context
 * @param {import("@prisma/client").Prisma.TransactionClient} [params.tx]
 *        optional Prisma transaction client; falls back to the shared client
 * @returns {Promise<void>}
 */
export async function writeAuditLog({ userId, action, ipAddress, tx, details } = {}) {
  const client = tx ?? prisma;

  try {
    // `UserLog.userId` is an Int FK, but callers often pass the JWT `id` claim
    // which is a string. Coerce defensively so every call site writes a valid
    // audit entry (Req 14.1).
    // An explicit `null` records an event with no known account; anything else
    // that is not an integer is a caller bug and is reported, not stored.
    const numericUserId =
      userId === null ? null : typeof userId === "number" ? userId : Number.parseInt(userId, 10);
    if (numericUserId !== null && !Number.isInteger(numericUserId)) {
      throw new Error(`invalid audit userId: ${String(userId)}`);
    }

    // Preserve the action and append bounded structured context.
    let auditAction = String(action ?? "");
    if (details !== undefined && details !== null) {
      let encoded = "";
      try {
        encoded = typeof details === "string" ? details : JSON.stringify(details);
      } catch {
        encoded = "";
      }
      if (encoded) {
        const prefix = `${auditAction} `;
        auditAction = prefix + encoded.slice(0, Math.max(0, 255 - prefix.length));
      }
    }

    await client.userLog.create({
      data: {
        userId: numericUserId,
        action: auditAction,
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
