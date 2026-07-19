import nodemailer from "nodemailer9";

/**
 * Generalized in-app and email notification helpers.
 * SMTP credentials are read only when a transport is created and are never
 * included in logs or returned errors.
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
      category: "request_outcome",
      title: `Request ${request.referenceId} ${outcome}`,
      message: `Your request ${request.referenceId} has been ${outcome}.`,
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

/** Parse a bounded positive timeout from the environment. */
function timeout(name, fallback) {
  const parsed = Number.parseInt(process.env[name] || "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function envFlag(name, fallback) {
  const value = process.env[name];
  if (value == null || value === "") return fallback;
  return value.toLowerCase() === "true";
}

function safeHeader(value) {
  return typeof value === "string" ? value.replace(/[\r\n]+/g, " ").trim() : value;
}

/**
 * Build a real nodemailer SMTP transport. Port 465 defaults to implicit TLS;
 * other ports default to STARTTLS. Certificate verification remains enabled
 * unless an operator explicitly disables it for a controlled environment.
 */
export function createSmtpTransport() {
  if (!isEmailConfigured()) return null;

  const port = Number.parseInt(process.env.SMTP_PORT, 10);
  const secure = envFlag("SMTP_SECURE", port === 465);
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    requireTLS: envFlag("SMTP_REQUIRE_TLS", !secure),
    name: "smart-cemetery.local",
    disableFileAccess: true,
    disableUrlAccess: true,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    connectionTimeout: timeout("SMTP_CONNECTION_TIMEOUT_MS", 10_000),
    greetingTimeout: timeout("SMTP_GREETING_TIMEOUT_MS", 10_000),
    socketTimeout: timeout("SMTP_SOCKET_TIMEOUT_MS", 30_000),
    tls: {
      rejectUnauthorized: envFlag("SMTP_TLS_REJECT_UNAUTHORIZED", true),
    },
  });

  return {
    send(message) {
      return transport.sendMail({
        ...message,
        from: safeHeader(process.env.EMAIL_FROM),
        to: safeHeader(message.to),
        subject: safeHeader(message.subject),
      });
    },
  };
}

function safeDeliveryError(error) {
  if (!error) return "Email send failed";
  const message = String(error.message || "Email send failed");
  return message.slice(0, 500);
}

/**
 * Send any application email with bounded retries. Tests can keep injecting a
 * lightweight `{ send() }` transport; production resolves nodemailer lazily.
 */
export async function sendEmail(message, options = {}) {
  if (!isEmailConfigured()) {
    return { sent: false, attempts: 0, skipped: true };
  }

  const transport = options.transport !== undefined
    ? options.transport
    : createSmtpTransport();
  const maxAttempts = Number.isInteger(options.maxAttempts)
    ? Math.max(1, Math.min(options.maxAttempts, MAX_EMAIL_ATTEMPTS))
    : MAX_EMAIL_ATTEMPTS;

  if (!transport || typeof transport.send !== "function") {
    return { sent: false, attempts: 0, error: "No email transport available" };
  }

  let attempts = 0;
  let lastError;
  while (attempts < maxAttempts) {
    attempts += 1;
    try {
      await transport.send(message);
      return { sent: true, attempts };
    } catch (error) {
      lastError = error;
    }
  }

  return {
    sent: false,
    attempts,
    error: safeDeliveryError(lastError),
  };
}

/** Send a request-outcome email using the generalized helper. */
export async function sendOutcomeEmail(to, payload, options = {}) {
  const subject = `Request ${payload.referenceId} ${payload.outcome}`;
  const text =
    `Your request ${payload.referenceId} has been ${payload.outcome}. ` +
    `Reference ID: ${payload.referenceId}.`;

  return sendEmail({ to, subject, text }, options);
}
