/**
 * Request outcome notifications (Requirement 9).
 *
 * Responsibilities:
 *   - Persist an in-app Notification_Surface entry when an Admin approves or
 *     rejects a Request (`createOutcomeNotification`, Req 9.1).
 *   - Report whether email delivery is configured (`isEmailConfigured`, env
 *     presence check driving Req 9.3 vs 9.4).
 *   - Attempt one outcome email with a hard cap of 3 attempts, reporting the
 *     result so the caller can record `emailStatus` (`sendOutcomeEmail`,
 *     Req 9.3, 9.5). When email is not configured this is a no-op that never
 *     errors (Req 9.4).
 *
 * Design notes:
 *   - `prisma` is dependency-injected into `createOutcomeNotification` so the
 *     function is trivially testable without importing the singleton client.
 *   - No SMTP client (e.g. nodemailer) is present in the project, so rather
 *     than pulling in a heavy dependency this module ships a small transport
 *     abstraction. `resolveTransport` returns `null` when unconfigured; a real
 *     SMTP transport can be plugged in later (see `createSmtpTransport`) or
 *     injected for tests, without changing the retry / status-recording logic
 *     that is the actual testable contract of Req 9.5.
 */

/** Maximum number of email send attempts before giving up (Req 9.5). */
export const MAX_EMAIL_ATTEMPTS = 3;

/** SMTP environment variables that must all be present for email delivery. */
const REQUIRED_SMTP_VARS = [
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASS",
  "EMAIL_FROM",
];

/**
 * Create the in-app outcome notification for a Request's owning Client.
 *
 * Records the Request Reference_ID, the outcome, and the status-change
 * timestamp so the Client can see it on the Notification_Surface (Req 9.1).
 * The row is created with `emailStatus = "none"`; callers that also send an
 * email should update the status afterwards based on `sendOutcomeEmail`.
 *
 * @param {object} args
 * @param {import("@prisma/client").PrismaClient} args.prisma Prisma client (DI).
 * @param {{ id: number, userId: number, referenceId: string }} args.request
 *   The request whose status changed. `userId` identifies the recipient Client.
 * @param {"approved"|"rejected"} args.outcome The new outcome.
 * @param {Date} [args.changedAt] Timestamp of the status change; defaults to now.
 * @returns {Promise<object>} The persisted Notification row.
 */
export async function createOutcomeNotification({
  prisma,
  request,
  outcome,
  changedAt,
}) {
  if (!prisma) throw new Error("createOutcomeNotification requires a prisma client");
  if (!request) throw new Error("createOutcomeNotification requires a request");
  if (outcome !== "approved" && outcome !== "rejected") {
    throw new Error(`Invalid outcome: ${outcome}`);
  }

  const timestamp = changedAt ?? new Date();

  return prisma.notification.create({
    data: {
      userId: request.userId,
      requestId: request.id,
      referenceId: request.referenceId,
      outcome,
      emailStatus: "none",
      createdAt: timestamp,
    },
  });
}

/**
 * Pure-ish: is email delivery configured?
 *
 * Returns true iff every required SMTP variable is present and non-empty in
 * the environment. Drives the branch between "send email" (Req 9.3) and
 * "in-app only, no error" (Req 9.4).
 *
 * @returns {boolean}
 */
export function isEmailConfigured() {
  return REQUIRED_SMTP_VARS.every((name) => {
    const value = process.env[name];
    return typeof value === "string" && value.trim().length > 0;
  });
}

/**
 * Build the SMTP transport when configured.
 *
 * No SMTP client library is installed. This returns `null` so the project has
 * a working, dependency-free default (in-app only). To enable real delivery,
 * install `nodemailer` and replace the body below with a nodemailer transport
 * whose `sendMail` returns a promise — the retry/status logic here stays intact.
 *
 * @returns {null|{ send: (opts: { to: string, subject: string, text: string }) => Promise<void> }}
 */
function createSmtpTransport() {
  // Intentionally no-op until a real SMTP client is wired in. Because
  // `isEmailConfigured()` gates all calls, this is never reached unless the
  // operator has set SMTP_* — at which point a real transport should exist.
  return null;
}

/**
 * Attempt to send one outcome email, retrying up to MAX_EMAIL_ATTEMPTS times.
 *
 * Behavior:
 *   - If email is not configured: no send is attempted and no error is raised
 *     (Req 9.4). Returns { sent: false, attempts: 0, skipped: true }.
 *   - If configured: sends a single logical email describing the outcome and
 *     Reference_ID (Req 9.3), retrying on failure up to 3 attempts total
 *     (Req 9.5). Returns { sent: true, attempts } on success or
 *     { sent: false, attempts, error } after exhausting attempts.
 *
 * This function never throws; it always reports a structured result so the
 * caller can record `emailStatus` ("sent" | "failed") while retaining the
 * in-app entry regardless of email outcome (Req 9.5).
 *
 * @param {string} to Recipient email address.
 * @param {{ referenceId: string, outcome: "approved"|"rejected" }} payload
 * @param {object} [options]
 * @param {{ send: Function }|null} [options.transport] Injected transport
 *   (primarily for tests). When omitted, a transport is resolved from env.
 * @returns {Promise<{ sent: boolean, attempts: number, skipped?: boolean, error?: string }>}
 */
export async function sendOutcomeEmail(to, payload, options = {}) {
  if (!isEmailConfigured()) {
    // Not configured → in-app only, never an error (Req 9.4).
    return { sent: false, attempts: 0, skipped: true };
  }

  const transport =
    options.transport !== undefined ? options.transport : createSmtpTransport();

  if (!transport || typeof transport.send !== "function") {
    // Configured by env but no usable transport is wired in. Treat as a
    // delivery failure so the caller records emailStatus="failed" without
    // ever removing the in-app entry (Req 9.5). No attempt is counted.
    return {
      sent: false,
      attempts: 0,
      error: "No email transport available",
    };
  }

  const subject = `Request ${payload.referenceId} ${payload.outcome}`;
  const text =
    `Your request ${payload.referenceId} has been ${payload.outcome}. ` +
    `Reference ID: ${payload.referenceId}.`;

  let attempts = 0;
  let lastError = null;

  while (attempts < MAX_EMAIL_ATTEMPTS) {
    attempts += 1;
    try {
      await transport.send({ to, subject, text });
      return { sent: true, attempts };
    } catch (error) {
      lastError = error;
    }
  }

  return {
    sent: false,
    attempts,
    error: lastError ? String(lastError.message ?? lastError) : "Email send failed",
  };
}
