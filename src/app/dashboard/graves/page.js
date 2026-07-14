"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, Archive } from "lucide-react";

export default function GravesPage() {
  const [graves, setGraves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    deceasedName: "",
    plotId: "",
    burialDate: "",
    causeOfDeath: "",
    contactPerson: "",
    contactPhone: "",
    notes: "",
  });
  const [plots, setPlots] = useState([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchGraves = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/graves?${params}`);
      const data = await res.json();
      setGraves(data.graves || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  const fetchPlots = useCallback(async () => {
    try {
      const res = await fetch("/api/plots?status=available");
      const data = await res.json();
      setPlots(data.plots || []);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => Promise.all([fetchGraves(), fetchPlots()]));
  }, [fetchGraves, fetchPlots]);

  async function handleSearch(e) {
    e.preventDefault();
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/graves?q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      setSearchResults(data);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/graves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          plotId: parseInt(form.plotId),
        }),
      });

      if (res.ok) {
        setShowModal(false);
        setForm({
          deceasedName: "",
          plotId: "",
          burialDate: "",
          causeOfDeath: "",
          contactPerson: "",
          contactPhone: "",
          notes: "",
        });
        fetchGraves();
        fetchPlots();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to create record");
      }
    } catch (err) {
      alert("An error occurred");
    }
    setSubmitting(false);
  }

  const displayGraves = searchResults
    ? [...(searchResults.exact || []), ...(searchResults.suggestions || [])]
    : graves;

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Grave Records</h1>
          <p className="page-subtitle">Manage and search burial records</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)} id="add-grave-btn">
          + Add Record
        </button>
      </div>

      {/* Search & Filters */}
      <div className="card" style={{ marginBottom: "var(--space-lg)" }}>
        <div className="flex gap-md items-center" style={{ flexWrap: "wrap" }}>
          <form onSubmit={handleSearch} style={{ flex: 1, minWidth: 250 }}>
            <div style={{ position: "relative" }}>
              <input
                type="text"
                className="form-input"
                placeholder="Smart search by name, ID, or year..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                id="grave-search-input"
              />
            </div>
          </form>
          <select
            className="form-select"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setSearchResults(null);
            }}
            style={{ width: 160 }}
            id="grave-status-filter"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </select>
          <button className="btn btn-ghost flex items-center justify-center gap-xs" onClick={handleSearch} id="grave-search-btn">
            <Search size={18} /> Search
          </button>
          {searchResults && (
            <button
              className="btn btn-ghost"
              onClick={() => {
                setSearchResults(null);
                setSearchQuery("");
              }}
            >
              ✕ Clear
            </button>
          )}
        </div>
      </div>

      {/* Phonetic match notice */}
      {searchResults?.suggestions?.length > 0 && searchResults?.exact?.length === 0 && (
        <div className="alert alert-info flex items-center gap-sm" style={{ marginBottom: "var(--space-md)" }}>
          <Search size={16} /> No exact match found. Showing closest phonetic suggestions:
        </div>
      )}

      {/* Results */}
      {loading ? (
        <div className="flex justify-center" style={{ padding: "var(--space-3xl)" }}>
          <div className="spinner spinner-lg" />
        </div>
      ) : displayGraves.length > 0 ? (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Deceased Name</th>
                <th>Burial Date</th>
                <th>Plot</th>
                <th>Location</th>
                <th>Status</th>
                {searchResults?.suggestions?.length > 0 && <th>Match</th>}
              </tr>
            </thead>
            <tbody>
              {displayGraves.map((grave) => (
                <tr key={grave.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{grave.deceasedName}</div>
                    {grave.details?.contactPerson && (
                      <div className="text-xs text-muted">
                        Contact: {grave.details.contactPerson}
                      </div>
                    )}
                  </td>
                  <td>
                    {grave.burialDate
                      ? new Date(grave.burialDate).toLocaleDateString()
                      : "—"}
                  </td>
                  <td>
                    <span className="badge badge-primary">
                      {grave.plot?.plotNumber || "—"}
                    </span>
                  </td>
                  <td className="text-sm">
                    {grave.plot?.locationDetail?.location?.name || "—"}
                    {grave.plot?.locationDetail?.subsection &&
                      ` / ${grave.plot.locationDetail.subsection}`}
                  </td>
                  <td>
                    <span
                      className={`badge ${
                        grave.status === "active"
                          ? "badge-success"
                          : "badge-muted"
                      }`}
                    >
                      {grave.status}
                    </span>
                  </td>
                  {grave.score !== undefined && (
                    <td>
                      <span className="badge badge-info">
                        {Math.round(grave.score * 100)}%
                      </span>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-state-icon">
            <Archive size={48} />
          </div>
          <h3 className="empty-state-title">No Records Found</h3>
          <p className="empty-state-text">
            {searchQuery
              ? "No graves match your search. Try different keywords."
              : "Add your first grave record to get started."}
          </p>
        </div>
      )}

      {/* Add Grave Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Add Grave Record</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>
                ✕
              </button>
            </div>
            <form className="modal-body" onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Deceased Name *</label>
                <input
                  type="text"
                  className="form-input"
                  value={form.deceasedName}
                  onChange={(e) => setForm({ ...form, deceasedName: e.target.value })}
                  required
                  id="grave-form-name"
                />
              </div>
              <div className="grid grid-2">
                <div className="form-group">
                  <label className="form-label">Plot *</label>
                  <select
                    className="form-select"
                    value={form.plotId}
                    onChange={(e) => setForm({ ...form, plotId: e.target.value })}
                    required
                    id="grave-form-plot"
                  >
                    <option value="">Select plot...</option>
                    {plots.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.plotNumber} — {p.locationDetail?.location?.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Burial Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={form.burialDate}
                    onChange={(e) => setForm({ ...form, burialDate: e.target.value })}
                    id="grave-form-date"
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Cause of Death</label>
                <input
                  type="text"
                  className="form-input"
                  value={form.causeOfDeath}
                  onChange={(e) => setForm({ ...form, causeOfDeath: e.target.value })}
                />
              </div>
              <div className="grid grid-2">
                <div className="form-group">
                  <label className="form-label">Contact Person</label>
                  <input
                    type="text"
                    className="form-input"
                    value={form.contactPerson}
                    onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Contact Phone</label>
                  <input
                    type="text"
                    className="form-input"
                    value={form.contactPhone}
                    onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea
                  className="form-textarea"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>
              <div className="flex gap-sm" style={{ marginTop: "var(--space-xl)" }}>
                <button type="button" className="btn btn-ghost" style={{ flex: 1, justifyContent: "center" }} onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1, justifyContent: "center" }} disabled={submitting} id="grave-form-submit">
                  {submitting ? "Saving..." : "Save Grave"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
