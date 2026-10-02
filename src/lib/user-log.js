/**
 * Presentation helpers for the User Log (the audit trail in `user_logs`).
 *
 * Actions are stored as `<category>.<operation>` and may carry details after
 * it — either after a colon (`grave.archive:run=daily;count=2`) or, from
 * `writeAuditLog`, after a space as JSON (`plot.batch_update {"updatedCount":3}`).
 * Pure — no React, no I/O.
 */

const LABELS = {
  "auth.login": "Signed in",
  "auth.logout": "Signed out",
  "auth.login_failed": "Failed sign-in attempt",
  "auth.login_blocked": "Sign-in blocked (too many attempts)",
  "boundary.update": "Changed the cemetery boundary",
  "boundary.reset": "Reset the cemetery boundary",
  "broadcast.create": "Sent a broadcast",
  "feedback.create": "Submitted feedback",
  "grave.archive": "Archived grave records",
  "grave.create": "Added a grave record",
  "grave.delete": "Deleted a grave record",
  "grave.photo_update": "Changed a grave photo",
  "grave.update": "Updated a grave record",
  "grave.verify": "Verified a grave record",
  "location.create": "Added a location",
  "location.update": "Updated a location",
  "location.deactivate": "Deactivated a location",
  "location.reactivate": "Reactivated a location",
  "navigation.create": "Requested directions",
  "notification.read": "Read a notification",
  "plot.batch_update": "Saved a plot layout",
  "plot.create": "Added a plot",
  "plot.delete": "Deleted a plot",
  "plot.photo_update": "Changed a plot photo",
  "plot.preset": "Applied the layout preset",
  "plot.update": "Updated a plot",
  "request.create": "Submitted a request",
  "request.update": "Updated a request",
  "user.create": "Created a user account",
  "user.update": "Updated a user account",
};

/** Human names for the filter dropdown. Unknown categories fall back to a title-cased key. */
export const CATEGORY_LABELS = {
  auth: "Sign-in & sign-out",
  grave: "Grave records",
  plot: "Plots",
  location: "Locations",
  user: "User accounts",
  request: "Requests",
  broadcast: "Broadcasts",
  feedback: "Feedback",
  navigation: "Directions",
  notification: "Notifications",
  boundary: "Map boundary",
};

const titleCase = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Split a stored action into its key (`category.operation`) and its details.
 * The key is the leading dotted token, so a colon inside JSON details can never
 * be mistaken for the separator.
 */
export function parseAction(raw) {
  const s = String(raw ?? "").trim();
  const m = /^([A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)?)([\s\S]*)$/.exec(s);
  if (!m) return { key: s, detail: "" };
  return { key: m[1], detail: m[2].replace(/^[:\s]+/, "") };
}

/**
 * Details as short readable text: JSON becomes `key=value · key=value` (long
 * values are shortened), anything else is returned as is.
 */
export function formatDetail(detail, maxValue = 40) {
  const text = String(detail ?? "").trim();
  if (!text) return "";
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return Object.entries(parsed)
        .filter(([, v]) => v !== null && v !== undefined && v !== "")
        .map(([k, v]) => {
          const value = typeof v === "object" ? JSON.stringify(v) : String(v);
          return `${k}=${value.length > maxValue ? value.slice(0, maxValue - 1) + "…" : value}`;
        })
        .join(" · ");
    }
  } catch {
    // not JSON: fall through to the raw text
  }
  return text.length > 80 ? text.slice(0, 79) + "…" : text;
}

/** The part before the first dot: "plot.update" → "plot". */
export function categoryOf(raw) {
  const { key } = parseAction(raw);
  const dot = key.indexOf(".");
  return dot < 0 ? key : key.slice(0, dot);
}

/** `{ key, label, detail }` — a plain-language label, falling back to the raw key. */
export function describeAction(raw) {
  const { key, detail } = parseAction(raw);
  const label = LABELS[key] || titleCase(key.replace(/[._]+/g, " ").trim() || "Unknown action");
  return { key, label, detail };
}

export function categoryLabel(category) {
  return CATEGORY_LABELS[category] || titleCase(String(category).replace(/_/g, " "));
}

/** True for categories that are safe to pass to the API filter. */
export function isValidCategory(category) {
  return typeof category === "string" && /^[a-z_]{1,30}$/.test(category);
}
