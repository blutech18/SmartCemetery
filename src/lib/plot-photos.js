import { prisma } from "@/lib/db";

/**
 * Set or clear plot photos. `tier` 0 is the plot-wide photo; 1..N are tiers.
 * A null `photoUrl` removes the photo. With `applyToAll` the same photo is
 * applied to the plot-wide slot and every tier.
 *
 * @param {{ plotId: number, tier: number, photoUrl: string|null, applyToAll?: boolean, totalTiers?: number }} change
 * @param {import("@prisma/client").Prisma.TransactionClient | typeof prisma} [client]
 * @returns {Promise<Array<{ tier: number, url: string }>>} the plot's photos afterwards
 */
export async function setPlotPhoto(
  { plotId, tier, photoUrl, applyToAll = false, totalTiers = 1 },
  client = prisma
) {
  const tiers = applyToAll
    ? Array.from({ length: Math.max(1, totalTiers) + 1 }, (_, i) => i)
    : [tier];

  for (const t of tiers) {
    if (photoUrl) {
      await client.plotPhoto.upsert({
        where: { plotId_tier: { plotId, tier: t } },
        create: { plotId, tier: t, url: photoUrl },
        update: { url: photoUrl },
      });
    } else {
      await client.plotPhoto.deleteMany({ where: { plotId, tier: t } });
    }
  }

  const photos = await client.plotPhoto.findMany({
    where: { plotId },
    select: { tier: true, url: true },
    orderBy: { tier: "asc" },
  });
  return photos;
}
