import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { categoryLabel, categoryOf, describeAction, formatDetail, isValidCategory, parseAction } from "@/lib/user-log";

describe("user-log helpers", () => {
  it("splits an action from its details", () => {
    expect(parseAction("grave.archive:run=daily;count=2")).toEqual({ key: "grave.archive", detail: "run=daily;count=2" });
    expect(parseAction("plot.update")).toEqual({ key: "plot.update", detail: "" });
    expect(parseAction(null)).toEqual({ key: "", detail: "" });
  });

  it("reads the details audit writes after a space as JSON — the real stored format", () => {
    const stored = 'grave.photo_update {"photoUrl":"/uploads/graves/grave-157.png","tier":null,"applyToAll":false}';
    const { key, detail } = parseAction(stored);
    expect(key).toBe("grave.photo_update");
    expect(detail).toBe('{"photoUrl":"/uploads/graves/grave-157.png","tier":null,"applyToAll":false}');
    expect(describeAction(stored).label).toBe("Changed a grave photo");
    expect(describeAction('plot.batch_update {"updatedCount":12,"deletedCount":0}').label).toBe("Saved a plot layout");
    expect(categoryOf(stored)).toBe("grave");
  });

  it("formats details for people", () => {
    expect(formatDetail('{"updatedCount":12,"deletedCount":0,"note":null}')).toBe("updatedCount=12 · deletedCount=0");
    expect(formatDetail("run=daily;count=2")).toBe("run=daily;count=2");
    expect(formatDetail("")).toBe("");
    expect(formatDetail(JSON.stringify({ photoUrl: "x".repeat(100) }))).toMatch(/^photoUrl=x{39}…$/);
    expect(formatDetail("y".repeat(200)).length).toBe(80);
  });

  it("derives the category", () => {
    expect(categoryOf("plot.photo_update")).toBe("plot");
    expect(categoryOf("grave.archive:run=x;count=1")).toBe("grave");
    expect(categoryOf("standalone")).toBe("standalone");
  });

  it("describes known actions in plain language and keeps their details", () => {
    expect(describeAction("grave.create").label).toBe("Added a grave record");
    expect(describeAction("auth.login_failed").label).toBe("Failed sign-in attempt");
    const archive = describeAction("grave.archive:run=daily;count=2");
    expect(archive.label).toBe("Archived grave records");
    expect(archive.detail).toBe("run=daily;count=2");
  });

  it("falls back gracefully for actions it has no label for", () => {
    expect(describeAction("thing.do_stuff").label).toBe("Thing do stuff");
    expect(describeAction("").label).toBe("Unknown action");
  });

  it("labels categories and validates filter input", () => {
    expect(categoryLabel("auth")).toBe("Sign-in & sign-out");
    expect(categoryLabel("some_new")).toBe("Some new");
    expect(isValidCategory("grave")).toBe(true);
    for (const bad of ["", "Grave", "a.b", "x'; DROP", "a".repeat(31), 5, null]) expect(isValidCategory(bad)).toBe(false);
  });

  it("has a label for every action the app actually records", () => {
    // Walk src for `action: "<name>"` literals so a new audit action cannot ship unlabelled.
    const found = new Set();
    const walk = (dir) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p);
        else if (/\.js$/.test(e.name) && !/\.test\.js$/.test(e.name)) {
          for (const m of fs.readFileSync(p, "utf8").matchAll(/action:\s*["'`]([a-z_]+\.[a-z_]+)["'`:]/g)) found.add(m[1]);
        }
      }
    };
    walk("src");
    expect(found.size).toBeGreaterThan(10);
    for (const key of found) {
      expect(describeAction(key).label, `label for ${key}`).not.toMatch(/\./);
      expect(describeAction(key).label, `label for ${key}`).not.toBe(describeAction("zzz.zzz").label);
    }
  });
});
