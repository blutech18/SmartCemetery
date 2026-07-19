import { sendEmail } from "@/lib/notifications";

export const BROADCAST_AUDIENCES = Object.freeze(["All", "Admin", "Staff", "Client"]);
export const BROADCAST_EMAIL_CONCURRENCY = 5;

async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;

  async function consume() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => consume())
  );
  return results;
}

function deliveryStatus(result) {
  if (result.sent) return "sent";
  if (result.skipped) return "skipped";
  return "failed";
}

/** Create all durable in-app rows atomically, then attempt bounded email delivery. */
export async function createAndDeliverBroadcast({
  prisma,
  creatorId,
  audience,
  title,
  message,
  transport,
}) {
  if (!BROADCAST_AUDIENCES.includes(audience)) {
    throw new Error("Invalid broadcast audience");
  }

  const users = await prisma.user.findMany({
    where: {
      status: "active",
      ...(audience === "All" ? {} : { userType: { typeName: audience } }),
    },
    select: { id: true, email: true },
  });

  const broadcast = await prisma.$transaction(async (tx) => {
    const created = await tx.broadcast.create({
      data: { creatorId, audience, title, message, status: "processing" },
    });

    if (users.length) {
      await tx.notification.createMany({
        data: users.map((user) => ({
          userId: user.id,
          broadcastId: created.id,
          category: "broadcast",
          title,
          message,
          emailStatus: "none",
        })),
      });
      await tx.broadcastDelivery.createMany({
        data: users.map((user) => ({
          broadcastId: created.id,
          userId: user.id,
          emailStatus: "none",
        })),
      });
    }

    return created;
  });

  const results = await mapWithConcurrency(
    users,
    BROADCAST_EMAIL_CONCURRENCY,
    async (user) => {
      const result = await sendEmail(
        { to: user.email, subject: title, text: message },
        transport === undefined ? {} : { transport }
      );
      const status = deliveryStatus(result);
      const error = result.error ? String(result.error).slice(0, 500) : null;

      await prisma.$transaction([
        prisma.broadcastDelivery.update({
          where: { broadcastId_userId: { broadcastId: broadcast.id, userId: user.id } },
          data: { emailStatus: status, attempts: result.attempts, error },
        }),
        prisma.notification.updateMany({
          where: { broadcastId: broadcast.id, userId: user.id },
          data: { emailStatus: status },
        }),
      ]);
      return status;
    }
  );

  const counts = results.reduce(
    (totals, status) => ({ ...totals, [status]: totals[status] + 1 }),
    { sent: 0, failed: 0, skipped: 0 }
  );
  const status = counts.failed === 0
    ? "sent"
    : counts.sent === 0 && counts.skipped === 0
      ? "failed"
      : "partial";
  const sentAt = new Date();

  await prisma.broadcast.update({
    where: { id: broadcast.id },
    data: { status, sentAt },
  });

  return {
    id: broadcast.id,
    audience,
    title,
    status,
    sentAt,
    recipients: users.length,
    deliveries: counts,
  };
}
