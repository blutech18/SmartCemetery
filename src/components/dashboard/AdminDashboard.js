"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Archive,
  MapPin,
  ClipboardList,
  MessageSquare,
  Plus,
  ArrowRight,
  TrendingUp,
  Radio,
  FileDown,
  CheckCircle2,
  Compass,
} from "lucide-react";
import { PageHeader } from "./PageHeader";
import { KpiCard } from "./KpiCard";
import { Button } from "../ui/Button";
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
        const plotList = Array.isArray(plotData) ? plotData : (plotData?.plots || []);
        if (Array.isArray(plotList)) setPlots(plotList);
        const reqList = Array.isArray(requestData) ? requestData : (requestData?.requests || []);
        if (Array.isArray(reqList)) setRequests(reqList);
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
      type: "request",
      label: `${formatType(request.type)} · ${request.referenceId || `#${request.id}`}`,
      status: `Pending ${timeAgo(request.createdAt)}`,
      tone: "warning",
      href: "/dashboard/requests",
    })),
    ...(unpinnedPlots.length > 0
      ? [{
          key: "gps-blocker",
          type: "gps",
          label: "Missing GPS coordinates",
          status: `${unpinnedPlots.length} plot${unpinnedPlots.length === 1 ? "" : "s"} unpinned`,
          tone: "danger",
          href: "/dashboard/map",
        }]
      : []),
    ...(incomplete.length > 0
      ? [{
          key: "verification-backlog",
          type: "verification",
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
        title={
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <span>Cemetery Operations</span>
            <span
              className="badge badge-success"
              style={{
                textTransform: "none",
                fontSize: "0.72rem",
                padding: "0.15rem 0.55rem",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.35rem",
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "#10b981",
                  display: "inline-block",
                }}
              />
              Live
            </span>
          </div>
        }
        actions={
          <>
            <Button variant="secondary" href="/dashboard/map?locate=bolonsiri">
              <Compass size={15} />
              Locate Bolonsiri
            </Button>
            <Button variant="secondary" href="/dashboard/broadcasts">
              <Radio size={15} />
              Broadcast
            </Button>
            <Button variant="secondary" href="/dashboard/reports">
              <FileDown size={15} />
              Export
            </Button>
            <Button variant="primary" href="/dashboard/graves">
              <Plus size={16} />
              Add Record
            </Button>
          </>
        }
      />

      <div className="grid grid-4 gap-md">
        <KpiCard
          loading={loading}
          title="Plot Occupancy"
          value={stats?.plots?.occupancyRate != null ? `${stats.plots.occupancyRate}%` : "—"}
          comparison={
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div
                style={{
                  flex: 1,
                  height: "4px",
                  borderRadius: "2px",
                  background: "rgba(255, 255, 255, 0.08)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${stats?.plots?.occupancyRate || 0}%`,
                    height: "100%",
                    background: "var(--accent)",
                    borderRadius: "2px",
                    transition: "width 0.5s ease",
                  }}
                />
              </div>
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                {stats?.plots ? `${stats.plots.occupied || 0} / ${stats.plots.total || ((stats.plots.occupied || 0) + (stats.plots.available || 0))}` : "—"}
              </span>
            </div>
          }
          icon={MapPin}
          iconVariant="accent"
          href="/dashboard/plots"
        />
        <KpiCard
          loading={loading}
          title="Open Requests"
          value={stats?.requests?.pending ?? pendingRequests.length}
          comparison={
            oldestPending ? (
              <span className="badge badge-warning" style={{ textTransform: "none", fontSize: "0.72rem", padding: "0.15rem 0.5rem" }}>
                Oldest: {timeAgo(oldestPending.createdAt)}
              </span>
            ) : (
              <span className="badge badge-success" style={{ textTransform: "none", fontSize: "0.72rem", padding: "0.15rem 0.5rem" }}>
                All clear
              </span>
            )
          }
          icon={ClipboardList}
          iconVariant="warning"
          href="/dashboard/requests"
        />
        <KpiCard
          loading={loading}
          title="Verification Backlog"
          value={incomplete.length}
          comparison={
            incomplete.length === 0 && unpinnedPlots.length === 0 ? (
              <span className="badge badge-success" style={{ textTransform: "none", fontSize: "0.72rem", padding: "0.15rem 0.5rem", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                <CheckCircle2 size={11} /> All verified
              </span>
            ) : unpinnedPlots.length > 0 ? (
              <span className="badge badge-danger" style={{ textTransform: "none", fontSize: "0.72rem", padding: "0.15rem 0.5rem" }}>
                {unpinnedPlots.length} missing GPS
              </span>
            ) : (
              <span className="badge badge-warning" style={{ textTransform: "none", fontSize: "0.72rem", padding: "0.15rem 0.5rem" }}>
                {incomplete.length} pending review
              </span>
            )
          }
          icon={Archive}
          iconVariant="danger"
          href="/dashboard/verification"
        />
        <KpiCard
          loading={loading}
          title="Service Signal"
          value={
            stats?.feedback?.averageRating ? (
              <span style={{ display: "inline-flex", alignItems: "baseline", gap: "4px" }}>
                {stats.feedback.averageRating}
                <span style={{ fontSize: "1rem", fontWeight: 500, color: "var(--text-muted)" }}>/ 5</span>
              </span>
            ) : "—"
          }
          comparison={
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
              {stats?.feedback?.totalCount || 0} reviews
            </span>
          }
          icon={MessageSquare}
          iconVariant="primary"
          href="/dashboard/feedback"
        />
      </div>

      <div className="grid grid-2 mt-lg gap-lg" style={{ gridTemplateColumns: "7fr 5fr" }}>
        {/* Left: Occupancy by Section */}
        <div className="staff-card flex flex-col" style={{ minHeight: "380px" }}>
          <div className="staff-card-header">
            <div className="staff-card-title-group">
              <div className="staff-card-icon-badge accent">
                <MapPin size={22} />
              </div>
              <div className="staff-card-title">Occupancy by Section</div>
            </div>
            <Link
              href="/dashboard/plots"
              className="btn btn-secondary btn-sm"
              style={{ padding: "0.3rem 0.65rem", fontSize: "0.78rem", gap: "4px" }}
            >
              <span>Manage plots</span>
              <ArrowRight size={13} />
            </Link>
          </div>
          <div className="staff-card-body flex-1 flex items-center justify-center" style={{ minHeight: "320px", padding: "1rem" }}>
            {loading ? (
              <Skeleton style={{ height: "100%", width: "100%" }} />
            ) : occupancyData.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center" style={{ height: "100%" }}>
                <MapPin size={28} style={{ color: "var(--text-muted)", marginBottom: "8px", opacity: 0.4 }} />
                <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>No plot records found</span>
              </div>
            ) : (
              <OccupancyChart data={occupancyData} />
            )}
          </div>
        </div>

        {/* Right: Operational Queue */}
        <div className="staff-card flex flex-col" style={{ minHeight: "380px" }}>
          <div className="staff-card-header">
            <div className="staff-card-title-group">
              <div className="staff-card-icon-badge warning">
                <ClipboardList size={22} />
              </div>
              <div className="staff-card-title">Operational Queue</div>
              {queue.length > 0 && (
                <span className="badge badge-warning text-xs" style={{ padding: "0.15rem 0.45rem", fontSize: "0.7rem" }}>
                  {queue.length}
                </span>
              )}
            </div>
            <Link
              href="/dashboard/requests"
              className="btn btn-secondary btn-sm"
              style={{ padding: "0.3rem 0.65rem", fontSize: "0.78rem", gap: "4px" }}
            >
              <span>All requests</span>
              <ArrowRight size={13} />
            </Link>
          </div>

          <div className="staff-card-body flex-1 flex flex-col justify-between" style={{ padding: 0 }}>
            {loading ? (
              <div className="flex flex-col p-4 gap-sm">
                <Skeleton style={{ height: "48px", width: "100%" }} />
                <Skeleton style={{ height: "48px", width: "100%" }} />
                <Skeleton style={{ height: "48px", width: "100%" }} />
              </div>
            ) : queue.length === 0 ? (
              <div style={{ padding: "3rem 1.5rem", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, textAlign: "center" }}>
                <div style={{ color: "#10b981", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "0.75rem" }}>
                  <CheckCircle2 size={28} />
                </div>
                <div style={{ fontWeight: 600, fontSize: "0.95rem", color: "var(--text-primary)", marginBottom: "0.25rem" }}>
                  Queue is clear
                </div>
                <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                  No pending requests or blockers needing attention.
                </div>
              </div>
            ) : (
              <div className="flex flex-col">
                {queue.map((item, idx) => (
                  <div
                    key={item.key}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "0.85rem 1.25rem",
                      borderBottom: idx < queue.length - 1 ? "1px solid var(--border-default)" : "none",
                      gap: "1rem",
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: "0.875rem", color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {item.label}
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                        {item.status}
                      </div>
                    </div>
                    <Link
                      href={item.href}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        fontSize: "0.825rem",
                        fontWeight: 500,
                        color: "var(--primary-light)",
                        textDecoration: "none",
                        flexShrink: 0,
                      }}
                    >
                      Review
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Bottom: Request Activity */}
        <div className="staff-card flex flex-col" style={{ gridColumn: "1 / -1" }}>
          <div className="staff-card-header">
            <div className="staff-card-title-group">
              <div className="staff-card-icon-badge primary">
                <TrendingUp size={22} />
              </div>
              <div className="staff-card-title">Request Activity & Throughput</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#3B82F6", display: "inline-block" }} />
                <span>Received</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#10B981", display: "inline-block" }} />
                <span>Completed</span>
              </div>
              <span className="badge text-xs" style={{ background: "var(--bg-hover)", color: "var(--text-muted)", border: "1px solid var(--border-default)", padding: "0.2rem 0.5rem" }}>
                Last 30 Days
              </span>
            </div>
          </div>
          <div className="staff-card-body flex items-center justify-center" style={{ height: "280px" }}>
            {loading ? (
              <Skeleton style={{ height: "100%", width: "100%" }} />
            ) : (
              <RequestTrendChart data={trendData} />
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function formatType(type) {
  if (!type) return "Request";
  return String(type).replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
