import { doubleMetaphone } from "double-metaphone";

/**
 * Smart Search Engine
 * If exact match not found, suggests closest phonetic matches
 * Uses Double Metaphone algorithm for phonetic matching
 */

/**
 * Generate phonetic keys for a name
 */
export function getPhoneticKeys(name) {
  const words = name.trim().toLowerCase().split(/\s+/);
  return words.map((word) => doubleMetaphone(word)).flat();
}

/**
 * Calculate phonetic similarity score between two names (0-1)
 */
export function phoneticSimilarity(name1, name2) {
  const keys1 = getPhoneticKeys(name1);
  const keys2 = getPhoneticKeys(name2);

  if (keys1.length === 0 || keys2.length === 0) return 0;

  let matches = 0;
  for (const k1 of keys1) {
    for (const k2 of keys2) {
      if (k1 && k2 && k1 === k2) {
        matches++;
        break;
      }
    }
  }

  return matches / Math.max(keys1.length, keys2.length);
}

/**
 * Search graves with smart phonetic fallback
 * Returns { exact: [], suggestions: [] }
 */
export async function smartSearch(prisma, query) {
  // First, try exact match (case-insensitive)
  const exact = await prisma.grave.findMany({
    where: {
      deceasedName: { contains: query },
    },
    include: {
      plot: {
        include: {
          locationDetail: {
            include: { location: true },
          },
        },
      },
      details: true,
    },
    take: 20,
  });

  if (exact.length > 0) {
    return { exact, suggestions: [] };
  }

  // Bounded phonetic fallback. A persisted phonetic index is planned for the
  // next search phase; never load the entire registry into application memory.
  const allGraves = await prisma.grave.findMany({
    include: {
      plot: {
        include: {
          locationDetail: {
            include: { location: true },
          },
        },
      },
      details: true,
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  const scored = allGraves
    .map((grave) => ({
      ...grave,
      score: phoneticSimilarity(query, grave.deceasedName),
    }))
    .filter((g) => g.score > 0.3)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  return { exact: [], suggestions: scored };
}
