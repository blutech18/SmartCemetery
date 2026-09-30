import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { DEMO_GRAVE_NAMES, DEMO_LOCATION_NAMES, planDemoCleanup } from "@/lib/demo-data";

const loc = (id, name, plots) => ({ id, name, plots });
const plot = (id, ...names) => ({ id, graves: names.map((n, i) => ({ id: id * 100 + i, deceasedName: n })) });

describe("planDemoCleanup", () => {
  it("keeps the oldest copy and removes newer demo-only copies", () => {
    const plan = planDemoCleanup([
      loc(5, "Section A - North Wing", [plot(50, "Jose Rizal")]),
      loc(2, "Section A - North Wing", [plot(20, "Andres Bonifacio"), plot(21)]),
      loc(9, "Section A - North Wing", [plot(90)]),
    ]);
    expect(plan.keep).toEqual([{ id: 2, name: "Section A - North Wing" }]);
    expect(plan.remove.map((r) => r.id).sort()).toEqual([5, 9]);
    expect(plan.remove.find((r) => r.id === 5)).toMatchObject({ plotIds: [50], graveIds: [5000] });
    expect(plan.blocked).toEqual([]);
  });

  it("never removes a copy that holds a record that could be real", () => {
    const plan = planDemoCleanup([
      loc(1, "Section B - East Side", [plot(10, "Lapu-Lapu")]),
      loc(2, "Section B - East Side", [plot(20, "Datu Puti", "Maria Dela Cruz")]),
    ]);
    expect(plan.remove).toEqual([]);
    expect(plan.blocked).toEqual([{ id: 2, name: "Section B - East Side", realNames: ["Maria Dela Cruz"] }]);
  });

  it("matches demo names ignoring case and spacing", () => {
    const plan = planDemoCleanup([
      loc(1, "Section C - South Garden", []),
      loc(2, "Section C - South Garden", [plot(20, "  jose RIZAL ")]),
    ]);
    expect(plan.remove.map((r) => r.id)).toEqual([2]);
  });

  it("does nothing when there is a single copy, and ignores locations that are not demo ones", () => {
    const plan = planDemoCleanup([
      loc(1, "Section A - North Wing", [plot(10, "Anybody Real")]),
      loc(7, "City Memorial Park (CMP) - Bolonsiri", [plot(70, "Jose Rizal")]),
      loc(8, "City Memorial Park (CMP) - Bolonsiri", [plot(80)]),
    ]);
    expect(plan.remove).toEqual([]);
    expect(plan.blocked).toEqual([]);
    expect(plan.keep).toEqual([{ id: 1, name: "Section A - North Wing" }]);
  });

  it("is stable: planning again after removing the extras finds nothing more to do", () => {
    const after = [loc(2, "Section A - North Wing", [plot(20, "Jose Rizal")])];
    expect(planDemoCleanup(after).remove).toEqual([]);
  });
});

describe("demo data stays in step with the seed", () => {
  const seed = fs.readFileSync("prisma/seed.js", "utf8");

  it("creates exactly the demo locations the cleanup knows about", () => {
    for (const name of DEMO_LOCATION_NAMES) expect(seed).toContain(`name: "${name}"`);
  });

  it("takes its sample deceased names from the shared list", () => {
    expect(seed).toContain("DEMO_GRAVE_NAMES");
    expect(new Set(DEMO_GRAVE_NAMES).size).toBe(DEMO_GRAVE_NAMES.length);
  });
});
