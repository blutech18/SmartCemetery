"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { MapPin, CheckCircle, Archive, Lock, Wrench, Plus, Edit2, Trash2, Crosshair } from "lucide-react";

export default function PlotsPage() {
  const [plots, setPlots] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");

  // Modal state — plot DATA only (number, section, status). GPS is pinned on the Map page.
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentPlot, setCurrentPlot] = useState({ id: null, plotNumber: "", locationDetailId: "", status: "available" });
  const [saving, setSaving] = useState(false);

  const fetchPlots = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "1000" });
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/plots?${params}`);
      const data = await res.json();
      setPlots(data.plots || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  const fetchLocations = useCallback(async () => {
    try {
      const res = await fetch("/api/locations");
      const data = await res.json();
      setLocations(data || []);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => Promise.all([fetchPlots(), fetchLocations()]));
  }, [fetchPlots, fetchLocations]);

  function handleOpenModal(plot = null) {
    if (plot) {
      setIsEditing(true);
      setCurrentPlot({
        id: plot.id,
        plotNumber: plot.plotNumber,
        locationDetailId: plot.locationDetailId,
        status: plot.status,
      });
    } else {
      setIsEditing(false);
      setCurrentPlot({ id: null, plotNumber: "", locationDetailId: "", status: "available" });
    }
    setIsModalOpen(true);
  }

  async function handleSavePlot(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const url = isEditing ? `/api/plots/${currentPlot.id}` : "/api/plots";
      const method = isEditing ? "PUT" : "POST";
      // GPS is intentionally NOT sent here — it is pinned on the Map page.
      // Omitting gpsLat/gpsLng on edit leaves any existing coordinates intact.
      const payload = {
        plotNumber: currentPlot.plotNumber,
        locationDetailId: parseInt(currentPlot.locationDetailId),
      };
      if (isEditing) payload.status = currentPlot.status;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setIsModalOpen(false);
        fetchPlots();
      } else if (res.status === 409) {
        alert("Plot numbers must be unique per section.");
      } else if (res.status === 401 || res.status === 403) {
        alert("You don't have permission to manage plots.");
      } else {
        alert("Failed to save plot.");
      }
    } catch (err) {
      console.error(err);
      alert("An error occurred");
    }
    setSaving(false);
  }

  async function handleDeletePlot(id) {
    if (!confirm("Are you sure you want to delete this plot?")) return;
    try {
      const res = await fetch(`/api/plots/${id}`, { method: "DELETE" });
      if (res.ok) fetchPlots();
      else alert("Failed to delete the plot. It may have grave records attached.");
    } catch (err) {
      console.error(err);
    }
  }

  const statusCounts = {
    available: plots.filter((p) => p.status === "available").length,
    occupied: plots.filter((p) => p.status === "occupied").length,
    reserved: plots.filter((p) => p.status === "reserved").length,
    maintenance: plots.filter((p) => p.status === "maintenance").length,
  };

  const unpinnedCount = plots.filter((p) => p.gpsLat == null || p.gpsLng == null).length;

  return (
    <div>
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--space-md)", flexWrap: "wrap" }}>
        <div>
          <h1 className="page-title">Plot Management</h1>
          <p className="page-subtitle">Manage plot details here — pin each plot&apos;s GPS location on the Map page</p>
        </div>
        <button className="btn btn-primary" onClick={() => handleOpenModal()}>
          <Plus size={18} /> Add Plot
        </button>
      </div>

      {unpinnedCount > 0 && (
        <div className="alert alert-info flex items-center gap-sm" style={{ marginBottom: "var(--space-md)" }}>
          <Crosshair size={16} />
          <span className="text-sm">
            {unpinnedCount} plot{unpinnedCount > 1 ? "s have" : " has"} no GPS location yet.
          </span>
          <Link href="/dashboard/map" className="text-sm" style={{ marginLeft: "auto", color: "var(--primary)" }}>
            Pin locations on the map →
          </Link>
        </div>
      )}

      {/* Status Overview */}
      <div className="grid grid-4" style={{ marginBottom: "var(--space-xl)" }}>
        {[
          { label: "Available", count: statusCounts.available, icon: <CheckCircle size={24} /> },
          { label: "Occupied", count: statusCounts.occupied, icon: <Archive size={24} /> },
          { label: "Reserved", count: statusCounts.reserved, icon: <Lock size={24} /> },
          { label: "Maintenance", count: statusCounts.maintenance, icon: <Wrench size={24} /> },
        ].map((s) => (
          <button
            key={s.label}
            className="stat-card"
            onClick={() => setStatusFilter(statusFilter === s.label.toLowerCase() ? "" : s.label.toLowerCase())}
            style={{
              cursor: "pointer",
              textAlign: "left",
              border: statusFilter === s.label.toLowerCase() ? "1px solid var(--primary)" : undefined,
            }}
          >
            <div style={{ fontSize: "1.5rem", marginBottom: 4 }}>{s.icon}</div>
            <div className="stat-value">{s.count}</div>
            <div className="stat-label">{s.label} Plots</div>
          </button>
        ))}
      </div>

      {/* Plots Table */}
      {loading ? (
        <div className="flex justify-center" style={{ padding: "var(--space-3xl)" }}>
          <div className="spinner spinner-lg" />
        </div>
      ) : plots.length > 0 ? (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Plot Number</th>
                <th>Location</th>
                <th>Section</th>
                <th>Status</th>
                <th>Occupant</th>
                <th>GPS</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {plots.map((plot) => {
                const pinned = plot.gpsLat != null && plot.gpsLng != null;
                return (
                  <tr key={plot.id}>
                    <td style={{ fontWeight: 600 }}>{plot.plotNumber}</td>
                    <td>{plot.locationDetail?.location?.name || "—"}</td>
                    <td>{plot.locationDetail?.subsection || "—"}</td>
                    <td>
                      <span
                        className={`badge ${
                          plot.status === "available" ? "badge-success"
                            : plot.status === "occupied" ? "badge-danger"
                            : plot.status === "reserved" ? "badge-warning"
                            : "badge-info"
                        }`}
                      >
                        {plot.status}
                      </span>
                    </td>
                    <td className="text-sm">
                      {plot.graves?.length > 0 ? plot.graves.map((g) => g.deceasedName).join(", ") : "—"}
                    </td>
                    <td className="text-xs">
                      {pinned ? (
                        <Link
                          href={`/dashboard/map?plot=${plot.id}`}
                          className="text-muted"
                          title="Adjust location on map"
                          style={{ fontFamily: "var(--font-mono)" }}
                        >
                          {Number(plot.gpsLat).toFixed(6)}, {Number(plot.gpsLng).toFixed(6)}
                        </Link>
                      ) : (
                        <Link
                          href={`/dashboard/map?plot=${plot.id}`}
                          className="inline-flex items-center gap-xs"
                          style={{ color: "var(--primary)" }}
                          title="Set location on map"
                        >
                          <Crosshair size={13} /> Set on map
                        </Link>
                      )}
                    </td>
                    <td>
                      <button className="btn btn-ghost btn-sm" onClick={() => handleOpenModal(plot)} style={{ padding: "0.25rem" }} title="Edit details">
                        <Edit2 size={16} />
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => handleDeletePlot(plot.id)} style={{ padding: "0.25rem", color: "var(--danger)" }} title="Delete">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-state-icon">
            <MapPin size={48} />
          </div>
          <h3 className="empty-state-title">No Plots Found</h3>
          <p className="empty-state-text">
            {statusFilter ? `No ${statusFilter} plots. Try removing the filter.` : "Add locations and plots to get started."}
          </p>
        </div>
      )}

      {/* Modal Overlay — plot DATA only */}
      {isModalOpen && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: "rgba(0,0,0,0.5)", zIndex: 1000,
          display: "flex", justifyContent: "center", alignItems: "center",
        }}>
          <div className="modal">
            <div className="flex justify-between items-center" style={{ marginBottom: "var(--space-lg)" }}>
              <h2>{isEditing ? "Edit Plot" : "Add Plot"}</h2>
              <button className="modal-close" onClick={() => setIsModalOpen(false)}>✕</button>
            </div>

            <form onSubmit={handleSavePlot} className="flex flex-col gap-md">
              <div className="form-group">
                <label className="form-label">Location / Section</label>
                <select
                  className="form-select"
                  value={currentPlot.locationDetailId}
                  onChange={(e) => setCurrentPlot({ ...currentPlot, locationDetailId: e.target.value })}
                  required
                >
                  <option value="">Select a section...</option>
                  {locations.map((loc) => (
                    <optgroup key={loc.id} label={loc.name}>
                      {loc.details?.map((det) => (
                        <option key={det.id} value={det.id}>
                          {det.subsection} (Capacity: {det.capacity})
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Plot Number</label>
                <input
                  type="text"
                  className="form-input"
                  value={currentPlot.plotNumber}
                  onChange={(e) => setCurrentPlot({ ...currentPlot, plotNumber: e.target.value })}
                  placeholder="e.g. A1-001"
                  required
                />
              </div>

              {isEditing && (
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select
                    className="form-select"
                    value={currentPlot.status}
                    onChange={(e) => setCurrentPlot({ ...currentPlot, status: e.target.value })}
                  >
                    <option value="available">Available</option>
                    <option value="occupied">Occupied</option>
                    <option value="reserved">Reserved</option>
                    <option value="maintenance">Maintenance</option>
                  </select>
                </div>
              )}

              <div className="alert alert-info flex items-center gap-xs" style={{ marginTop: "var(--space-xs)" }}>
                <Crosshair size={15} />
                <span className="text-sm">
                  {isEditing
                    ? "GPS location is managed on the Map page."
                    : "After saving, pin this plot's GPS location on the Map page."}
                </span>
              </div>

              <div className="flex gap-sm" style={{ marginTop: "var(--space-md)" }}>
                <button type="button" className="btn btn-ghost" style={{ flex: 1, justifyContent: "center" }} onClick={() => setIsModalOpen(false)} disabled={saving}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1, justifyContent: "center" }} disabled={saving}>
                  {saving ? "Saving..." : isEditing ? "Save Changes" : "Create Plot"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
