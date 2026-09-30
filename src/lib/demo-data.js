/**
 * The invented sample data that `prisma/seed.js` creates when SEED_DEMO_DATA is
 * on, and the pure logic that finds leftover duplicate copies of it.
 *
 * Import-free on purpose: the CommonJS seed and cleanup scripts load it with a
 * plain dynamic `import()`.
 */

/** Names of the demo locations the seed creates (one copy each is expected). */
export const DEMO_LOCATION_NAMES = [
  "Section A - North Wing",
  "Section B - East Side",
  "Section C - South Garden",
];

/** Names of the invented deceased people the seed creates. */
export const DEMO_GRAVE_NAMES = [
  "Jose Rizal", "Andres Bonifacio", "Emilio Aguinaldo",
  "Apolinario Mabini", "Gregorio Del Pilar", "Antonio Luna",
  "Melchora Aquino", "Gabriela Silang", "Diego Silang",
  "Juan Luna", "Felix Resurreccion Hidalgo", "Marcelo H. Del Pilar",
  "Graciano Lopez Jaena", "Lapu-Lapu", "Sultan Kudarat",
  "Datu Puti", "Raja Sulayman", "Pedro Calungsod",
  "Lorenzo Ruiz", "Josefa Llanes Escoda", "Rosa Sevilla",
  "Trinidad Tecson", "Tandang Sora", "Heneral Malvar",
  "Vicente Lim", "Leon Kilat", "Francisco Dagohoy",
  "Rajah Humabon", "Carlos P. Garcia", "Ramon Magsaysay",
];

const norm = (s) => String(s ?? "").trim().toLowerCase();

/**
 * Decide which duplicate demo locations can be removed.
 *
 * Earlier seed versions created the demo sections again on every run. For each
 * demo name the OLDEST copy (lowest id) is kept. A newer copy is removable only
 * when every grave in it has an invented demo name; if it holds anything that
 * could be a real record it is reported as `blocked` and left untouched.
 *
 * @param {Array<{ id: number, name: string, plots: Array<{ id: number, graves: Array<{ id: number, deceasedName: string }> }> }>} locations
 * @param {string[]} [demoNames]
 * @param {string[]} [demoGraveNames]
 * @returns {{
 *   keep: Array<{ id: number, name: string }>,
 *   remove: Array<{ id: number, name: string, plotIds: number[], graveIds: number[] }>,
 *   blocked: Array<{ id: number, name: string, realNames: string[] }>,
 * }}
 */
export function planDemoCleanup(locations, demoNames = DEMO_LOCATION_NAMES, demoGraveNames = DEMO_GRAVE_NAMES) {
  const demoSet = new Set(demoGraveNames.map(norm));
  const plan = { keep: [], remove: [], blocked: [] };

  for (const name of demoNames) {
    const copies = locations.filter((l) => l.name === name).sort((a, b) => a.id - b.id);
    if (copies.length === 0) continue;

    const [first, ...extras] = copies;
    plan.keep.push({ id: first.id, name });

    for (const copy of extras) {
      const graves = copy.plots.flatMap((p) => p.graves);
      const real = graves.filter((g) => !demoSet.has(norm(g.deceasedName)));
      if (real.length > 0) {
        plan.blocked.push({ id: copy.id, name, realNames: [...new Set(real.map((g) => g.deceasedName))].slice(0, 5) });
      } else {
        plan.remove.push({
          id: copy.id,
          name,
          plotIds: copy.plots.map((p) => p.id),
          graveIds: graves.map((g) => g.id),
        });
      }
    }
  }
  return plan;
}
