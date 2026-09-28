/**
 * Pure plot / grave presentation helpers.
 *
 * These were previously defined inside `PlotDetailsDrawer.js`, which made them
 * impossible to unit test and coupled presentation logic to a 1k-line client
 * component. They take plain data and return plain data — no React, no I/O.
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

/**
 * Extract (or synthesize) the tier stack shown for a plot.
 *
 * Order of precedence:
 *  1. An explicit apartment-niche stack encoded in the grave's encrypted
 *     `details.notes` JSON (`type: "apartment_niche_stack"`).
 *  2. Multiple grave records attached to the plot.
 *  3. A row / apartment-section plot -> 4 synthetic tiers.
 *  4. A single traditional plot -> one ground-burial tier.
 *
 * Occupants always come from the plot's own grave records; nothing is
 * hardcoded, so a plot number alone can never fabricate personal data.
 */
export function extractPlotTiers(plot) {
  if (!plot) return [];

  // 1. Explicit tier data.
  const grave = plot.graves?.[0];
  if (grave?.details?.notes) {
    try {
      const parsed = JSON.parse(grave.details.notes);
      if (parsed.type === "apartment_niche_stack" && Array.isArray(parsed.tiers)) {
        return parsed.tiers.map((t) => ({
          ...t,
          photo: t.photo || parsed.photo || null,
        }));
      }
    } catch {
      // not JSON, continue
    }
  }

  // 2. Multi-grave plot.
  if (plot.graves && plot.graves.length > 1) {
    return plot.graves.map((g, idx) => ({
      tier: idx + 1,
      label: `Tier ${idx + 1}`,
      deceasedName: g.deceasedName,
      burialDate: g.burialDate,
      status: g.status === "active" ? "occupied" : g.status || "occupied",
      causeOfDeath: g.details?.causeOfDeath,
      contactPerson: g.details?.contactPerson,
      notes: g.details?.notes,
    }));
  }

  // 3. Row / apartment crypt section.
  const subsection = plot.locationDetail?.subsection || "";
  const isRowPlot = subsection.startsWith("ROW-") || plot.plotNumber?.startsWith("ROW-");

  if (isRowPlot) {
    const hasOccupant = plot.graves?.length > 0 && plot.status === "occupied";
    const primaryGrave = plot.graves?.[0];
    return [
      { tier: 4, label: "Tier 4 (Top Level)", status: "available" },
      { tier: 3, label: "Tier 3 (Upper Level)", status: "available" },
      {
        tier: 2,
        label: "Tier 2 (Second Level)",
        status: plot.status === "reserved" ? "reserved" : "available",
      },
      {
        tier: 1,
        label: "Tier 1 (Ground Level)",
        deceasedName: hasOccupant ? primaryGrave.deceasedName : null,
        burialDate: hasOccupant ? primaryGrave.burialDate : null,
        causeOfDeath: primaryGrave?.details?.causeOfDeath || null,
        contactPerson: primaryGrave?.details?.contactPerson || null,
        status: hasOccupant ? "occupied" : "available",
      },
    ];
  }

  // 4. Single traditional plot.
  if (plot.graves?.length > 0) {
    const g = plot.graves[0];
    let photo = g.photo || null;
    let notesText = g.details?.notes;
    if (notesText) {
      try {
        const parsed = JSON.parse(notesText);
        if (parsed.photo) photo = parsed.photo;
        if (parsed.text !== undefined) notesText = parsed.text;
      } catch {
        // plain text notes
      }
    }
    return [
      {
        tier: 1,
        label: "Ground Burial Lot",
        deceasedName: g.deceasedName,
        burialDate: g.burialDate,
        causeOfDeath: g.details?.causeOfDeath,
        contactPerson: g.details?.contactPerson,
        notes: notesText,
        photo,
        status: plot.status || "occupied",
      },
    ];
  }

  return [{ tier: 1, label: "Ground Burial Lot", status: plot.status || "available" }];
}

/**
 * Extract photo URL from a grave record if available.
 * @param {object} grave
 * @returns {string|null}
 */
export function getGravePhoto(grave) {
  if (!grave) return null;
  if (grave.photo) return grave.photo;
  if (grave.details?.notes) {
    try {
      const parsed = JSON.parse(grave.details.notes);
      if (parsed.photo) return parsed.photo;
      if (parsed.type === "apartment_niche_stack" && Array.isArray(parsed.tiers)) {
        const withPhoto = parsed.tiers.find((t) => t.photo);
        if (withPhoto?.photo) return withPhoto.photo;
        if (parsed.photo) return parsed.photo;
      }
    } catch {
      // not JSON
    }
  }
  return null;
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

/**
 * Deceased names to show for a plot summary, split from tier data, multiple
 * graves, or a combined `deceasedName` string ("A & B", "A / B", "A and B").
 */
export function getPlotSummaryNames(p) {
  if (!p) return [];
  const grave = p.graves?.[0];
  if (grave?.details?.notes) {
    try {
      const parsed = JSON.parse(grave.details.notes);
      if (Array.isArray(parsed.tiers)) {
        const occ = parsed.tiers
          .filter((t) => t.deceasedName && t.status === "occupied")
          .map((t) => t.deceasedName.trim());
        if (occ.length > 0) return occ;
      }
    } catch {
      // not JSON
    }
  }
  if (Array.isArray(p.graves) && p.graves.length > 1) {
    const names = p.graves.map((g) => g.deceasedName?.trim()).filter(Boolean);
    if (names.length > 0) return names;
  }
  const raw = (grave?.deceasedName || "").trim();
  if (raw) {
    if (raw.includes(" & ")) return raw.split(/\s*&\s*/).filter(Boolean);
    if (raw.includes(" / ")) return raw.split(/\s*\/\s*/).filter(Boolean);
    if (raw.toLowerCase().includes(" and ")) return raw.split(/\s+and\s+/i).filter(Boolean);
    return [raw];
  }
  return [p.plotNumber ? `Plot ${p.plotNumber}` : "Plot Details"];
}
