/**
 * Route-access decision helper (pure, property-testable).
 *
 * This module contains the *decision* logic for the optimistic proxy route
 * guard (see `src/proxy.js`). It is intentionally free of Next.js runtime
 * imports (no `NextResponse`) and of any database/Prisma access so it can be
 * exercised directly by unit and property tests. The proxy shell is
 * responsible for turning a decision into an actual redirect/next response.
 *
 * Requirements covered: 1.1, 1.2, 1.3, 1.4, 1.5
 */

/**
 * Public page paths that bypass authentication evaluation entirely (Req 1.4).
 * Matched exactly, or (for non-root paths) as a path-boundary prefix.
 * @type {string[]}
 */
export const PUBLIC_PATHS = ["/", "/login", "/search", "/kiosk"];

/**
 * Public API prefixes that bypass authentication evaluation (Req 1.4).
 * Matched exactly, or as a path-boundary prefix (e.g. `/api/auth/session`).
 * @type {string[]}
 */
export const PUBLIC_API_PREFIXES = ["/api/auth", "/api/graves"];

/** Prefix of routes that require an authenticated session. */
const PROTECTED_PREFIX = "/dashboard";

/** Default post-login destination. */
const DEFAULT_CALLBACK = "/dashboard";

/**
 * Normalize a `now` reference (Date or epoch milliseconds) to epoch ms.
 * Falls back to the current time when the value is not usable, so the guard
 * never crashes on a malformed caller-supplied clock.
 *
 * @param {Date|number|undefined} now
 * @returns {number} epoch milliseconds
 */
function toMillis(now) {
  if (now instanceof Date) {
    const t = now.getTime();
    return Number.isFinite(t) ? t : Date.now();
  }
  if (typeof now === "number" && Number.isFinite(now)) {
    return now;
  }
  return Date.now();
}

/**
 * True when `pathname` matches `base` exactly or as a path-boundary prefix
 * (i.e. `base` followed by `/`, `?`, or `#`). Prevents `/searchers` from
 * matching the public path `/search`.
 *
 * @param {string} pathname
 * @param {string} base
 * @returns {boolean}
 */
function matchesBoundary(pathname, base) {
  if (pathname === base) return true;
  return (
    pathname.startsWith(base + "/") ||
    pathname.startsWith(base + "?") ||
    pathname.startsWith(base + "#")
  );
}

/**
 * Determine whether a path is public and should skip authentication (Req 1.4).
 *
 * @param {string} pathname
 * @returns {boolean}
 */
export function isPublicPath(pathname) {
  if (typeof pathname !== "string") return false;

  // Root is matched exactly only.
  if (pathname === "/") return true;

  for (const p of PUBLIC_PATHS) {
    if (p === "/") continue;
    if (matchesBoundary(pathname, p)) return true;
  }
  for (const prefix of PUBLIC_API_PREFIXES) {
    if (matchesBoundary(pathname, prefix)) return true;
  }
  return false;
}

/**
 * Determine whether a path is a protected dashboard route (Req 1.1–1.3).
 *
 * @param {string} pathname
 * @returns {boolean}
 */
export function isProtectedPath(pathname) {
  if (typeof pathname !== "string") return false;
  return pathname === PROTECTED_PREFIX || pathname.startsWith(PROTECTED_PREFIX + "/");
}

/**
 * Determine whether a decoded JWT is present, well-formed, and unexpired.
 *
 * The token is the *decoded* JWT object produced by NextAuth's `getToken`.
 * A valid session token carries an `exp` claim expressed in **seconds** since
 * the epoch. The token is considered valid only when `exp` is a finite number
 * and strictly in the future relative to `now`. A missing token, a token
 * without a usable numeric `exp`, or an expired token (current time at or past
 * `exp`) is treated as unauthenticated (Req 1.2, 1.3).
 *
 * @param {object|null|undefined} token decoded JWT object
 * @param {Date|number|undefined} now reference time (Date or epoch ms)
 * @returns {boolean}
 */
export function isTokenValid(token, now) {
  if (!token || typeof token !== "object") return false;

  const { exp } = token;
  if (typeof exp !== "number" || !Number.isFinite(exp)) return false;

  const nowMs = toMillis(now);
  const expMs = exp * 1000;

  // Expired when current time is at or past the expiry timestamp (Req 1.3).
  return expMs > nowMs;
}

/**
 * Evaluate access for a requested path given a decoded token and reference
 * time. Pure function — returns a decision object, never performs I/O.
 *
 * - Public paths always allow, regardless of token state (Req 1.4).
 * - Protected `/dashboard/*` paths allow only with a present, well-formed,
 *   unexpired token; otherwise redirect to `/login` with the original path as
 *   the callback (Req 1.1, 1.2, 1.3).
 * - Any other (non-public, non-dashboard) path is allowed; protection scope is
 *   limited to the dashboard.
 *
 * @param {{ pathname: string, token: object|null|undefined, now?: Date|number }} params
 * @returns {{ action: "allow" } | { action: "redirect", to: "/login", callbackUrl: string }}
 */
export function evaluateRouteAccess({ pathname, token, now } = {}) {
  const path = typeof pathname === "string" ? pathname : "";

  if (isPublicPath(path)) {
    return { action: "allow" };
  }

  if (!isProtectedPath(path)) {
    return { action: "allow" };
  }

  if (isTokenValid(token, now)) {
    return { action: "allow" };
  }

  return { action: "redirect", to: "/login", callbackUrl: path };
}

/**
 * Resolve a post-login callback path, honoring only internal `/dashboard`
 * paths (Req 1.5). Any external URL, protocol-relative URL, non-dashboard
 * path, or empty/invalid value falls back to the default `/dashboard`.
 *
 * @param {string} callbackUrl candidate callback (typically from a query param)
 * @returns {string} a safe internal dashboard path
 */
export function resolveCallback(callbackUrl) {
  if (typeof callbackUrl !== "string") return DEFAULT_CALLBACK;

  const value = callbackUrl.trim();
  if (!value) return DEFAULT_CALLBACK;

  // Must be a site-internal absolute path: a single leading slash, and not a
  // protocol-relative (`//host`) or backslash-obfuscated URL.
  if (!value.startsWith("/")) return DEFAULT_CALLBACK;
  if (value.startsWith("//")) return DEFAULT_CALLBACK;
  if (value.includes("\\")) return DEFAULT_CALLBACK;

  // Must be under /dashboard at a path boundary (rejects e.g. "/dashboardx").
  if (matchesBoundary(value, PROTECTED_PREFIX)) {
    return value;
  }

  return DEFAULT_CALLBACK;
}
