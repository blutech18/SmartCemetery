"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Search, Archive, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";

const EMPTY_FORM = {
  deceasedName: "",
  plotId: "",
  burialDate: "",
  causeOfDeath: "",
  contactPerson: "",
  contactPhone: "",
  notes: "",
};

export default function GravesPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "Admin";
  const [graves, setGraves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalRecords, setTotalRecords] = useState(0);
  const pageSize = 10;
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [plots, setPlots] = useState([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchGraves = useCallback(async () => {
    // Skip default fetch if we are actively viewing search results
    if (searchQuery.trim()) return;
    
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      params.set("page", currentPage);
      params.set("limit", pageSize);
      const res = await fetch(`/api/graves?${params}`);
      const data = await res.json();
      setGraves(data.graves || []);
      setTotalPages(data.pagination?.totalPages || 0);
      setTotalRecords(data.pagination?.total || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, currentPage, searchQuery]);

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

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!searchQuery.trim()) {
        setSearchResults(null);
        return;
      }
      setLoading(true);
      fetch(`/api/graves?q=${encodeURIComponent(searchQuery)}`)
        .then(res => res.json())
        .then(data => {
          setSearchResults(data);
          setCurrentPage(1);
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(editingId ? `/api/graves/${editingId}` : "/api/graves", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          plotId: parseInt(form.plotId),
        }),
      });

      if (res.ok) {
        setShowModal(false);
        setEditingId(null);
        setForm(EMPTY_FORM);
        await Promise.all([fetchGraves(), fetchPlots()]);
        toast.success(editingId ? "Record updated" : "Record created");
      } else {
        const err = await res.json();
        toast.error(err.error?.message || err.error || `Failed to ${editingId ? "update" : "create"} record`);
      }
    } catch {
      toast.error("An error occurred");
    }
    setSubmitting(false);
  }

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  }

  function openEdit(grave) {
    setEditingId(grave.id);
    setForm({
      deceasedName: grave.deceasedName || "",
      plotId: String(grave.plotId || ""),
      burialDate: grave.burialDate ? new Date(grave.burialDate).toISOString().slice(0, 10) : "",
      causeOfDeath: grave.details?.causeOfDeath || "",
      contactPerson: grave.details?.contactPerson || "",
      contactPhone: grave.details?.contactPhone || "",
      notes: grave.details?.notes || "",
    });
    setShowModal(true);
  }

  async function deleteGrave(grave) {
    setDeleting(true);
    try {
      const res = await fetch(`/api/graves/${grave.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || data.error || "Failed to delete record");
      toast.success(`Record for ${grave.deceasedName} deleted`);
      await Promise.all([fetchGraves(), fetchPlots()]);
    } catch (err) {
      toast.error(err.message || "Failed to delete record");
    } finally {
      setDeleting(false);
      setPendingDelete(null);
    }
  }

  let displayGraves = graves;
  let currentTotalPages = totalPages;
  let currentTotalRecords = totalRecords;
  let currentStart = (currentPage - 1) * pageSize + 1;
  let currentEnd = Math.min(currentPage * pageSize, totalRecords);

  if (searchResults) {
    const allSearch = [...(searchResults.exact || []), ...(searchResults.suggestions || [])];
    currentTotalRecords = allSearch.length;
    currentTotalPages = Math.ceil(currentTotalRecords / pageSize);
    displayGraves = allSearch.slice((currentPage - 1) * pageSize, currentPage * pageSize);
    currentStart = currentTotalRecords === 0 ? 0 : (currentPage - 1) * pageSize + 1;
    currentEnd = Math.min(currentPage * pageSize, currentTotalRecords);
  } else {
    currentStart = totalRecords === 0 ? 0 : currentStart;
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Grave Records</h1>
          <p className="page-subtitle">Manage and search burial records</p>
        </div>
        {isAdmin && (
          <button 
            className="btn btn-primary-minimal" 
            onClick={openCreate} 
            id="add-grave-btn"
          >
            + Add Grave Record
          </button>
        )}
      </div>

      {/* Search & Filters */}
      <div className="flex gap-sm items-center mb-lg" style={{ flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 250 }}>
          <Search size={16} className="text-muted" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
          <input
            type="text"
            className="form-input"
            style={{ paddingLeft: 36 }}
            placeholder="Search by name, ID, or year..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            id="grave-search-input"
          />
        </div>
        <select
          className="form-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ width: 160 }}
          id="grave-status-filter"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="archived">Archived</option>
        </select>
        {searchResults && (
          <button
            className="btn btn-ghost"
            onClick={() => setSearchQuery("")}
          >
            ✕ Clear
          </button>
        )}
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
                <th>Verification</th>
                {isAdmin && <th>Actions</th>}
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
                  <td>
                    <span className={`badge ${grave.verificationStatus === "verified" ? "badge-success" : grave.verificationStatus === "rejected" ? "badge-danger" : "badge-warning"}`}>
                      {grave.verificationStatus || "pending"}
                    </span>
                  </td>
                  {isAdmin && (
                    <td>
                      <div className="flex action-buttons">
                        <button className="action-btn" onClick={() => openEdit(grave)} title={`Edit ${grave.deceasedName}`} aria-label={`Edit ${grave.deceasedName}`}>
                          <Pencil size={16} />
                        </button>
                        <button className="action-btn danger-icon" onClick={() => setPendingDelete(grave)} title={`Delete ${grave.deceasedName}`} aria-label={`Delete ${grave.deceasedName}`}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  )}
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
          
          <div className="table-footer">
            <span className="text-sm text-muted">
              Showing {currentStart} to {currentEnd} of {currentTotalRecords} records
            </span>
            <div className="flex gap-sm">
              <button 
                className="btn btn-secondary btn-sm" 
                disabled={currentPage === 1} 
                onClick={() => setCurrentPage(p => p - 1)}
              >
                Previous
              </button>
              <button 
                className="btn btn-secondary btn-sm" 
                disabled={currentPage >= currentTotalPages || currentTotalPages === 0} 
                onClick={() => setCurrentPage(p => p + 1)}
              >
                Next
              </button>
            </div>
          </div>
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

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Permanently delete this record?"
        description={
          pendingDelete
            ? `The burial record for ${pendingDelete.deceasedName} will be permanently deleted and its plot released. This cannot be undone.`
            : ""
        }
        confirmLabel="Delete record"
        busy={deleting}
        onConfirm={() => deleteGrave(pendingDelete)}
        onCancel={() => setPendingDelete(null)}
      />

      {/* Add/Edit Grave Modal */}
      {showModal && isAdmin && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editingId ? "Edit Grave Record" : "Add Grave Record"}</h3>
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
                    {editingId && form.plotId && !plots.some((p) => String(p.id) === form.plotId) && (() => {
                      const current = displayGraves.find((grave) => grave.id === editingId)?.plot;
                      return <option value={form.plotId}>{current?.plotNumber || `Plot ${form.plotId}`} — current assignment</option>;
                    })()}
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
                  {submitting ? "Saving..." : editingId ? "Save Changes" : "Save Grave"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
