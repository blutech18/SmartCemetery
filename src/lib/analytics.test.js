import { describe, expect, it } from "vitest";
import { aggregateOperationsAnalytics, analyticsToCsv } from "@/lib/analytics";

describe("operations analytics privacy", () => {
  it("returns only action and navigation aggregates", () => {
    const result = aggregateOperationsAnalytics(
      [
        { action: "grave.archive:run=daily;count=2", ipAddress: "192.0.2.1", createdAt: "2026-07-01T10:00:00Z" },
        { action: "grave.archive:run=other;count=1", createdAt: "2026-07-01T11:00:00Z" },
      ],
      [
        { createdAt: "2026-07-01T10:00:00Z", channel: "dashboard", plotId: 4, origin: "exact-private-origin" },
        { createdAt: "2026-07-02T10:00:00Z", channel: "kiosk", plotId: null, destination: "exact-private-destination" },
      ]
    );

    expect(result.auditActions).toEqual([{ action: "grave.archive", count: 2 }]);
    expect(result.navigation.destinations).toEqual([
      { destination: "Plot 4", count: 1 },
      { destination: "Unassigned plot", count: 1 },
    ]);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("192.0.2.1");
    expect(serialized).not.toContain("exact-private");
  });

  it("exports the same aggregate groups to CSV", () => {
    const analytics = aggregateOperationsAnalytics([], [{ createdAt: "2026-07-01T10:00:00Z", channel: "dashboard", plotId: 2 }]);
    const csv = analyticsToCsv(analytics, { from: "2026-07-01", to: "2026-07-31" });
    expect(csv).toContain("Navigation channel,Count");
    expect(csv).toContain("dashboard,1");
    expect(csv).toContain("Plot 2,1");
  });
});
