"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import {
  AlertTriangle,
  CheckCircle,
  ClipboardCheck,
  RotateCcw,
  XCircle,
  Clock,
  ShieldAlert,
  Search,
  Info,
} from "lucide-react";
import { toast } from "sonner";

function formatGps(lat, lng) {
  if (lat === null || lat === undefined || lng === null || lng === undefined) {
    return "—";
  }
  const numLat = Number(lat);
  const numLng = Number(lng);
  if (Number.isNaN(numLat) || Number.isNaN(numLng)) {
    return "—";
  }
  return `${numLat.toFixed(5)}, ${numLng.toFixed(5)}`;
}

function formatDate(dateVal) {
  if (!dateVal) return "—";
  try {
    const d = new Date(dateVal);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  } catch {
    return "—";
  }
}

function getPlotGps(record) {
  if (record.plotGps) {
    return { lat: record.plotGps.lat, lng: record.plotGps.lng };
  }
  if (record.plot) {
    return { lat: record.plot.gpsLat, lng: record.plot.gpsLng };
  }
  return { lat: null, lng: null };
}

function getPlotNumber(record) {
  return (
    record.plot?.plotNumber ||
    record.plotNumber ||
    (record.plotId ? `Plot #${record.plotId}` : "Unassigned")
  );
}

function getLocationName(record) {
  if (record.plot?.locationDetail?.location?.name) {
    const loc = record.plot.locationDetail.location.name;
    const sub = record.plot.locationDetail.subsection;
    return sub ? `${loc} / ${sub}` : loc;
  }
  return "—";
}

