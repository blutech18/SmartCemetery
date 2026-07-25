"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, Map, ClipboardList, Bell, MessageSquare, ArrowRight } from "lucide-react";
import { PageHeader } from "./PageHeader";
import { KpiCard } from "./KpiCard";
import { Button } from "../ui/Button";
import { Panel } from "../ui/Panel";
import { Badge } from "../ui/Badge";
import { Skeleton } from "../ui/Skeleton";
import { timeAgo } from "../../lib/dashboard-metrics";

const STATUS_VARIANT = { approved: "success", rejected: "danger", pending: "warning" };

/**
 * Client (visitor) dashboard — covers the manuscript visitor use cases:
 * search a grave, view the map guide, submit and track requests, give feedback.
 * All data shown is scoped to the signed-in user by the API.
 */
export function ClientDashboard({ userName }) {
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

    Promise.all([load("/api/requests"), load("/api/notifications")])
      .then(([requestData, notificationData]) => {
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

  const pending = requests.filter((r) => r.status === "pending").length;
  const unread = notifications.filter((n) => !n.readAt).length;

  return (
    <>
      <PageHeader
        title={`Welcome, ${userName || "Visitor"}`}
        description="Search burial records, get directions, and track your requests."
        actions={
          <>
            <Button variant="secondary" href="/dashboard/map">Open map</Button>
            <Button variant="secondary" href="/dashboard/search">
              <Search size={18} />
              Search graves
            </Button>
          </>
        }
      />

      <div className="grid grid-4 gap-md">
        <KpiCard
          loading={loading}
          title="My requests"
          value={requests.length}
          comparison={`${pending} awaiting decision`}
          icon={ClipboardList}
          iconVariant="primary"
          href="/dashboard/requests"
        />
        <KpiCard
          loading={loading}
          title="Unread updates"
          value={unread}
          comparison={`${notifications.length} total notifications`}
          icon={Bell}
          iconVariant="warning"
          href="/dashboard/notifications"
        />
        <KpiCard
          loading={false}
          title="Find a grave"
          value="Search"
          comparison="By name, grave ID, or year"
          icon={Search}
          iconVariant="accent"
          href="/dashboard/search"
        />
        <KpiCard
          loading={false}
          title="Share feedback"
          value="Rate us"
          comparison="Help improve the service"
          icon={MessageSquare}
          iconVariant="danger"
          href="/dashboard/feedback"
        />
      </div>

      <div className="grid grid-2 mt-lg gap-lg" style={{ gridTemplateColumns: "7fr 5fr" }}>
        {/* My requests with reference IDs */}
        <div className="flex flex-col gap-sm">
          <div>
            <h3 className="text-lg font-bold" style={{ marginBottom: "2px" }}>My recent requests</h3>
            <p className="text-sm text-muted">Track status using your reference ID.</p>
          </div>
          <div className="table-container flex-1 flex flex-col justify-between" style={{ minHeight: "300px" }}>
            {loading ? (
              <div className="flex flex-col p-4 gap-sm">
                <Skeleton style={{ height: "40px", width: "100%" }} />
                <Skeleton style={{ height: "40px", width: "100%" }} />
              </div>
            ) : requests.length === 0 ? (
              <div className="flex flex-col items-center justify-center flex-1" style={{ padding: "2.5rem", textAlign: "center" }}>
                <ClipboardList size={32} style={{ color: "var(--text-muted)", opacity: 0.5, marginBottom: "0.75rem" }} />
                <p className="text-sm text-muted" style={{ marginBottom: "1rem" }}>
                  You have not submitted any requests yet.
                </p>
                <Button variant="secondary" href="/dashboard/requests">Submit a request</Button>
              </div>
            ) : (
              <>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Reference</th>
                      <th>Type</th>
                      <th>Status</th>
                      <th>Submitted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requests.slice(0, 6).map((request) => (
                      <tr key={request.id}>
                        <td>
                          <span style={{ fontWeight: 600, fontFamily: "var(--font-mono)" }}>
                            {request.referenceId || `#${request.id}`}
                          </span>
                        </td>
                        <td>{formatType(request.type)}</td>
                        <td>
                          <Badge variant={STATUS_VARIANT[request.status] || "muted"}>
                            {request.status}
                          </Badge>
                        </td>
                        <td className="text-xs text-muted">{timeAgo(request.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ padding: "12px", borderTop: "1px solid var(--border-default)" }}>
                  <Button variant="link" href="/dashboard/requests" style={{ justifyContent: "center", width: "100%" }}>
                    View all my requests
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Quick actions + notifications */}
        <div className="flex flex-col gap-lg">
          <div className="flex flex-col gap-sm">
            <div>
              <h3 className="text-lg font-bold" style={{ marginBottom: "2px" }}>Quick actions</h3>
              <p className="text-sm text-muted">Common visitor tasks.</p>
            </div>
            <Panel style={{ padding: 0, overflow: "hidden" }}>
              {[
                { href: "/dashboard/search", icon: Search, label: "Search burial records", hint: "Find by name or grave ID" },
                { href: "/dashboard/map", icon: Map, label: "View map and directions", hint: "Navigate to a grave" },
                { href: "/dashboard/requests", icon: ClipboardList, label: "Submit a request", hint: "Reservation or record update" },
                { href: "/dashboard/feedback", icon: MessageSquare, label: "Provide feedback", hint: "Rate your experience" },
              ].map((action, index) => {
                const Icon = action.icon;
                return (
                  <Link
                    key={action.href}
                    href={action.href}
                    className="flex items-center gap-md"
                    style={{
                      padding: "0.9rem 1.1rem",
                      color: "var(--text-primary)",
                      textDecoration: "none",
                      borderTop: index === 0 ? "none" : "1px solid var(--border-default)",
                    }}
                  >
                    <Icon size={18} style={{ color: "var(--primary)", flexShrink: 0 }} />
                    <span style={{ flex: 1 }}>
                      <span className="text-sm" style={{ display: "block", fontWeight: 600 }}>{action.label}</span>
                      <span className="text-xs text-muted">{action.hint}</span>
                    </span>
                    <ArrowRight size={15} style={{ color: "var(--text-muted)" }} />
                  </Link>
                );
              })}
            </Panel>
          </div>

          <div className="flex flex-col gap-sm">
            <div>
              <h3 className="text-lg font-bold" style={{ marginBottom: "2px" }}>Latest updates</h3>
              <p className="text-sm text-muted">Outcomes and announcements.</p>
            </div>
            <Panel>
              {loading ? (
                <Skeleton style={{ height: "90px", width: "100%" }} />
              ) : notifications.length === 0 ? (
                <p className="text-sm text-muted">No updates yet. You will be notified here.</p>
              ) : (
                <div className="flex flex-col gap-md">
                  {notifications.slice(0, 3).map((n) => (
                    <div key={n.id}>
                      <div className="text-sm" style={{ fontWeight: 600 }}>{n.title || "Notification"}</div>
                      {n.message && <div className="text-xs text-muted">{n.message}</div>}
                      <div className="text-xs text-muted" style={{ marginTop: 2 }}>{timeAgo(n.createdAt)}</div>
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

function formatType(type) {
  if (!type) return "Request";
  return String(type).replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
