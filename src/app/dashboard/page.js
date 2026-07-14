"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Archive, MapPin, ClipboardList, MessageSquare, Map, Box, BarChart3 } from "lucide-react";

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

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Welcome back, <span className="text-gradient">{session?.user?.name || "User"}</span>
          </h1>
          <p className="page-subtitle">
            {role === "Admin"
              ? "Manage cemetery records, monitor plots, and review requests."
              : role === "Staff"
              ? "Verify records, monitor plots, and assist visitors."
              : "Search graves, view maps, and track your requests."}
          </p>
        </div>
        {role === "Admin" && (
          <Link href="/dashboard/graves" className="btn btn-primary">
            + Add Grave Record
          </Link>
        )}
      </div>

      {/* Stats Grid */}
      {loading ? (
        <div className="grid grid-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="stat-card">
              <div className="skeleton" style={{ width: 48, height: 48, marginBottom: 12 }} />
              <div className="skeleton" style={{ width: 80, height: 32, marginBottom: 8 }} />
              <div className="skeleton" style={{ width: 120, height: 16 }} />
            </div>
          ))}
        </div>
      ) : stats ? (
        <>
          <div className="grid grid-4">
            <div className="stat-card">
              <div className="stat-icon stat-icon-primary"><Archive size={24} /></div>
              <div className="stat-value">{stats.graves?.total || 0}</div>
              <div className="stat-label">Total Grave Records</div>
              <div style={{ marginTop: 8 }}>
                <span className="badge badge-success" style={{ marginRight: 4 }}>
                  {stats.graves?.active || 0} active
                </span>
                <span className="badge badge-muted">
                  {stats.graves?.archived || 0} archived
                </span>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon stat-icon-accent"><MapPin size={24} /></div>
              <div className="stat-value">{stats.plots?.total || 0}</div>
              <div className="stat-label">Total Plots</div>
              <div style={{ marginTop: 8 }}>
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${stats.plots?.occupancyRate || 0}%` }}
                  />
                </div>
                <div className="text-xs text-muted" style={{ marginTop: 4 }}>
                  {stats.plots?.occupancyRate || 0}% occupied · {stats.plots?.available || 0} available
                </div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon stat-icon-warning"><ClipboardList size={24} /></div>
              <div className="stat-value">{stats.requests?.pending || 0}</div>
              <div className="stat-label">Pending Requests</div>
              {(stats.requests?.pending || 0) > 0 && (
                <Link
                  href="/dashboard/requests"
                  className="text-sm"
                  style={{ marginTop: 8, display: "inline-block" }}
                >
                  Review now →
                </Link>
              )}
            </div>

            <div className="stat-card">
              <div className="stat-icon stat-icon-danger"><MessageSquare size={24} /></div>
              <div className="stat-value">
                {stats.feedback?.averageRating || "—"}
                <span className="text-sm text-muted"> / 5</span>
              </div>
              <div className="stat-label">Avg. Feedback Rating</div>
              <div className="text-xs text-muted" style={{ marginTop: 4 }}>
                {stats.feedback?.totalCount || 0} total responses
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div style={{ marginTop: "var(--space-xl)" }}>
            <h3 style={{ marginBottom: "var(--space-md)" }}>Quick Actions</h3>
            <div className="grid grid-3">
              <Link href="/dashboard/graves" className="card" style={{ textDecoration: "none" }}>
                <div style={{ marginBottom: 8 }}><Archive size={32} color="var(--primary)" /></div>
                <h4>Grave Records</h4>
                <p className="text-sm text-muted">
                  Search, add, or update burial records
                </p>
              </Link>

              <Link href="/dashboard/map" className="card" style={{ textDecoration: "none" }}>
                <div style={{ marginBottom: 8 }}><Map size={32} color="var(--accent)" /></div>
                <h4>Cemetery Map</h4>
                <p className="text-sm text-muted">
                  Interactive navigation with grave markers
                </p>
              </Link>

              <Link href="/dashboard/plots" className="card" style={{ textDecoration: "none" }}>
                <div style={{ marginBottom: 8 }}><MapPin size={32} color="var(--warning)" /></div>
                <h4>Plot Management</h4>
                <p className="text-sm text-muted">
                  View and manage burial plot availability
                </p>
              </Link>
            </div>
          </div>

          {/* Archival Notice */}
          {stats.graves?.newlyArchived > 0 && (
            <div className="alert alert-info" style={{ marginTop: "var(--space-lg)", display: "flex", alignItems: "center", gap: "8px" }}>
              <Box size={16} /> {stats.graves.newlyArchived} record(s) automatically archived
              (5-year rule applied).
            </div>
          )}
        </>
      ) : (
        <div className="empty-state">
          <div className="empty-state-icon"><BarChart3 size={48} /></div>
          <h3 className="empty-state-title">No Data Available</h3>
          <p className="empty-state-text">
            Connect your database and add records to see statistics here.
          </p>
        </div>
      )}
    </div>
  );
}
