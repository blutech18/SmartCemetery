import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { sendMail, createTransport } = vi.hoisted(() => {
  const mockedSendMail = vi.fn().mockResolvedValue({ messageId: "test" });
  return {
    sendMail: mockedSendMail,
    createTransport: vi.fn(() => ({ sendMail: mockedSendMail })),
  };
});
vi.mock("nodemailer9", () => ({ default: { createTransport } }));

import { createSmtpTransport } from "@/lib/notifications";

const keys = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "EMAIL_FROM", "SMTP_SECURE", "SMTP_REQUIRE_TLS", "SMTP_TLS_REJECT_UNAUTHORIZED", "SMTP_CONNECTION_TIMEOUT_MS", "SMTP_GREETING_TIMEOUT_MS", "SMTP_SOCKET_TIMEOUT_MS"];
let saved;

beforeEach(() => {
  saved = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  Object.assign(process.env, {
    SMTP_HOST: "smtp.example.test", SMTP_PORT: "587", SMTP_USER: "mailer",
    SMTP_PASS: "private-password", EMAIL_FROM: "no-reply@example.test",
    SMTP_SECURE: "false", SMTP_REQUIRE_TLS: "true",
    SMTP_TLS_REJECT_UNAUTHORIZED: "true", SMTP_CONNECTION_TIMEOUT_MS: "1200",
    SMTP_GREETING_TIMEOUT_MS: "1300", SMTP_SOCKET_TIMEOUT_MS: "1400",
  });
  vi.clearAllMocks();
});

afterEach(() => {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
});

describe("nodemailer SMTP transport", () => {
  it("configures STARTTLS, certificate checks, and bounded timeouts", async () => {
    const transport = createSmtpTransport();
    expect(createTransport).toHaveBeenCalledWith(expect.objectContaining({
      host: "smtp.example.test", port: 587, secure: false, requireTLS: true,
      connectionTimeout: 1200, greetingTimeout: 1300, socketTimeout: 1400,
      tls: { rejectUnauthorized: true },
      auth: { user: "mailer", pass: "private-password" },
    }));
    await transport.send({ to: "client@example.test", subject: "Notice", text: "Hello" });
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ from: "no-reply@example.test", to: "client@example.test" }));
  });
});
