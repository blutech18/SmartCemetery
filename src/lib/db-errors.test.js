import { describe, it, expect, vi } from "vitest";
import { isSchemaOutOfDate, schemaOutOfDateResponse } from "@/lib/db-errors";

describe("db-errors", () => {
  it("recognises missing table/column errors only", () => {
    expect(isSchemaOutOfDate({ code: "P2021" })).toBe(true);
    expect(isSchemaOutOfDate({ code: "P2022" })).toBe(true);
    expect(isSchemaOutOfDate({ code: "P2002" })).toBe(false);
    expect(isSchemaOutOfDate(new Error("x"))).toBe(false);
    expect(isSchemaOutOfDate(null)).toBe(false);
  });

  it("returns an actionable 503 and logs the fix; null for other errors", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = schemaOutOfDateResponse({ code: "P2022", meta: { column: "plots.total_tiers" } }, "GET /x");
    expect(res.status).toBe(503);
    expect((await res.json()).error.message).toMatch(/db:migrate/);
    expect(spy.mock.calls[0][0]).toMatch(/total_tiers.*db:migrate/);
    expect(schemaOutOfDateResponse({ code: "P2002" })).toBeNull();
    spy.mockRestore();
  });
});
