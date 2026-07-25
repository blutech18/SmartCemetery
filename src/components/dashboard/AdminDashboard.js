"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Archive, MapPin, ClipboardList, MessageSquare, Plus, Eye } from "lucide-react";
import { PageHeader } from "./PageHeader";
import { KpiCard } from "./KpiCard";
import { Button } from "../ui/Button";
import { Panel } from "../ui/Panel";
import { Skeleton } from "../ui/Skeleton";
import { OccupancyChart } from "../charts/OccupancyChart";
import { RequestTrendChart } from "../charts/RequestTrendChart";
import {
  buildOccupancyByLocation,
  buildRequestTrend,
  timeAgo,
} from "../../lib/dashboard-metrics";

export function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [plots, setPlots] = useState([]);
  const [requests, setRequests] = useState([]);
  const [incomplete, setIncomplete] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    const load = async (url) => {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) return null;
      return res.json();
    };

    Promise.all([
      load("/api/reports/stats"),
      load("/api/plots"),
      load("/api/requests"),
      load("/api/graves/incomplete"),
    ])
      .then(([statsData, plotData, requestData, incompleteData]) => {
        if (statsData) setStats(statsData);
        if (Array.isArray(plotData)) setPlots(plotData);
        if (Array.isArray(requestData)) setRequests(requestData);
        const rows = Array.isArray(incompleteData)
          ? incompleteData
          : incompleteData?.graves;
        if (Array.isArray(rows)) setIncomplete(rows);
      })
      .catch((error) => {
        if (error.name !== "AbortError") console.error(error);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, []);

  const occupancyData = buildOccupancyByLocation(plots);
  const trendData = buildRequestTrend(requests);
  const pendingRequests = requests.filter((r) => r.status === "pending");
  const oldestPending = pendingRequests[pendingRequests.length - 1];
  const unpinnedPlots = plots.filter((p) => p.gpsLat == null || p.gpsLng == null);

  // Operational queue: oldest pending requests first, then GPS blockers.
  const queue = [
    ...pendingRequests.slice(-4).reverse().map((request) => ({
      key: `request-${request.id}`,
      label: `${formatType(request.type)} · ${request.referenceId || `#${request.id}`}`,
      status: `Pending ${timeAgo(request.createdAt)}`,
      tone: "muted",
      href: "/dashboard/requests",
    })),
    ...(unpinnedPlots.length > 0
      ? [{
          key: "gps-blocker",
          label: "Missing GPS coordinates",
          status: `${unpinnedPlots.length} plot${unpinnedPlots.length === 1 ? "" : "s"} unpinned`,
          tone: "danger",
          href: "/dashboard/map",
        }]
      : []),
    ...(incomplete.length > 0
      ? [{
          key: "verification-backlog",
          label: "Records awaiting verification",
          status: `${incomplete.length} in queue`,
          tone: "warning",
          href: "/dashboard/verification",
        }]
      : []),
  ].slice(0, 6);

  return (
    <>
      <PageHeader
        title="Cemetery operations"
        description="Live overview of records, plots, requests, and service quality"
        actions={
          <>
            <Button variant="secondary" href="/dashboard/broadcasts">Create broadcast</Button>
            <Button variant="secondary" href="/dashboard/reports">Export report</Button>
            <Button variant="secondary" href="/dashboard/graves">
              <Plus size={18} />
              Add grave record
            </Button>
          </>
        }
      />

      <div className="grid grid-4 gap-md">
        <KpiCard
          loading={loading}
          title="Plot occupancy"
          value={stats?.plots?.occupancyRate != null ? `${stats.plots.occupancyRate}%` : "—"}
          comparison={stats ? `${stats.plots?.occupied || 0} occupied / ${stats.plots?.available || 0} available` : ""}
          icon={MapPin}
          iconVariant="accent"
          href="/dashboard/plots"
        />
        <KpiCard
          loading={loading}
          title="Open requests"
          value={stats?.requests?.pending ?? pendingRequests.length}
          comparison={oldestPending ? `Oldest pending: ${timeAgo(oldestPending.createdAt)}` : "No pending requests"}
          icon={ClipboardList}
          iconVariant="warning"
          href="/dashboard/requests"
        />
        <KpiCard
          loading={loading}
          title="Verification backlog"
          value={incomplete.length}
          comparison={`${unpinnedPlots.length} plot${unpinnedPlots.length === 1 ? "" : "s"} missing GPS`}
          icon={Archive}
          iconVariant="danger"
          href="/dashboard/verification"
        />
        <KpiCard
          loading={loading}
          title="Service signal"
          value={stats?.feedback?.averageRating ? `${stats.feedback.averageRating} / 5` : "—"}
          comparison={stats ? `${stats.feedback?.totalCount || 0} responses` : ""}
          icon={MessageSquare}
          iconVariant="primary"
          href="/dashboard/feedback"
        />
      </div>

      <div className="grid grid-2 mt-lg gap-lg" style={{ gridTemplateColumns: "7fr 5fr" }}>
        <div className="flex flex-col gap-sm">
          <div>
            <h3 className="text-lg font-bold" style={{ marginBottom: "2px" }}>Occupancy by location</h3>
            <p className="text-sm text-muted">Current capacity status across cemetery sections.</p>
          </div>
          <Panel className="flex items-center justify-center flex-1" style={{ minHeight: "350px", height: "100%" }}>
            {loading ? (
              <Skeleton style={{ height: "100%", width: "100%" }} />
            ) : occupancyData.length === 0 ? (
              <p className="text-sm text-muted">No plot data available yet.</p>
            ) : (
              <OccupancyChart data={occupancyData} />
            )}
          </Panel>
        </div>

        <div className="flex flex-col gap-sm">
          <div>
            <h3 className="text-lg font-bold" style={{ marginBottom: "2px" }}>Operational queue</h3>
            <p className="text-sm text-muted">Oldest pending requests and verification blockers.</p>
          </div>
          <div className="table-container flex-1 flex flex-col justify-between" style={{ minHeight: "350px", height: "100%" }}>
            {loading ? (
              <div className="flex flex-col p-4 gap-sm">
                <Skeleton style={{ height: "40px", width: "100%" }} />
                <Skeleton style={{ height: "40px", width: "100%" }} />
                <Skeleton style={{ height: "40px", width: "100%" }} />
              </div>
            ) : queue.length === 0 ? (
              <div className="flex items-center justify-center flex-1" style={{ padding: "2rem" }}>
                <p className="text-sm text-muted">Nothing needs attention right now.</p>
              </div>
            ) : (
              <>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Task</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {queue.map((item) => (
                      <tr key={item.key}>
                        <td><div style={{ fontWeight: 600 }}>{item.label}</div></td>
                        <td>
                          <span
                            className="text-xs"
                            style={{ color: item.tone === "muted" ? "var(--text-muted)" : `var(--${item.tone})` }}
                          >
                            {item.status}
                          </span>
                        </td>
                        <td>
                          <div className="action-buttons justify-center">
                            <Link className="action-btn" href={item.href} title="Review" aria-label={`Review ${item.label}`}>
                              <Eye size={16} />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ padding: "12px", borderTop: "1px solid var(--border-default)" }}>
                  <Button variant="link" href="/dashboard/requests" style={{ justifyContent: "center", width: "100%" }}>
                    View all requests
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-sm" style={{ gridColumn: "1 / -1" }}>
          <div>
            <h3 className="text-lg font-bold" style={{ marginBottom: "2px" }}>Request trend and throughput</h3>
            <p className="text-sm text-muted">30-day volume of received vs completed requests.</p>
          </div>
          <Panel className="flex items-center justify-center" style={{ height: "300px" }}>
            {loading ? (
              <Skeleton style={{ height: "100%", width: "100%" }} />
            ) : (
              <RequestTrendChart data={trendData} />
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}

function formatType(type) {
  if (!type) return "Request";
  return String(type).replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