export default function VerificationPage() {
  const { data: session, status: sessionStatus } = useSession();
  const role = session?.user?.role;
  const canVerify = role === "Admin" || role === "Staff";
  const [activeTab, setActiveTab] = useState("pending");
  const [pendingRecords, setPendingRecords] = useState([]);
  const [incompleteRecords, setIncompleteRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [workingId, setWorkingId] = useState(null);
  const [pendingReject, setPendingReject] = useState(null);
  const [rejectNote, setRejectNote] = useState("");
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  const loadRecords = useCallback(async () => {
    if (sessionStatus === "loading") return;
    if (!canVerify) {
      setError("You do not have permission to verify grave records.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const [pendingRes, incompleteRes] = await Promise.all([
        fetch("/api/graves?verificationStatus=pending&status=active&limit=100"),
        fetch("/api/graves/incomplete"),
      ]);

      const [pendingData, incompleteData] = await Promise.all([
        pendingRes.json(),
        incompleteRes.json(),
      ]);

      if (!pendingRes.ok) {
        throw new Error(
          pendingData.error?.message ||
            pendingData.error ||
            "Failed to load pending records"
        );
      }
      if (!incompleteRes.ok) {
        throw new Error(
          incompleteData.error?.message ||
            incompleteData.error ||
            "Failed to load incomplete records"
        );
      }

      setPendingRecords(pendingData.graves || []);
      setIncompleteRecords(incompleteData.records || []);
    } catch (err) {
      setError(err.message || "Failed to load verification queue");
    } finally {
      setLoading(false);
    }
  }, [canVerify, sessionStatus]);

  useEffect(() => {
    void Promise.resolve().then(loadRecords);
  }, [loadRecords]);

  async function updateVerification(record, status, noteToSend) {
    setWorkingId(record.id);
    setError("");
    try {
      const response = await fetch(`/api/graves/${record.id}/verify`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, note: noteToSend || undefined }),
      });
      const data = await response.json();
      if (!response.ok) {
        const missing = data.missing?.length
          ? ` Missing: ${data.missing.join(", ")}.`
          : "";
        throw new Error(
          `${data.error?.message || data.error || "Verification failed"}.${missing}`
        );
      }
      toast.success(
        `Record for ${record.deceasedName || `grave #${record.id}`} marked as ${status}`
      );
      await loadRecords();
    } catch (err) {
      setError(err.message || "Verification failed");
      toast.error(err.message || "Verification failed");
    } finally {
      setWorkingId(null);
    }
  }

  const currentRecords =
    activeTab === "pending" ? pendingRecords : incompleteRecords;

  const filteredRecords = currentRecords.filter((rec) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const name = String(rec.deceasedName || "").toLowerCase();
    const plot = String(getPlotNumber(rec)).toLowerCase();
    const id = String(rec.id || "");
    return name.includes(q) || plot.includes(q) || id.includes(q);
  });

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Record Verification</h1>
          <p className="page-subtitle">
            Review pending grave records and inspect incomplete burial requirements
          </p>
        </div>
      </div>

      {error && (
        <div
          className="alert alert-danger flex items-center gap-sm"
          role="alert"
          style={{ marginBottom: "var(--space-lg)" }}
        >
          <AlertTriangle size={18} />
          <span style={{ flex: 1 }}>{error}</span>
          {canVerify && (
            <button className="btn btn-ghost btn-sm" onClick={loadRecords}>
              Retry
            </button>
          )}
        </div>
      )}

      {/* Tabs & Search Filter Header */}
      <div
        className="flex justify-between items-center gap-md"
        style={{ flexWrap: "wrap", marginBottom: "var(--space-md)" }}
      >
        <div className="tabs" style={{ maxWidth: "480px", margin: 0 }}>
          <button
            type="button"
            className={`tab ${activeTab === "pending" ? "active" : ""}`}
            onClick={() => {
              setActiveTab("pending");
              setSearchQuery("");
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.35rem",
            }}
          >
            <Clock size={15} />
            <span>Pending Review ({pendingRecords.length})</span>
          </button>
          <button
            type="button"
            className={`tab ${activeTab === "incomplete" ? "active" : ""}`}
            onClick={() => {
              setActiveTab("incomplete");
              setSearchQuery("");
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.35rem",
            }}
          >
            <ShieldAlert size={15} />
            <span>Incomplete Alerts ({incompleteRecords.length})</span>
          </button>
        </div>

        {/* Search filter */}
        <div style={{ position: "relative", minWidth: 260, flex: "0 1 320px" }}>
          <Search
            size={16}
            className="text-muted"
            style={{
              position: "absolute",
              left: 12,
              top: "50%",
              transform: "translateY(-50%)",
            }}
          />
          <input
            type="text"
            className="form-input"
            style={{ paddingLeft: 36 }}
            placeholder="Filter records..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div
          className="flex justify-center"
          style={{ padding: "var(--space-3xl)" }}
        >
          <div
            className="spinner spinner-lg"
            aria-label="Loading verification queue"
          />
        </div>
      ) : activeTab === "pending" ? (
        /* ── Pending Review Table ────────────────────────────────────── */
        filteredRecords.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <ClipboardCheck size={48} />
            </div>
            <h3 className="empty-state-title">
              {searchQuery ? "No Matching Records" : "No Pending Records"}
            </h3>
            <p className="empty-state-text">
              {searchQuery
                ? `No records matching "${searchQuery}" in the pending review queue.`
                : "Every complete grave record in the registry is currently verified and approved."}
            </p>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Deceased Name</th>
                  <th>Plot</th>
                  <th>Location</th>
                  <th>Burial Date</th>
                  <th style={{ textAlign: "right", minWidth: "160px" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((record) => (
                  <tr key={record.id}>
                    <td>
                      <div className="flex items-center gap-xs">
                        <div>
                          <div style={{ fontWeight: 600 }}>
                            {record.deceasedName?.trim() || "Unnamed record"}
                          </div>
                          <div className="text-xs text-muted">
                            Grave #{record.id}
                            {record.details?.contactPerson &&
                              ` · ${record.details.contactPerson}`}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="action-btn"
                          title="View record review details"
                          onClick={() => setSelectedRecord(record)}
                          style={{ padding: 4, marginLeft: 4 }}
                        >
                          <Info size={14} className="text-muted" />
                        </button>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                        {getPlotNumber(record)}
                      </span>
                    </td>
                    <td className="text-sm">{getLocationName(record)}</td>
                    <td className="text-sm">{formatDate(record.burialDate)}</td>
                    <td>
                      <div
                        className="flex action-buttons"
                        style={{
                          justifyContent: "flex-end",
                          alignItems: "center",
                          gap: "0.4rem",
                        }}
                      >
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          disabled={workingId === record.id}
                          onClick={() => updateVerification(record, "verified")}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.35rem",
                            padding: "0.35rem 0.75rem",
                            fontSize: "0.8rem",
                          }}
                        >
                          <CheckCircle size={14} />
                          <span>Verify</span>
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          disabled={workingId === record.id}
                          onClick={() => {
                            setPendingReject(record);
                            setRejectNote("");
                          }}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.35rem",
                            padding: "0.35rem 0.65rem",
                            fontSize: "0.8rem",
                          }}
                        >
                          <XCircle size={14} />
                          <span>Reject</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        /* ── Incomplete Alerts Table ─────────────────────────────────── */
        filteredRecords.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <ClipboardCheck size={48} />
            </div>
            <h3 className="empty-state-title">
              {searchQuery ? "No Matching Alerts" : "No Incomplete Records"}
            </h3>
            <p className="empty-state-text">
              {searchQuery
                ? `No alerts matching "${searchQuery}".`
                : "Every active grave has a name, burial date, plot assignment, and plot GPS coordinates."}
            </p>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Deceased Name</th>
                  <th>Plot</th>
                  <th>Burial Date</th>
                  <th>Missing Requirements</th>
                  <th style={{ textAlign: "right", minWidth: "180px" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((record) => (
                  <tr key={record.id}>
                    <td>
                      <div>
                        <div style={{ fontWeight: 600 }}>
                          {record.deceasedName?.trim() || "Unnamed record"}
                        </div>
                        <div className="text-xs text-muted">
                          Grave #{record.id}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                        {getPlotNumber(record)}
                      </span>
                    </td>
                    <td className="text-sm">{formatDate(record.burialDate)}</td>
                    <td>
                      <div className="flex gap-xs" style={{ flexWrap: "wrap" }}>
                        {(record.missing || []).map((field) => (
                          <span key={field} className="badge badge-danger">
                            {field}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <div
                        className="flex action-buttons"
                        style={{
                          justifyContent: "flex-end",
                          alignItems: "center",
                          gap: "0.35rem",
                        }}
                      >
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          disabled={workingId === record.id}
                          onClick={() => updateVerification(record, "verified")}
                          title="Re-check requirements and verify"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.3rem",
                            padding: "0.35rem 0.65rem",
                            fontSize: "0.8rem",
                          }}
                        >
                          <CheckCircle size={14} />
                          <span>Re-check</span>
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          disabled={workingId === record.id}
                          onClick={() => {
                            setPendingReject(record);
                            setRejectNote("");
                          }}
                          title="Reject record"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.3rem",
                            padding: "0.35rem 0.6rem",
                            fontSize: "0.8rem",
                          }}
                        >
                          <XCircle size={14} />
                          <span>Reject</span>
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          disabled={workingId === record.id}
                          onClick={() => updateVerification(record, "pending")}
                          title="Keep pending"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.3rem",
                            padding: "0.35rem 0.55rem",
                            fontSize: "0.8rem",
                          }}
                        >
                          <RotateCcw size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Record Review Details Modal */}
      {selectedRecord && (
        <div
          className="modal-overlay"
          onClick={() => setSelectedRecord(null)}
          style={{ zIndex: 1000 }}
        >
          <div
            className="modal"
            style={{ maxWidth: 540 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3 className="modal-title">Record Review Details</h3>
              <button
                className="modal-close"
                onClick={() => setSelectedRecord(null)}
              >
                ✕
              </button>
            </div>
            <div
              className="modal-body"
              style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}
            >
              <div>
                <h4 style={{ margin: "0 0 4px 0", fontSize: "1.15rem" }}>
                  {selectedRecord.deceasedName || "Unnamed"}
                </h4>
                <p className="text-sm text-muted" style={{ margin: 0 }}>
                  Grave #{selectedRecord.id} · Plot {getPlotNumber(selectedRecord)} (
                  {getLocationName(selectedRecord)})
                </p>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "0.5rem",
                  background: "var(--bg-glass, rgba(241, 245, 249, 0.45))",
                  padding: "0.75rem",
                  borderRadius: "var(--radius-md, 8px)",
                  border: "1px solid var(--border-default, #e2e8f0)",
                  fontSize: "0.85rem",
                }}
              >
                <div>
                  <span className="text-muted" style={{ fontSize: "0.75rem", display: "block" }}>
                    Burial Date
                  </span>
                  <strong>{formatDate(selectedRecord.burialDate)}</strong>
                </div>
                <div>
                  <span className="text-muted" style={{ fontSize: "0.75rem", display: "block" }}>
                    Plot GPS Coordinates
                  </span>
                  <strong>
                    {formatGps(
                      getPlotGps(selectedRecord).lat,
                      getPlotGps(selectedRecord).lng
                    )}
                  </strong>
                </div>
                {selectedRecord.details?.causeOfDeath && (
                  <div style={{ gridColumn: "span 2" }}>
                    <span className="text-muted" style={{ fontSize: "0.75rem", display: "block" }}>
                      Cause of Death
                    </span>
                    <span>{selectedRecord.details.causeOfDeath}</span>
                  </div>
                )}
                {selectedRecord.details?.contactPerson && (
                  <div style={{ gridColumn: "span 2" }}>
                    <span className="text-muted" style={{ fontSize: "0.75rem", display: "block" }}>
                      Contact Person
                    </span>
                    <span>
                      {selectedRecord.details.contactPerson}
                      {selectedRecord.details?.contactPhone &&
                        ` (${selectedRecord.details.contactPhone})`}
                    </span>
                  </div>
                )}
                {selectedRecord.details?.notes && (
                  <div style={{ gridColumn: "span 2" }}>
                    <span className="text-muted" style={{ fontSize: "0.75rem", display: "block" }}>
                      Memorial Notes
                    </span>
                    <span style={{ whiteSpace: "pre-wrap" }}>
                      {selectedRecord.details.notes}
                    </span>
                  </div>
                )}
              </div>
            </div>
            <div
              className="modal-footer"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setSelectedRecord(null)}
              >
                Close
              </button>
              <div className="flex gap-sm">
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={() => {
                    const rec = selectedRecord;
                    setSelectedRecord(null);
                    setPendingReject(rec);
                    setRejectNote("");
                  }}
                >
                  <XCircle size={14} /> Reject
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={async () => {
                    const rec = selectedRecord;
                    setSelectedRecord(null);
                    await updateVerification(rec, "verified");
                  }}
                >
                  <CheckCircle size={14} /> Verify Record
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal with optional note */}
      {pendingReject && (
        <div
          className="modal-overlay"
          onClick={() => {
            if (!workingId) {
              setPendingReject(null);
              setRejectNote("");
            }
          }}
          style={{ zIndex: 1000 }}
        >
          <div
            className="modal"
            style={{ maxWidth: 460 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3 className="modal-title" style={{ color: "var(--danger, #ef4444)" }}>
                Reject Grave Record?
              </h3>
              <button
                className="modal-close"
                onClick={() => {
                  setPendingReject(null);
                  setRejectNote("");
                }}
                disabled={Boolean(workingId)}
              >
                ✕
              </button>
            </div>
            <div
              className="modal-body"
              style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}
            >
              <p className="text-sm" style={{ margin: 0 }}>
                The record for{" "}
                <strong>
                  {pendingReject.deceasedName?.trim() || `grave #${pendingReject.id}`}
                </strong>{" "}
                will be marked as rejected and returned for correction.
              </p>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: "0.82rem" }}>
                  Reason for Rejection / Correction Instructions (Optional)
                </label>
                <textarea
                  className="form-textarea"
                  rows={3}
                  maxLength={500}
                  value={rejectNote}
                  onChange={(e) => setRejectNote(e.target.value)}
                  placeholder="Explain what needs correction..."
                />
              </div>
            </div>
            <div
              className="modal-footer"
              style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}
            >
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setPendingReject(null);
                  setRejectNote("");
                }}
                disabled={Boolean(workingId)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                disabled={Boolean(workingId)}
                onClick={async () => {
                  const record = pendingReject;
                  await updateVerification(record, "rejected", rejectNote);
                  setPendingReject(null);
                  setRejectNote("");
                }}
              >
                {workingId === pendingReject.id ? "Rejecting..." : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}