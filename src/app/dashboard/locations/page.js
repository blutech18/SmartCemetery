"use client";

import { useState, useEffect } from "react";
import { MapPin, Map, Navigation } from "lucide-react";

export default function LocationsPage() {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    gpsLat: "",
    gpsLng: "",
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchLocations();
  }, []);

  async function fetchLocations() {
    setLoading(true);
    try {
      const res = await fetch("/api/locations");
      const data = await res.json();
      setLocations(data || []);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          description: form.description || null,
          gpsLat: form.gpsLat ? parseFloat(form.gpsLat) : null,
          gpsLng: form.gpsLng ? parseFloat(form.gpsLng) : null,
        }),
      });

      if (res.ok) {
        setShowModal(false);
        setForm({ name: "", description: "", gpsLat: "", gpsLng: "" });
        fetchLocations();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to create location");
      }
    } catch {
      alert("An error occurred");
    }
    setSubmitting(false);
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Locations</h1>
          <p className="page-subtitle">Manage cemetery zones and sections</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)} id="add-location-btn">
          + Add Location
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center" style={{ padding: "var(--space-3xl)" }}>
          <div className="spinner spinner-lg" />
        </div>
      ) : locations.length > 0 ? (
        <div className="grid grid-2">
          {locations.map((loc) => {
            const totalPlots = loc.details?.reduce(
              (sum, d) => sum + (d.plots?.length || 0),
              0
            ) || 0;
            const availablePlots = loc.details?.reduce(
              (sum, d) => sum + (d.plots?.filter((p) => p.status === "available").length || 0),
              0
            ) || 0;

            return (
              <div key={loc.id} className="card">
                <div className="flex items-center gap-md" style={{ marginBottom: 12 }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: "var(--radius-md)",
                      background: "var(--primary-glow)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "1.3rem",
                    }}
                  >
                    <MapPin size={24} />
                  </div>
                  <div>
                    <h4 style={{ margin: 0 }}>{loc.name}</h4>
                    {loc.description && (
                      <p className="text-sm text-muted" style={{ margin: 0 }}>
                        {loc.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Subsections */}
                {loc.details?.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <div className="text-xs text-muted" style={{ marginBottom: 6, fontWeight: 600 }}>
                      SUBSECTIONS
                    </div>
                    <div className="flex gap-sm" style={{ flexWrap: "wrap" }}>
                      {loc.details.map((d) => (
                        <span key={d.id} className="badge badge-primary">
                          {d.subsection} ({d.plots?.length || 0} plots)
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-between items-center" style={{ marginTop: 12 }}>
                  <div className="text-sm">
                    <span style={{ fontWeight: 600 }}>{totalPlots}</span> total plots ·{" "}
                    <span style={{ color: "var(--success)" }}>{availablePlots}</span> available
                  </div>
                  {loc.gpsLat && loc.gpsLng && (
                    <div className="text-xs text-muted flex items-center gap-xs">
                      <Navigation size={12} /> {Number(loc.gpsLat).toFixed(4)}, {Number(loc.gpsLng).toFixed(4)}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-state-icon">
            <Map size={48} />
          </div>
          <h3 className="empty-state-title">No Locations</h3>
          <p className="empty-state-text">
            Add cemetery zones and sections to organize your plots.
          </p>
        </div>
      )}

      {/* Add Location Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Add Location</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>
                ✕
              </button>
            </div>
            <form className="modal-body" onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Location Name *</label>
                <input
                  type="text"
                  className="form-input"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g., Section A - North"
                  required
                  id="location-form-name"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea
                  className="form-textarea"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Optional description..."
                />
              </div>
              <div className="grid grid-2">
                <div className="form-group">
                  <label className="form-label">GPS Latitude</label>
                  <input
                    type="number"
                    step="any"
                    className="form-input"
                    value={form.gpsLat}
                    onChange={(e) => setForm({ ...form, gpsLat: e.target.value })}
                    placeholder="e.g., 8.2456"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">GPS Longitude</label>
                  <input
                    type="number"
                    step="any"
                    className="form-input"
                    value={form.gpsLng}
                    onChange={(e) => setForm({ ...form, gpsLng: e.target.value })}
                    placeholder="e.g., 124.9653"
                  />
                </div>
              </div>
              <div className="flex gap-sm" style={{ marginTop: "var(--space-xl)" }}>
                <button type="button" className="btn btn-ghost" style={{ flex: 1, justifyContent: "center" }} onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1, justifyContent: "center" }} disabled={submitting} id="location-form-submit">
                  {submitting ? "Saving..." : "Save Location"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
