/**
 * Legacy `notes` JSON → normalized rows (pure planner).
 *
 * Early versions stored structured data inside the encrypted `notes` field of a
 * "container" grave: an `apartment_niche_stack` JSON blob holding every tier's
 * occupant, dates and photos, or a small `{ photo, text, birthDate, deathDate }`
 * object. The normalized schema keeps that data in real columns
 * (`Grave.birthDate/deathDate`, `Plot.totalTiers`, `PlotPhoto`) and leaves
 * `notes` as plain free text.
 *
 * `planPlotBackfill` takes one plot with DECRYPTED grave details and returns
 * the row operations needed. It performs no I/O so every case is unit-testable;
 * `scripts/backfill-tiers.js` applies the plan. Running it again on an already
 * migrated plot returns an empty plan (idempotent).
 */

const STACK_TYPE = "apartment_niche_stack";
const TRADITIONAL_TYPE = "traditional_plot";

/** Parse `notes` as a JSON object, or null when it is plain text. */
export function parseLegacyNotes(notes) {
  if (typeof notes !== "string") return null;
  const trimmed = notes.trim();
  if (!trimmed.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(trimmed);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function isStack(parsed) {
  return parsed?.type === STACK_TYPE && Array.isArray(parsed.tiers);
}

function text(value) {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t ? t : null;
}

/** Parse a loosely formatted date; null when empty or implausible. */
export function parseLooseDate(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const raw = text(value);
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getUTCFullYear();
  return y >= 1600 && y <= 2200 ? d : null;
}

function rootText(parsed) {
  return text(parsed?.text) ?? text(parsed?.notes);
}

/**
 * Resolve a birth/death value from legacy JSON into a column value. A value
 * that cannot be parsed is preserved by appending it to the notes text, so the
 * backfill never silently drops information.
 */
function dateFromLegacy(existing, raw, label, extras) {
  if (existing) return existing;
  const rawText = text(raw);
  if (!rawText) return null;
  const parsed = parseLooseDate(rawText);
  if (parsed) return parsed;
  extras.push(`${label}: ${rawText}`);
  return null;
}

function joinNotes(base, extras) {
  const parts = [base, ...extras].filter(Boolean);
  return parts.length ? parts.join("\n") : null;
}

function isPlaceholder(grave, plot) {
  const d = grave.details || {};
  return (
    grave.deceasedName === `Plot ${plot.plotNumber}` &&
    !grave.burialDate &&
    !text(d.causeOfDeath) &&
    !text(d.contactPerson) &&
    !text(d.contactPhone)
  );
}

/**
 * @typedef {object} PlannedGrave  Plaintext grave write (script encrypts details)
 * @property {number} [id]          existing grave id (update) — absent for create
 * @property {number} tier
 * @property {object} data          scalar Grave columns
 * @property {object|null} details  { causeOfDeath, contactPerson, contactPhone, notes }
 */

/**
 * @param {object} plot  { id, plotNumber, totalTiers, photos?: [{tier}],
 *   graves: [{ id, tier, deceasedName, burialDate, birthDate, deathDate,
 *   verificationStatus, verifiedAt, verifiedById, verificationNote,
 *   details: { causeOfDeath, contactPerson, contactPhone, notes } | null }] }
 * @returns {{ totalTiers: number|null, photos: Array<{tier:number,url:string}>,
 *   graveUpdates: PlannedGrave[], graveCreates: PlannedGrave[], graveDeletes: number[],
 *   changed: boolean }}
 */
export function planPlotBackfill(plot) {
  const graves = Array.isArray(plot.graves) ? plot.graves : [];
  const existingPhotoTiers = new Set((plot.photos || []).map((p) => p.tier));

  const plan = { totalTiers: null, photos: [], graveUpdates: [], graveCreates: [], graveDeletes: [], changed: false };
  const photoByTier = new Map();
  const addPhoto = (tier, url) => {
    const u = text(url);
    if (u && !existingPhotoTiers.has(tier) && !photoByTier.has(tier)) photoByTier.set(tier, u);
  };

  const parsedByGrave = new Map(graves.map((g) => [g.id, parseLegacyNotes(g.details?.notes)]));
  const container = graves.find((g) => isStack(parsedByGrave.get(g.id))) || null;
  const stack = container ? parsedByGrave.get(container.id) : null;

  const handled = new Set();

  // ── Stack container: explode tiers into real grave rows ────────────────
  if (stack) {
    addPhoto(0, stack.photo);
    for (const t of stack.tiers) addPhoto(Number(t.tier) || 0, t.photo);

    const realByTier = new Map();
    for (const g of graves) if (g.id !== container.id) realByTier.set(Number(g.tier) || 1, g);

    const occupants = stack.tiers
      .filter((t) => t && t.status === "occupied" && text(t.deceasedName))
      .map((t) => ({ ...t, tierNum: Number(t.tier) || 1 }));

    let containerConverted = false;
    for (const t of occupants) {
      const extras = [];
      const tierNotes = text(t.notes);
      const birth = (existing) => dateFromLegacy(existing, t.birthDate ?? t.dateOfBirth, "Born", extras);
      const death = (existing) => dateFromLegacy(existing, t.deathDate ?? t.dateOfDeath, "Died", extras);
      const real = realByTier.get(t.tierNum);

      if (real) {
        const rd = real.details || {};
        const realRoot = parseLegacyNotes(rd.notes);
        const realText = realRoot ? rootText(realRoot) : text(rd.notes);
        plan.graveUpdates.push({
          id: real.id,
          tier: t.tierNum,
          data: { birthDate: birth(real.birthDate), deathDate: death(real.deathDate) },
          details: {
            causeOfDeath: rd.causeOfDeath ?? t.causeOfDeath ?? null,
            contactPerson: rd.contactPerson ?? t.contactPerson ?? null,
            contactPhone: rd.contactPhone ?? t.contactPhone ?? null,
            notes: joinNotes(realText ?? tierNotes, extras),
          },
        });
        if (realRoot?.photo) addPhoto(t.tierNum, realRoot.photo);
        handled.add(real.id);
      } else if (t.tierNum === (Number(container.tier) || 1) && !containerConverted) {
        const cd = container.details || {};
        plan.graveUpdates.push({
          id: container.id,
          tier: t.tierNum,
          data: {
            deceasedName: text(t.deceasedName),
            burialDate: container.burialDate ?? parseLooseDate(t.burialDate),
            birthDate: birth(container.birthDate),
            deathDate: death(container.deathDate),
          },
          details: {
            causeOfDeath: text(t.causeOfDeath) ?? cd.causeOfDeath ?? null,
            contactPerson: text(t.contactPerson) ?? cd.contactPerson ?? null,
            contactPhone: text(t.contactPhone) ?? cd.contactPhone ?? null,
            notes: joinNotes(tierNotes, extras),
          },
        });
        containerConverted = true;
        handled.add(container.id);
      } else {
        const cd = container.details || {};
        plan.graveCreates.push({
          tier: t.tierNum,
          data: {
            plotId: plot.id,
            deceasedName: text(t.deceasedName),
            burialDate: parseLooseDate(t.burialDate),
            birthDate: birth(null),
            deathDate: death(null),
            status: "active",
            verificationStatus: container.verificationStatus ?? "pending",
            verifiedAt: container.verifiedAt ?? null,
            verifiedById: container.verifiedById ?? null,
            verificationNote: container.verificationNote ?? null,
          },
          details: {
            causeOfDeath: text(t.causeOfDeath),
            contactPerson: text(t.contactPerson),
            // The container's phone belongs to the family representative; only
            // fall back to it for tier-specific data that lacks its own.
            contactPhone: text(t.contactPhone) ?? cd.contactPhone ?? null,
            notes: joinNotes(tierNotes, extras),
          },
        });
      }
    }

    if (!containerConverted) {
      if (isPlaceholder(container, plot)) {
        // Pure stack holder with no real data of its own: redundant.
        plan.graveDeletes.push(container.id);
      } else {
        // A real record that carried the JSON: keep it, strip the JSON.
        plan.graveUpdates.push({
          id: container.id,
          tier: container.tier,
          data: {},
          details: { ...(container.details || {}), notes: rootText(stack) },
        });
      }
      handled.add(container.id);
    }
  }

  // ── Remaining graves carrying small legacy JSON ───────────────────────────
  for (const g of graves) {
    if (handled.has(g.id)) continue;
    const parsed = parsedByGrave.get(g.id);
    if (!parsed) continue; // plain-text notes: already normalized

    const tier = Number(g.tier) || 1;
    if (parsed.type === TRADITIONAL_TYPE || isPlaceholder(g, plot)) {
      addPhoto(tier === 1 ? 0 : tier, parsed.photo);
      if (isPlaceholder(g, plot)) {
        plan.graveDeletes.push(g.id);
        continue;
      }
    } else {
      addPhoto(tier, parsed.photo);
    }

    const extras = [];
    const d = g.details || {};
    plan.graveUpdates.push({
      id: g.id,
      tier,
      data: {
        birthDate: dateFromLegacy(g.birthDate, parsed.birthDate ?? parsed.dateOfBirth, "Born", extras),
        deathDate: dateFromLegacy(g.deathDate, parsed.deathDate ?? parsed.dateOfDeath, "Died", extras),
      },
      details: { ...d, notes: joinNotes(rootText(parsed), extras) },
    });
  }

  // ── Tier count ────────────────────────────────────────────────────────────
  const maxTier = graves.reduce((m, g) => Math.max(m, Number(g.tier) || 1), 1);
  const declared = stack ? Number(stack.totalTiers) || stack.tiers.length : 0;
  const wanted = Math.max(Number(plot.totalTiers) || 1, declared, maxTier);
  if (wanted !== (Number(plot.totalTiers) || 1)) plan.totalTiers = wanted;

  plan.photos = [...photoByTier.entries()].map(([tier, url]) => ({ tier, url }));
  plan.changed =
    plan.totalTiers !== null ||
    plan.photos.length > 0 ||
    plan.graveUpdates.length > 0 ||
    plan.graveCreates.length > 0 ||
    plan.graveDeletes.length > 0;
  return plan;
}
