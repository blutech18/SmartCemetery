/**
 * Pure plot / grave presentation helpers: plain data in, plain data out — no
 * React, no I/O. Tier/photo data comes from real columns (Plot.totalTiers,
 * Grave.tier/birthDate/deathDate, PlotPhoto), never from parsed notes.
 */

/** Two-letter initials for a name, or "?" when empty. */
export function getInitials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Append an English ordinal suffix to an integer (1 -> "1st"). */
export function getOrdinal(n) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * Format a date as "Month Dth, YYYY".
 *
 * Uses UTC components so that a date-only value (e.g. "2021-10-10", parsed as
 * UTC midnight) and an ISO timestamp (e.g. "2021-10-14T00:00:00.000Z") both
 * render the same calendar day regardless of the viewer's timezone. The old
 * implementation used local getters and shifted the day backwards for viewers
 * in negative-UTC timezones.
 *
 * @param {string|Date|null|undefined} dateStr
 * @returns {string} formatted date, "—" for empty, or the raw input if unparseable
 */
export function formatPlotDate(dateStr) {
  if (!dateStr) return "—";
  try {
    const d = dateStr instanceof Date ? dateStr : new Date(dateStr);
    if (Number.isNaN(d.getTime())) return String(dateStr);
    return `${MONTHS[d.getUTCMonth()]} ${getOrdinal(d.getUTCDate())}, ${d.getUTCFullYear()}`;
  } catch {
    return String(dateStr);
  }
}

const TIER_LABELS = ["Ground Level", "Second Level", "Third Level"];

/** Display label for tier `n` of a stack with `total` tiers. */
export function tierLabel(n, total) {
  if (total <= 1) return "Ground Burial Lot";
  const name = n === total ? "Top Level" : TIER_LABELS[n - 1] || `Level ${n}`;
  return `Tier ${n} (${name})`;
}

/** Number of tiers a plot displays: its column, at least the highest grave tier. */
function plotTierCount(plot) {
  const fromGraves = (plot.graves || []).reduce((m, g) => Math.max(m, Number(g.tier) || 1), 1);
  return Math.max(Number(plot.totalTiers) || 1, fromGraves);
}

/** Photo URL for one tier (falls back to the plot-wide photo), or null. */
function photoForTier(photos, tier) {
  if (!Array.isArray(photos)) return null;
  return (
    photos.find((p) => p.tier === tier)?.url ||
    photos.find((p) => p.tier === 0)?.url ||
    null
  );
}

/** Plot-wide photo (tier 0), or null. */
export function getPlotPhoto(plot) {
  return plot?.photos?.find((p) => p.tier === 0)?.url || null;
}

/**
 * Build the tier stack shown for a plot from its real rows: `plot.totalTiers`,
 * the plot's Grave records (one per tier) and its PlotPhoto rows. Occupants
 * always come from the plot's own grave records — nothing is hardcoded — so a
 * plot number alone can never fabricate personal data.
 */
export function extractPlotTiers(plot) {
  if (!plot) return [];

  const total = plotTierCount(plot);
  const byTier = new Map();
  for (const g of plot.graves || []) byTier.set(Number(g.tier) || 1, g);

  const tiers = [];
  for (let tier = 1; tier <= total; tier += 1) {
    const label = tierLabel(tier, total);
    const grave = byTier.get(tier);
    if (!grave) {
      tiers.push({
        tier,
        label,
        status: total === 1 ? plot.status || "available" : "available",
        photo: photoForTier(plot.photos, tier),
      });
      continue;
    }
    tiers.push({
      id: grave.id,
      tier,
      label,
      deceasedName: grave.deceasedName,
      birthDate: grave.birthDate ?? null,
      deathDate: grave.deathDate ?? null,
      burialDate: grave.burialDate ?? null,
      status: grave.status === "active" ? "occupied" : grave.status || "occupied",
      causeOfDeath: grave.details?.causeOfDeath,
      contactPerson: grave.details?.contactPerson,
      notes: grave.details?.notes || null,
      photo: photoForTier(plot.photos, tier),
    });
  }
  return tiers;
}

/**
 * Photo for a grave record: its own tier's photo, else the plot-wide photo.
 * Needs `grave.plot.photos` to be included by the API.
 *
 * @param {object} grave
 * @returns {string|null}
 */
export function getGravePhoto(grave) {
  if (!grave) return null;
  return photoForTier(grave.plot?.photos, Number(grave.tier) || 1);
}

/** Canonical status -> presentation mapping. */
export function statusMeta(status) {
  switch (status?.toLowerCase()) {
    case "occupied":
      return { label: "Occupied", bg: "#EF4444", text: "#ffffff", border: "#DC2626" };
    case "available":
      return { label: "Available", bg: "#22C55E", text: "#ffffff", border: "#16A34A" };
    case "reserved":
    case "hold":
      return { label: "Hold / Reserved", bg: "#38BDF8", text: "#ffffff", border: "#0284C7" };
    case "sold":
      return { label: "Sold", bg: "#F59E0B", text: "#ffffff", border: "#D97706" };
    default:
      return { label: "Unavailable", bg: "#64748B", text: "#ffffff", border: "#475569" };
  }
}

/** Split a combined legacy name ("A & B", "A / B", "A and B") into parts. */
function splitCombinedName(raw) {
  if (raw.includes(" & ")) return raw.split(/\s*&\s*/).filter(Boolean);
  if (raw.includes(" / ")) return raw.split(/\s*\/\s*/).filter(Boolean);
  if (raw.toLowerCase().includes(" and ")) return raw.split(/\s+and\s+/i).filter(Boolean);
  return [raw];
}

/**
 * Deceased names buried in a plot, ordered by tier; [] when none. One grave
 * whose name joins several people is split for display.
 */
export function getPlotOccupantNames(plot) {
  const graves = [...(plot?.graves || [])].sort(
    (a, b) => (Number(a.tier) || 1) - (Number(b.tier) || 1)
  );
  const names = graves.map((g) => g.deceasedName?.trim()).filter(Boolean);
  if (names.length === 1) return splitCombinedName(names[0]);
  return names;
}

/** Names for a plot summary/callout, falling back to the plot number. */
export function getPlotSummaryNames(p) {
  if (!p) return [];
  const names = getPlotOccupantNames(p);
  if (names.length > 0) return names;
  return [p.plotNumber ? `Plot ${p.plotNumber}` : "Plot Details"];
}
