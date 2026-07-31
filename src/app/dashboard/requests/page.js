"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import {
  Check, ClipboardList, Search, Trash2, CheckCircle, AlertTriangle,
  Send, Plus
} from "lucide-react";

function getErrorMessage(body, fallback) {
  return body?.error?.message || body?.error || fallback;
}

export default function RequestsPage() {
  const { data: session, status: sessionStatus } = useSession();
  const role = session?.user?.role;
  const isClient = role === "Client";
  const isAdmin = role === "Admin";
  const [requests, setRequests] = useState([]);
  const [trackedRequest, setTrackedRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortOrder, setSortOrder] = useState("newest");
  const [trackRef, setTrackRef] = useState("");
  const [tracking, setTracking] = useState(false);
  const [type, setType] = useState("reservation");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState("");
  const [updatingId, setUpdatingId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const fetchRequests = useCallback(async () => {
    if (sessionStatus !== "authenticated") return;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      const query = params.toString();
      const response = await fetch(`/api/requests${query ? `?${query}` : ""}`);
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(getErrorMessage(body, "Failed to load requests."));
      setRequests(Array.isArray(body) ? body : []);
      setTrackedRequest(null);
      setCurrentPage(1);
    } catch (requestError) {
      setRequests([]);
      setError(requestError.message || "Failed to load requests.");
    } finally {
      setLoading(false);
    }
  }, [sessionStatus, statusFilter]);

  useEffect(() => {
    if (sessionStatus === "authenticated") {
      void Promise.resolve().then(fetchRequests);
    }
  }, [fetchRequests, sessionStatus]);

  async function handleSubmit(event) {
    event.preventDefault();
    const trimmedDescription = description.trim();
    setError("");
    setSubmitSuccess("");
    if (!trimmedDescription || trimmedDescription.length > 2000) {
      setError("Description must be between 1 and 2000 characters.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, description: trimmedDescription }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(getErrorMessage(body, "Failed to submit request."));
      setDescription("");
      setSubmitSuccess(`Request submitted successfully. Reference ID: ${body.referenceId}`);
      await fetchRequests();
    } catch (requestError) {
      setError(requestError.message || "Failed to submit request.");
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(async () => {
      const referenceId = trackRef.trim();
      if (!referenceId) {
        setTrackedRequest(null);
        return;
      }
      setTracking(true);
      setError("");
      try {
        const response = await fetch(`/api/requests?ref=${encodeURIComponent(referenceId)}`);
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(getErrorMessage(body, "Request not found."));
        if (!body || Array.isArray(body) || typeof body !== "object") {
          throw new Error("The request lookup returned an invalid response.");
        }
        setTrackedRequest(body);
        setCurrentPage(1);
      } catch (requestError) {
        setTrackedRequest(null);
        setError(requestError.message || "Unable to track that request.");
      } finally {
        setTracking(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [trackRef]);

  async function handleStatusUpdate(id, status) {
    setUpdatingId(id);
    setError("");
    try {
      const response = await fetch("/api/requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(getErrorMessage(body, "Failed to update request."));
      await fetchRequests();
    } catch (requestError) {
      setError(requestError.message || "Failed to update request.");
    } finally {
      setUpdatingId(null);
    }
  }

  function clearTracking() {
    setTrackRef("");
    setTrackedRequest(null);
    setError("");
  }

  const baseRequests = trackedRequest ? [trackedRequest] : requests;
  const visibleRequests = [...baseRequests].sort((a, b) => {
    const dateA = new Date(a.createdAt || 0).getTime();
    const dateB = new Date(b.createdAt || 0).getTime();
    return sortOrder === "newest" ? dateB - dateA : dateA - dateB;
  });
  
  const totalPages = Math.ceil(visibleRequests.length / pageSize);
  const paginatedRequests = visibleRequests.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div className="page-header" style={{ marginBottom: 0 }}>
        <div>
          <h1 className="page-title">{isClient ? "My Requests" : "Requests"}</h1>
          <p className="page-subtitle">
            {isClient
              ? "Submit a request and track its progress"
              : "Manage user submissions and track request status"}
          </p>
        </div>
      </div>

      {/* Client Submit Request Form Container */}
      {isClient && (
        <div className="staff-card">
          <div className="staff-card-header">
            <div className="staff-card-title-group">
              <div className="staff-card-icon-badge primary">
                <Plus size={28} />
              </div>
              <div>
                <div className="staff-card-title">Submit a New Request</div>
                <div className="staff-card-subtitle">Select request type and provide details for staff assistance</div>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="staff-card-body">
            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <div className="form-group">
                <label className="form-label" htmlFor="request-type">
                  Request Type <span style={{ color: "var(--danger)" }}>*</span>
                </label>
                <select
                  id="request-type"
                  className="form-select"
                  value={type}
                  onChange={(event) => setType(event.target.value)}
                  style={{ height: "42px" }}
                >
                  <option value="reservation">Reservation — Reserve a plot or burial space</option>
                  <option value="record_update">Record Update — Correct or update grave information</option>
                  <option value="inquiry">Inquiry — General question or assistance request</option>
                </select>
              </div>

              <div className="form-group">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <label className="form-label" htmlFor="request-description" style={{ marginBottom: 0 }}>
                    Description <span style={{ color: "var(--danger)" }}>*</span>
                  </label>
                  <span className="text-xs text-muted">{description.length}/2000</span>
                </div>
                <textarea
                  id="request-description"
                  className="form-input"
                  rows={4}
                  maxLength={2000}
                  required
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Describe your request in detail (e.g. deceased name, requested plot section, or specific inquiry)..."
                  style={{ resize: "vertical", marginTop: "0.35rem" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button className="btn btn-primary" type="submit" disabled={submitting} style={{ padding: "0.6rem 1.35rem", gap: "0.5rem" }}>
                  <Send size={16} />
                  <span>{submitting ? "Submitting..." : "Submit Request"}</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Success / Error Alerts */}
      {submitSuccess && (
        <div className="alert alert-success flex items-center gap-sm" role="status" aria-live="polite">
          <CheckCircle size={18} aria-hidden="true" />
          <span style={{ flex: 1 }}>{submitSuccess}</span>
        </div>
      )}
      {error && (
        <div className="alert alert-danger flex items-center gap-sm" role="alert">
          <AlertTriangle size={18} aria-hidden="true" />
          <span style={{ flex: 1 }}>{error}</span>
        </div>
      )}

      {/* Requests Table Container */}
      <div className="staff-card">
        <div className="staff-card-header">
          <div className="staff-card-title-group">
            <div className="staff-card-icon-badge accent">
              <ClipboardList size={28} />
            </div>
            <div>
              <div className="staff-card-title">{isClient ? "My Request History" : "Submitted Requests"}</div>
              <div className="staff-card-subtitle">{isClient ? "Filter and track your request status" : "Review and manage user request queue"}</div>
            </div>
          </div>
        </div>

        <div className="staff-card-body" style={{ padding: "1rem 1.25rem", borderBottom: "1px solid var(--border-default)" }}>
          {/* Toolbar / Search & Filter Row */}
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ position: "relative", flex: 1, minWidth: "220px" }}>
              <Search size={16} className="text-muted" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
              <input
                type="text"
                className="form-input"
                style={{ paddingLeft: 36, height: "38px" }}
                aria-label="Reference ID"
                placeholder="Track by reference ID (e.g. REQ-123)..."
                value={trackRef}
                onChange={(event) => setTrackRef(event.target.value)}
                id="track-ref-input"
              />
            </div>

            <select
              className="form-select"
              aria-label="Filter by status"
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value);
                clearTracking();
              }}
              style={{ width: "150px", height: "38px" }}
              id="request-status-filter"
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>

            <select 
              className="form-select" 
              style={{ width: "150px", height: "38px" }}
              value={sortOrder}
              onChange={(e) => { setSortOrder(e.target.value); setCurrentPage(1); }}
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>

            {(trackRef || trackedRequest || statusFilter) && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={clearTracking}
                aria-label="Clear tracking"
                style={{ height: "38px" }}
              >
                ✕ Clear Filters
              </button>
            )}
          </div>
        </div>

        {loading || sessionStatus === "loading" ? (
          <div className="flex justify-center" style={{ padding: "var(--space-3xl)" }} role="status" aria-label="Loading requests">
            <div className="spinner spinner-lg" />
          </div>
        ) : visibleRequests.length > 0 ? (
          <div className="table-container" style={{ border: "none", borderRadius: 0 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Reference ID</th>
                  <th>Date</th>
                  {!isClient && <th>User</th>}
                  <th>Type &amp; Description</th>
                  <th>Status</th>
                  {isAdmin && <th>Actions</th>}
                </tr>
              </thead>

              <tbody>
                {paginatedRequests.map((request) => (
                  <tr key={request.id}>
                    <td>
                      <span className="badge badge-primary" style={{ fontFamily: "var(--font-mono)", fontSize: "0.78rem" }}>
                        {request.referenceId || `#${request.id}`}
                      </span>
                    </td>
                    <td className="text-sm">
                      <div style={{ fontWeight: 500 }}>{new Date(request.createdAt).toLocaleDateString()}</div>
                      <div className="text-muted text-xs">{new Date(request.createdAt).toLocaleTimeString()}</div>
                    </td>
                    {!isClient && (
                      <td className="text-sm">
                        <div style={{ fontWeight: 600 }}>{request.user?.name || "Unknown"}</div>
                        <div className="text-muted text-xs">{request.user?.email || ""}</div>
                      </td>
                    )}
                    <td style={{ maxWidth: "320px" }}>
                      <div style={{ marginBottom: 4 }}>
                        <span className="badge badge-muted text-xs" style={{ fontSize: "0.7rem", padding: "0.15rem 0.45rem" }}>
                          {formatType(request.type)}
                        </span>
                      </div>
                      <p className="text-sm text-muted" style={{ margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={request.description || ""}>
                        {request.description || "Details unavailable."}
                      </p>
                    </td>
                    <td>
                      <span className={`badge ${request.status === "pending" ? "badge-warning" : request.status === "approved" ? "badge-success" : "badge-danger"}`}>
                        {request.status}
                      </span>
                    </td>
                    {isAdmin && (
                      <td>
                        {request.status === "pending" ? (
                          <div className="flex action-buttons">
                            <button className="action-btn" type="button" disabled={updatingId === request.id} onClick={() => handleStatusUpdate(request.id, "approved")} aria-label={`Approve request ${request.referenceId}`}>
                              <Check size={16} aria-hidden="true" />
                            </button>
                            <button className="action-btn danger-icon" type="button" disabled={updatingId === request.id} onClick={() => handleStatusUpdate(request.id, "rejected")} aria-label={`Reject request ${request.referenceId}`}>
                              <Trash2 size={16} aria-hidden="true" />
                            </button>
                          </div>
                        ) : <span className="text-muted text-xs">—</span>}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="table-footer">
              <span className="text-sm text-muted">
                Showing {visibleRequests.length === 0 ? 0 : ((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, visibleRequests.length)} of {visibleRequests.length} records
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
                  disabled={currentPage >= totalPages} 
                  onClick={() => setCurrentPage(p => p + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ padding: "3rem 1.5rem", display: "flex", flexDirection: "column", alignItems: "center", textAlignment: "center" }}>
            <div style={{ color: "var(--text-muted)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "0.85rem" }}>
              <ClipboardList size={26} />
            </div>
            <div style={{ fontWeight: 700, fontSize: "1rem", color: "var(--text-primary)", marginBottom: "0.25rem" }}>
              No Requests Found
            </div>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", maxWidth: "340px", margin: "0 0 1rem 0", lineHeight: 1.4, textAlign: "center" }}>
              {trackedRequest || trackRef.trim() ? "No request found with that reference ID." : isClient ? "You have not submitted any requests yet." : "No requests to display."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function formatType(type) {
  if (!type) return "Request";
  return String(type).replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
