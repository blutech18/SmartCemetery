"use client";

import { useState, useEffect } from "react";
import { Archive, MapPin, Map, Users, BarChart3, ClipboardList, MessageSquare, Star } from "lucide-react";

export default function ReportsPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/reports/stats")
      .then((res) => res.json())
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="animate-fade-in">
        <div className="page-header">
          <h1 className="page-title">Reports & Analytics</h1>
        </div>
        <div className="flex justify-center" style={{ padding: "var(--space-3xl)" }}>
          <div className="spinner spinner-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Reports & Analytics</h1>
          <p className="page-subtitle">Cemetery statistics and usage overview</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-4" style={{ marginBottom: "var(--space-xl)" }}>
        <div className="stat-card">
          <div className="stat-icon stat-icon-primary"><Archive size={24} /></div>
          <div className="stat-value">{stats?.graves?.total || 0}</div>
          <div className="stat-label">Total Graves</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon stat-icon-accent"><MapPin size={24} /></div>
          <div className="stat-value">{stats?.plots?.total || 0}</div>
          <div className="stat-label">Total Plots</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon stat-icon-warning"><Map size={24} /></div>
          <div className="stat-value">{stats?.locations || 0}</div>
          <div className="stat-label">Locations</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon stat-icon-danger"><Users size={24} /></div>
          <div className="stat-value">{stats?.users || 0}</div>
          <div className="stat-label">System Users</div>
        </div>
      </div>

      {/* Detailed Reports */}
      <div className="grid grid-2">
        {/* Grave Status */}
        <div className="card">
          <h3 style={{ marginBottom: "var(--space-md)", display: "flex", alignItems: "center", gap: "8px" }}>
            <BarChart3 size={20} /> Grave Status Breakdown
          </h3>
          <div className="flex flex-col gap-md">
            <div className="flex justify-between items-center">
              <span>Active Records</span>
              <div className="flex items-center gap-sm">
                <div className="progress-bar" style={{ width: 150 }}>
                  <div
                    className="progress-fill"
                    style={{
                      width: stats?.graves?.total > 0
                        ? `${(stats.graves.active / stats.graves.total) * 100}%`
                        : "0%",
                      background: "var(--success)",
                    }}
                  />
                </div>
                <span className="badge badge-success">{stats?.graves?.active || 0}</span>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span>Archived Records</span>
              <div className="flex items-center gap-sm">
                <div className="progress-bar" style={{ width: 150 }}>
                  <div
                    className="progress-fill"
                    style={{
                      width: stats?.graves?.total > 0
                        ? `${(stats.graves.archived / stats.graves.total) * 100}%`
                        : "0%",
                      background: "var(--text-muted)",
                    }}
                  />
                </div>
                <span className="badge badge-muted">{stats?.graves?.archived || 0}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Plot Utilization */}
        <div className="card">
          <h3 style={{ marginBottom: "var(--space-md)", display: "flex", alignItems: "center", gap: "8px" }}>
            <MapPin size={20} /> Plot Utilization
          </h3>
          <div className="flex flex-col gap-md">
            {[
              { label: "Available", value: stats?.plots?.available || 0, cls: "badge-success" },
              { label: "Occupied", value: stats?.plots?.occupied || 0, cls: "badge-danger" },
              { label: "Reserved", value: stats?.plots?.reserved || 0, cls: "badge-warning" },
            ].map((item) => (
              <div key={item.label} className="flex justify-between items-center">
                <span>{item.label}</span>
                <div className="flex items-center gap-sm">
                  <div className="progress-bar" style={{ width: 150 }}>
                    <div
                      className="progress-fill"
                      style={{
                        width: stats?.plots?.total > 0
                          ? `${(item.value / stats.plots.total) * 100}%`
                          : "0%",
                      }}
                    />
                  </div>
                  <span className={`badge ${item.cls}`}>{item.value}</span>
                </div>
              </div>
            ))}
            <div
              style={{
                marginTop: 8,
                padding: "12px",
                background: "var(--bg-elevated)",
                borderRadius: "var(--radius-md)",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: "2rem", fontWeight: 800 }}>
                {stats?.plots?.occupancyRate || 0}%
              </div>
              <div className="text-sm text-muted">Overall Occupancy Rate</div>
            </div>
          </div>
        </div>

        {/* Request Summary */}
        <div className="card">
          <h3 style={{ marginBottom: "var(--space-md)", display: "flex", alignItems: "center", gap: "8px" }}>
            <ClipboardList size={20} /> Request Summary
          </h3>
          <div className="flex items-center gap-lg">
            <div className="text-center" style={{ flex: 1 }}>
              <div style={{ fontSize: "2rem", fontWeight: 800, color: "var(--warning)" }}>
                {stats?.requests?.pending || 0}
              </div>
              <div className="text-sm text-muted">Pending</div>
            </div>
          </div>
        </div>

        {/* Feedback Summary */}
        <div className="card">
          <h3 style={{ marginBottom: "var(--space-md)", display: "flex", alignItems: "center", gap: "8px" }}>
            <MessageSquare size={20} /> Feedback Summary
          </h3>
          <div className="text-center">
            <div style={{ fontSize: "2.5rem", fontWeight: 800 }}>
              {stats?.feedback?.averageRating || "—"}
              <span className="text-sm text-muted"> / 5</span>
            </div>
            <div style={{ fontSize: "1.3rem", color: "var(--warning)", margin: "4px 0", display: "flex", justifyContent: "center", gap: "2px" }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  size={20}
                  fill={i < Math.round(stats?.feedback?.averageRating || 0) ? "currentColor" : "transparent"}
                />
              ))}
            </div>
            <div className="text-sm text-muted">
              {stats?.feedback?.totalCount || 0} total responses
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
