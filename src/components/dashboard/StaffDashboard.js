"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BadgeCheck, MapPin, ClipboardList, Bell, Archive, Eye } from "lucide-react";
import { PageHeader } from "./PageHeader";
import { KpiCard } from "./KpiCard";
import { Button } from "../ui/Button";
import { Panel } from "../ui/Panel";
import { Skeleton } from "../ui/Skeleton";
import { countPlotStatuses, timeAgo } from "../../lib/dashboard-metrics";

/**
 * Staff dashboard — verification-first workspace.
 * Surfaces only what Staff is authorized to act on: record verification,
 * plot status, assigned requests, and their own notifications.
 */
export function StaffDashboard({ userName }) {
  const [incomplete, setIncomplete] = useState([]);
  const [plots, setPlots] = useState([]);
  const [requests, setRequests] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    const load = async (url) => {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) return null;
      return res.json();
    };

    Promise.all([
      load("/api/graves/incomplete"),
      load("/api/plots"),
      load("/api/requests"),
      load("/api/notifications"),
    ])
      .then(([incompleteData, plotData, requestData, notificationData]) => {
        const rows = Array.isArray(incompleteData) ? incompleteData : incompleteData?.graves;
        if (Array.isArray(rows)) setIncomplete(rows);
        if (Array.isArray(plotData)) setPlots(plotData);
        if (Array.isArray(requestData)) setRequests(requestData);
        if (Array.isArray(notificationData)) setNotifications(notificationData);
      })
      .catch((error) => {
        if (error.name !== "AbortError") console.error(error);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, []);

  const plotCounts = countPlotStatuses(plots);
  const pendingRequests = requests.filter((r) => r.status === "pending");
  const unread = notifications.filter((n) => !n.readAt).length;
  const verificationQueue = incomplete.slice(0, 6);

  return (
    <>
      <PageHeader
        title={`Welcome back, ${userName || "Staff"}`}
        description="Verify records, monitor plot status, and assist visitors."
        actions={
          <>
            <Button variant="secondary" href="/dashboard/map">Open map</Button>
            <Button variant="secondary" href="/dashboard/verification">
              <BadgeCheck size={18} />
              Verify records
            </Button>
          </>
        }
      />

      <div className="grid grid-4 gap-md">
        <KpiCard
          loading={loading}
          title="Awaiting verification"
          value={incomplete.length}
          comparison={incomplete.length === 0 ? "Queue is clear" : "Records need review"}
          icon={BadgeCheck}
          iconVariant="danger"
          href="/dashboard/verification"
        />
        <KpiCard
          loading={loading}
          title="Available plots"
          value={plotCounts.available}
          comparison={`${plotCounts.occupied} occupied / ${plotCounts.reserved} reserved`}
          icon={MapPin}
          iconVariant="accent"
          href="/dashboard/plots"
        />
        <KpiCard
          loading={loading}
          title="Pending requests"
          value={pendingRequests.length}
          comparison="Awaiting admin decision"
          icon={ClipboardList}
          iconVariant="warning"
          href="/dashboard/requests"
        />
        <KpiCard
          loading={loading}
          title="Unread notifications"
          value={unread}
          comparison={`${notifications.length} total`}
          icon={Bell}
          iconVariant="primary"
          href="/dashboard/notifications"
        />
      </div>

      <div className="grid grid-2 mt-lg gap-lg" style={{ gridTemplateColumns: "7fr 5fr" }}>
        {/* Verification queue */}
        <div className="flex flex-col gap-sm">
          <div>
            <h3 className="text-lg font-bold" style={{ marginBottom: "2px" }}>Verification queue</h3>
            <p className="text-sm text-muted">Incomplete records assigned for staff review.</p>
          </div>
          <div className="table-container flex-1 flex flex-col justify-between" style={{ minHeight: "320px" }}>
            {loading ? (
              <div className="flex flex-col p-4 gap-sm">
                <Skeleton style={{ height: "40px", width: "100%" }} />
                <Skeleton style={{ height: "40px", width: "100%" }} />
                <Skeleton style={{ height: "40px", width: "100%" }} />
              </div>
            ) : verificationQueue.length === 0 ? (
              <div className="flex flex-col items-center justify-center flex-1" style={{ padding: "2.5rem", textAlign: "center" }}>
                <Archive size={32} style={{ color: "var(--text-muted)", opacity: 0.5, marginBottom: "0.75rem" }} />
                <p className="text-sm text-muted">All records are verified. Nothing in the queue.</p>
              </div>
            ) : (
              <>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Record</th>
                      <th>Missing</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {verificationQueue.map((grave) => (
                      <tr key={grave.id}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{grave.deceasedName || `Record #${grave.id}`}</div>
                          <div className="text-xs text-muted">
                            Plot {grave.plot?.plotNumber || "unassigned"}
                          </div>
                        </td>
                        <td>
                          <span className="text-xs" style={{ color: "var(--warning)" }}>
                            {describeGaps(grave)}
                          </span>
                        </td>
                        <td>
                          <div className="action-buttons justify-center">
                            <Link className="action-btn" href="/dashboard/verification" title="Review record" aria-label={`Review ${grave.deceasedName || grave.id}`}>
                              <Eye size={16} />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ padding: "12px", borderTop: "1px solid var(--border-default)" }}>
                  <Button variant="link" href="/dashboard/verification" style={{ justifyContent: "center", width: "100%" }}>
                    Open verification queue
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Plot status + shortcuts */}
        <div className="flex flex-col gap-lg">
          <div className="flex flex-col gap-sm">
            <div>
              <h3 className="text-lg font-bold" style={{ marginBottom: "2px" }}>Plot status</h3>
              <p className="text-sm text-muted">Current distribution across the cemetery.</p>
            </div>
            <Panel>
              {loading ? (
                <Skeleton style={{ height: "140px", width: "100%" }} />
              ) : (
                <div className="flex flex-col gap-sm">
                  {[
                    { label: "Available", value: plotCounts.available, color: "var(--success)" },
                    { label: "Occupied", value: plotCounts.occupied, color: "var(--primary)" },
                    { label: "Reserved", value: plotCounts.reserved, color: "var(--warning)" },
                    { label: "Maintenance", value: plotCounts.maintenance, color: "var(--text-muted)" },
                  ].map((row) => (
                    <div key={row.label} className="flex items-center justify-between">
                      <div className="flex items-center gap-sm">
                        <span style={{ width: 10, height: 10, borderRadius: "50%", background: row.color }} />
                        <span className="text-sm">{row.label}</span>
                      </div>
                      <strong className="text-sm">{row.value}</strong>
                    </div>
                  ))}
                  {plotCounts.unpinned > 0 && (
                    <p className="text-xs" style={{ color: "var(--warning)", marginTop: "0.5rem" }}>
                      {plotCounts.unpinned} plot{plotCounts.unpinned === 1 ? "" : "s"} not yet pinned on the map.
                    </p>
                  )}
                </div>
              )}
            </Panel>
          </div>

          <div className="flex flex-col gap-sm">
            <div>
              <h3 className="text-lg font-bold" style={{ marginBottom: "2px" }}>Recent notifications</h3>
              <p className="text-sm text-muted">Your latest updates.</p>
            </div>
            <Panel>
              {loading ? (
                <Skeleton style={{ height: "90px", width: "100%" }} />
              ) : notifications.length === 0 ? (
                <p className="text-sm text-muted">No notifications yet.</p>
              ) : (
                <div className="flex flex-col gap-sm">
                  {notifications.slice(0, 3).map((n) => (
                    <div key={n.id}>
                      <div className="text-sm" style={{ fontWeight: 600 }}>{n.title || "Notification"}</div>
                      <div className="text-xs text-muted">{timeAgo(n.createdAt)}</div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </div>
        </div>
      </div>
    </>
  );
}

function describeGaps(grave) {
  const gaps = [];
  if (!grave?.plot?.plotNumber) gaps.push("plot");
  if (grave?.plot && (grave.plot.gpsLat == null || grave.plot.gpsLng == null)) gaps.push("GPS");
  if (!grave?.burialDate) gaps.push("burial date");
  if (gaps.length === 0) return "Pending review";
  return gaps.join(", ");
}
