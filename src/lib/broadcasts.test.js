import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAndDeliverBroadcast } from "@/lib/broadcasts";

const smtpVars = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "EMAIL_FROM"];
let saved;

beforeEach(() => {
  saved = Object.fromEntries(smtpVars.map((key) => [key, process.env[key]]));
  process.env.SMTP_HOST = "smtp.example.test";
  process.env.SMTP_PORT = "587";
  process.env.SMTP_USER = "user";
  process.env.SMTP_PASS = "secret";
  process.env.EMAIL_FROM = "no-reply@example.test";
});

afterEach(() => {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

function fakePrisma() {
  const prisma = {
    user: { findMany: vi.fn().mockResolvedValue([{ id: 2, email: "a@example.test" }, { id: 3, email: "b@example.test" }]) },
    broadcast: {
      create: vi.fn().mockResolvedValue({ id: 10 }),
      update: vi.fn().mockResolvedValue({}),
    },
    notification: {
      createMany: vi.fn().mockResolvedValue({ count: 2 }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    broadcastDelivery: {
      createMany: vi.fn().mockResolvedValue({ count: 2 }),
      update: vi.fn().mockResolvedValue({}),
    },
  };
  prisma.$transaction = vi.fn(async (work) => (
    typeof work === "function" ? work(prisma) : Promise.all(work)
  ));
  return prisma;
}

describe("createAndDeliverBroadcast", () => {
  it("atomically creates one in-app notification and delivery per audience user", async () => {
    const prisma = fakePrisma();
    const transport = { send: vi.fn().mockResolvedValue({}) };
    const result = await createAndDeliverBroadcast({
      prisma,
      creatorId: 1,
      audience: "Staff",
      title: "Maintenance notice",
      message: "The office closes at 4 PM.",
      transport,
    });

    expect(prisma.user.findMany.mock.calls[0][0].where).toMatchObject({
      status: "active", userType: { typeName: "Staff" },
    });
    expect(prisma.notification.createMany.mock.calls[0][0].data).toHaveLength(2);
    expect(prisma.broadcastDelivery.createMany.mock.calls[0][0].data).toHaveLength(2);
    expect(transport.send).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ recipients: 2, status: "sent", deliveries: { sent: 2, failed: 0 } });
  });
});
