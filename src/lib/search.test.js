import { describe, expect, it, vi } from "vitest";
import { smartSearch } from "@/lib/search";

function grave(id, name, sortOrder = 5, locationDetailId = 50) {
  return {
    id,
    deceasedName: name,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    plot: {
      id: id + 100,
      locationDetailId,
      plotNumber: `A-${id}`,
      locationDetail: { id: locationDetailId, locationId: 7, sortOrder, subsection: `S${sortOrder}` },
    },
  };
}

function prismaWith({ findUnique = null, graveFindMany = [], sections = [] } = {}) {
  return {
    grave: {
      findUnique: vi.fn().mockResolvedValue(findUnique),
      findMany: vi.fn().mockImplementation(() => Promise.resolve(graveFindMany.shift() || [])),
    },
    locationDetail: { findMany: vi.fn().mockResolvedValue(sections) },
  };
}

describe("smartSearch", () => {
  it("prioritizes an exact numeric grave ID", async () => {
    const match = grave(42, "Ada Reyes");
    const prisma = prismaWith({ findUnique: match });
    const result = await smartSearch(prisma, "42");
    expect(result).toMatchObject({ exact: [match], suggestions: [], nearby: [], matchType: "graveId" });
    expect(prisma.grave.findMany).not.toHaveBeenCalled();
  });

  it("uses an indexed half-open date range for a four-digit burial year", async () => {
    const match = grave(2, "Year Match");
    const prisma = prismaWith({ graveFindMany: [[match]] });
    const result = await smartSearch(prisma, "2020");
    expect(result.matchType).toBe("burialYear");
    const args = prisma.grave.findMany.mock.calls[0][0];
    expect(args.where.burialDate.gte.toISOString()).toBe("2020-01-01T00:00:00.000Z");
    expect(args.where.burialDate.lt.toISOString()).toBe("2021-01-01T00:00:00.000Z");
    expect(args.take).toBe(20);
  });

  it("returns bounded phonetic suggestions and deterministic adjacent sections", async () => {
    const phonetic = grave(10, "Smith", 5, 50);
    const farther = grave(30, "Other", 6, 60);
    const nearer = grave(20, "Other", 4, 40);
    const prisma = prismaWith({
      graveFindMany: [[], [phonetic], [farther, nearer]],
      sections: [{ id: 40, sortOrder: 4 }, { id: 60, sortOrder: 6 }],
    });
    const result = await smartSearch(prisma, "Smyth");
    expect(result.matchType).toBe("phonetic");
    expect(result.suggestions[0].id).toBe(10);
    expect(result.nearby.map((item) => item.id)).toEqual([20, 30]);
    expect(prisma.grave.findMany.mock.calls[1][0].take).toBe(500);
    expect(prisma.locationDetail.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 2 }));
  });
});