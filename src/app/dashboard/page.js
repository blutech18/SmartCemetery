"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { Archive, MapPin, ClipboardList, MessageSquare, Plus, Eye } from "lucide-react";
import { PageHeader } from "../../components/dashboard/PageHeader";
import { KpiCard } from "../../components/dashboard/KpiCard";
import { Button } from "../../components/ui/Button";
import { Panel } from "../../components/ui/Panel";
import { Skeleton } from "../../components/ui/Skeleton";
import { OccupancyChart } from "../../components/charts/OccupancyChart";
import { RequestTrendChart } from "../../components/charts/RequestTrendChart";

export default function DashboardPage() {
  const { data: session } = useSession();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/reports/stats")
      .then((res) => res.json())
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const role = session?.user?.role || "Client";

  if (role !== "Admin") {
    // For now, render standard fallback for other roles until their dashboards are built
    return (
      <>
        <PageHeader 
          title={`Welcome back, ${session?.user?.name || "User"}`}
          description={role === "Staff" ? "Verify records, monitor plots, and assist visitors." : "Search graves, view maps, and track your requests."}
        />
        <div className="empty-state mt-lg">
          <h3 className="empty-state-title">Dashboard under construction</h3>
          <p className="empty-state-text">Your role-specific dashboard is being upgraded to the new experience.</p>
        </div>
      </>
    );
  }

  // Admin Dashboard
  return (
    <>
      <PageHeader 
        title="Cemetery operations"
        description="Last updated today"
        actions={
          <>
            <Button variant="secondary" href="/dashboard/broadcasts">Create broadcast</Button>
            <Button variant="secondary" href="/dashboard/reports">Export report</Button>
            <Button variant="secondary" href="/dashboard/graves/new">
              <Plus size={18} />
              Add grave record
            </Button>
          </>
        }
      />

      {/* Admin Top KPI Row */}
      <div className="grid grid-4 gap-md">
        <KpiCard
          loading={loading}
          title="Plot occupancy"
          value={stats?.plots?.occupancyRate ? `${stats.plots.occupancyRate}%` : "—"}
          comparison={stats ? `${stats.plots?.occupied || 0} occupied / ${stats.plots?.available || 0} available` : ""}
          icon={MapPin}
          iconVariant="accent"
          href="/dashboard/plots"
        />
        <KpiCard
          loading={loading}
          title="Open requests"
          value={stats?.requests?.pending || 0}
          comparison={stats ? "Oldest pending: 2 days" : ""}
          icon={ClipboardList}
          iconVariant="warning"
          href="/dashboard/requests"
        />
        <KpiCard
          loading={loading}
          title="Verification backlog"
          value={stats?.graves?.incomplete || 0}
          comparison={stats ? `${stats.graves?.missingGps || 0} missing GPS` : ""}
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

      {/* Main Grid: charts and queues */}
      <div className="grid grid-2 mt-lg gap-lg" style={{ gridTemplateColumns: '7fr 5fr' }}>
        
        {/* Occupancy Chart */}
        <div className="flex flex-col gap-sm">
          <div>
            <h3 className="text-lg font-bold" style={{ marginBottom: "2px" }}>Occupancy by location</h3>
            <p className="text-sm text-muted">
              Current capacity status across cemetery sections.
            </p>
          </div>
          <Panel className="flex items-center justify-center flex-1" style={{ minHeight: "350px", height: '100%', animation: 'fadeUp 0.8s ease-out backwards' }}>
            {loading ? (
              <Skeleton style={{ height: "100%", width: "100%" }} />
            ) : (
              <OccupancyChart />
            )}
          </Panel>
        </div>

        {/* Prioritized Queue */}
        <div className="flex flex-col gap-sm">
          <div>
            <h3 className="text-lg font-bold" style={{ marginBottom: "2px" }}>Operational queue</h3>
            <p className="text-sm text-muted">
              Oldest pending requests and verification blockers.
            </p>
          </div>
          <div className="table-container flex-1 flex flex-col justify-between" style={{ minHeight: "350px", height: '100%', animation: 'fadeUp 0.8s ease-out 0.1s backwards' }}>
            {loading ? (
              <div className="flex flex-col p-4 gap-sm">
                <Skeleton style={{ height: "40px", width: "100%" }} />
                <Skeleton style={{ height: "40px", width: "100%" }} />
                <Skeleton style={{ height: "40px", width: "100%" }} />
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
                    <tr>
                      <td>
                        <div style={{ fontWeight: 600 }}>Burial Request #492</div>
                      </td>
                      <td>
                        <span className="text-xs text-muted">Pending for 2 days</span>
                      </td>
                      <td>
                        <div className="action-buttons justify-center">
                          <button className="action-btn" title="Review">
                            <Eye size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <div style={{ fontWeight: 600 }}>Missing GPS Coordinates</div>
                      </td>
                      <td>
                        <span className="text-xs" style={{ color: "var(--danger)" }}>Blocker in Section B</span>
                      </td>
                      <td>
                        <div className="action-buttons justify-center">
                          <button className="action-btn" title="Locate">
                            <MapPin size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <div style={{ fontWeight: 600 }}>Transfer of Rights Request</div>
                      </td>
                      <td>
                        <span className="text-xs text-muted">Pending for 1 day</span>
                      </td>
                      <td>
                        <div className="action-buttons justify-center">
                          <button className="action-btn" title="Review">
                            <Eye size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <div style={{ fontWeight: 600 }}>Maintenance Report #118</div>
                      </td>
                      <td>
                        <span className="text-xs text-muted">Pending for 4 hours</span>
                      </td>
                      <td>
                        <div className="action-buttons justify-center">
                          <button className="action-btn" title="Review">
                            <Eye size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <div style={{ fontWeight: 600 }}>New Grave Record #992</div>
                      </td>
                      <td>
                        <span className="text-xs" style={{ color: "var(--warning)" }}>Requires Approval</span>
                      </td>
                      <td>
                        <div className="action-buttons justify-center">
                          <button className="action-btn" title="Review">
                            <Eye size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
                <div style={{ padding: "12px", background: "rgba(255, 255, 255, 0.015)" }}>
                  <Button variant="link" className="w-full" style={{ justifyContent: 'center', height: 'auto', padding: '0.25rem' }}>View all items</Button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Request trend */}
        <div className="flex flex-col gap-sm" style={{ gridColumn: "1 / -1" }}>
          <div>
            <h3 className="text-lg font-bold" style={{ marginBottom: "2px" }}>Request trend and throughput</h3>
            <p className="text-sm text-muted">
              30-day volume of received vs completed requests.
            </p>
          </div>
          <Panel className="flex items-center justify-center" style={{ height: "300px", animation: 'fadeUp 0.8s ease-out 0.2s backwards' }}>
            {loading ? (
              <Skeleton style={{ height: "100%", width: "100%" }} />
            ) : (
              <RequestTrendChart />
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
