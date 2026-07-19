import crypto from "node:crypto";
import { prisma } from "@/lib/db";

let lastCleanup = 0;

export function boundedRateLimit(name, fallback, min, max) {
  const value = Number.parseInt(process.env[name] || "", 10);
  return Number.isInteger(value) && value >= min && value <= max ? value : fallback;
}

function bucketKey(scope, identifier, windowStart) {
  return crypto.createHash("sha256")
    .update(`${scope}:${identifier}:${windowStart}`)
    .digest("hex");
}

export async function consumeRateLimit({ scope, identifier, limit, windowMs, client = prisma, now = new Date() }) {
  const nowDate = now instanceof Date ? now : new Date(now);
  const windowStart = Math.floor(nowDate.getTime() / windowMs) * windowMs;
  const expiresAt = new Date(windowStart + windowMs);
  const key = bucketKey(scope, identifier || "unresolved", windowStart);

  await client.$executeRaw`
    INSERT INTO rate_limit_buckets (bucket_key, count, expires_at, updated_at)
    VALUES (${key}, 1, ${expiresAt}, ${nowDate})
    ON DUPLICATE KEY UPDATE count = count + 1, updated_at = VALUES(updated_at)
  `;
  const bucket = await client.rateLimitBucket.findUnique({ where: { key } });

  if (nowDate.getTime() - lastCleanup > 60 * 60 * 1000) {
    lastCleanup = nowDate.getTime();
    await client.rateLimitBucket.deleteMany({ where: { expiresAt: { lt: nowDate } } }).catch(() => {});
  }

  return {
    key,
    allowed: Boolean(bucket && bucket.count <= limit),
    retryAfterSeconds: Math.max(1, Math.ceil((expiresAt.getTime() - nowDate.getTime()) / 1000)),
  };
}

export async function clearRateLimit(key, client = prisma) {
  if (key) await client.rateLimitBucket.deleteMany({ where: { key } });
}