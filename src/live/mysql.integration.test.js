import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";

const enabled = process.env.RUN_LIVE_MYSQL === "1";
const prisma = new PrismaClient();
const tag = `live-${randomUUID().slice(0, 16)}`;
let location;
let detail;
let plots;
let user;

describe.skipIf(!enabled)("live MySQL migration and integrity", () => {
  beforeAll(async () => {
    const userType = await prisma.userType.upsert({
      where: { typeName: "Client" },
      update: {},
      create: { typeName: "Client" },
    });
    user = await prisma.user.create({
      data: {
        name: tag,
        email: `${tag}@example.test`,
        passwordHash: "test-only-not-a-login-hash",
        userTypeId: userType.id,
      },
    });
    location = await prisma.location.create({ data: { name: tag } });
    detail = await prisma.locationDetail.create({
      data: { locationId: location.id, subsection: tag.slice(0, 40), sortOrder: 1 },
    });
    plots = await Promise.all([1, 2].map((number) => prisma.plot.create({
      data: { locationDetailId: detail.id, plotNumber: `${tag}-${number}` },
    })));
  });
  afterAll(async () => {
    if (!enabled) return;
    await prisma.graveDetail.deleteMany({ where: { grave: { deceasedName: { startsWith: tag } } } });
    await prisma.grave.deleteMany({ where: { deceasedName: { startsWith: tag } } });
    await prisma.plot.deleteMany({ where: { locationDetailId: detail?.id } });
    if (detail) await prisma.locationDetail.delete({ where: { id: detail.id } });
    if (location) await prisma.location.delete({ where: { id: location.id } });
    if (user) await prisma.user.delete({ where: { id: user.id } });
    await prisma.$disconnect();
  });

  it("allows exactly one concurrent grave claim for a plot", async () => {
    async function claim(suffix) {
      return prisma.$transaction(async (tx) => {
        const claimed = await tx.plot.updateMany({
          where: { id: plots[0].id, status: "available" },
          data: { status: "occupied" },
        });
        if (claimed.count !== 1) throw new Error("plot conflict");
        return tx.grave.create({
          data: { plotId: plots[0].id, deceasedName: `${tag}-${suffix}`, burialDate: new Date() },
        });
      });
    }

    const outcomes = await Promise.allSettled([claim("a"), claim("b")]);
    expect(outcomes.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(await prisma.grave.count({ where: { plotId: plots[0].id } })).toBe(1);
  });

  it("database restrictions retain archived grave map references", async () => {
    await prisma.plot.update({ where: { id: plots[1].id }, data: { status: "occupied" } });
    await prisma.grave.create({
      data: {
        plotId: plots[1].id,
        deceasedName: `${tag}-archived`,
        burialDate: new Date("2000-01-01"),
        status: "archived",
        archivedAt: new Date(),
      },
    });

    await expect(prisma.plot.delete({ where: { id: plots[1].id } }))
      .rejects.toMatchObject({ code: "P2003" });
  });
});