"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { AlertTriangle, CheckCircle, ClipboardCheck, RotateCcw, XCircle, Clock, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";

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
  const [notes, setNotes] = useState({});
  const [pendingReject, setPendingReject] = useState(null);

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
        throw new Error(pendingData.error?.message || pendingData.error || "Failed to load pending records");
      }
      if (!incompleteRes.ok) {
        throw new Error(incompleteData.error?.message || incompleteData.error || "Failed to load incomplete records");
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

  async function updateVerification(record, status) {
    setWorkingId(record.id);
    setError("");
    try {
      const response = await fetch(`/api/graves/${record.id}/verify`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, note: notes[record.id] || undefined }),
      });
      const data = await response.json();
      if (!response.ok) {
        const missing = data.missing?.length ? ` Missing: ${data.missing.join(", ")}.` : "";
        throw new Error(`${data.error?.message || data.error || "Verification failed"}.${missing}`);
      }
      toast.success(`Record for ${record.deceasedName || `grave #${record.id}`} marked as ${status}`);
      setNotes((current) => ({ ...current, [record.id]: "" }));
      await loadRecords();
    } catch (err) {
      setError(err.message || "Verification failed");
      toast.error(err.message || "Verification failed");
    } finally {
      setWorkingId(null);
    }
  }

  const currentRecords = activeTab === "pending" ? pendingRecords : incompleteRecords;

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Record Verification</h1>
          <p className="page-subtitle">Review pending grave records and missing burial requirements</p>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger flex items-center gap-sm" role="alert" style={{ marginBottom: "var(--space-lg)" }}>
          <AlertTriangle size={18} />
          <span style={{ flex: 1 }}>{error}</span>
          {canVerify && <button className="btn btn-ghost btn-sm" onClick={loadRecords}>Retry</button>}
        </div>
      )}

      {/* Tabs */}
      <div className="tabs" style={{ maxWidth: "480px", marginBottom: "var(--space-lg)" }}>
        <button
          type="button"
          className={`tab ${activeTab === "pending" ? "active" : ""}`}
          onClick={() => setActiveTab("pending")}
          style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "0.35rem" }}
        >
          <Clock size={15} />
          <span>Pending Review ({pendingRecords.length})</span>
        </button>
        <button
          type="button"
          className={`tab ${activeTab === "incomplete" ? "active" : ""}`}
          onClick={() => setActiveTab("incomplete")}
          style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "0.35rem" }}
        >
          <ShieldAlert size={15} />
          <span>Incomplete Alerts ({incompleteRecords.length})</span>
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center" style={{ padding: "var(--space-3xl)" }}>
          <div className="spinner spinner-lg" aria-label="Loading verification queue" />
        </div>
      ) : activeTab === "pending" ? (
        pendingRecords.length === 0 && !error ? (
          <div className="empty-state">
            <div className="empty-state-icon"><ClipboardCheck size={48} /></div>
            <h3 className="empty-state-title">No Pending Records</h3>
            <p className="empty-state-text">Every grave record in the registry is currently verified and approved.</p>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted" style={{ margin: "0 0 var(--space-md)" }}>
              Showing {pendingRecords.length} record{pendingRecords.length === 1 ? "" : "s"} awaiting verification approval
            </p>
            <div className="grid grid-2">
              {pendingRecords.map((record) => (
                <article key={record.id} className="card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                  <div>
                    <div className="flex justify-between items-start gap-sm" style={{ marginBottom: "var(--space-sm)" }}>
                      <div>
                        <h3 style={{ margin: "0 0 4px 0", fontSize: "1.1rem" }}>{record.deceasedName?.trim() || "Unnamed record"}</h3>
                        <p className="text-sm text-muted" style={{ margin: 0 }}>
                          Grave #{record.id} · Plot {record.plot?.plotNumber || record.plotNumber || record.plotId || "unassigned"}
                          {record.plot?.locationDetail?.location?.name && ` · ${record.plot.locationDetail.location.name}`}
                        </p>
                      </div>
                      <span className="badge badge-warning">
                        {record.verificationStatus || "pending"}
                      </span>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: "0.5rem",
                        marginBottom: "var(--space-md)",
                        fontSize: "0.85rem",
                        background: "var(--bg-glass, rgba(241, 245, 249, 0.45))",
                        padding: "0.65rem 0.85rem",
                        borderRadius: "var(--radius-md, 8px)",
                        border: "1px solid var(--border-default, #e2e8f0)",
                      }}
                    >
                      <div>
                        <span className="text-muted" style={{ fontSize: "0.75rem", display: "block" }}>Burial Date</span>
                        <strong>
                          {record.burialDate
                            ? new Date(record.burialDate).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" })
                            : "—"}
                        </strong>
                      </div>
                      <div>
                        <span className="text-muted" style={{ fontSize: "0.75rem", display: "block" }}>Plot GPS</span>
                        <strong>
                          {record.plot?.gpsLat && record.plot?.gpsLng
                            ? `${record.plot.gpsLat.toFixed(5)}, ${record.plot.gpsLng.toFixed(5)}`
                            : "Available"}
                        </strong>
                      </div>
                      {record.details?.causeOfDeath && (
                        <div style={{ gridColumn: "span 2" }}>
                          <span className="text-muted" style={{ fontSize: "0.75rem", display: "block" }}>Cause of Death</span>
                          <span>{record.details.causeOfDeath}</span>
                        </div>
                      )}
                      {record.details?.contactPerson && (
                        <div style={{ gridColumn: "span 2" }}>
                          <span className="text-muted" style={{ fontSize: "0.75rem", display: "block" }}>Contact Person</span>
                          <span>{record.details.contactPerson} {record.details.contactPhone ? `(${record.details.contactPhone})` : ""}</span>
                        </div>
                      )}
                      {record.details?.notes && (
                        <div style={{ gridColumn: "span 2" }}>
                          <span className="text-muted" style={{ fontSize: "0.75rem", display: "block" }}>Notes</span>
                          <span className="text-muted" style={{ fontSize: "0.82rem" }}>{record.details.notes}</span>
                        </div>
                      )}
                    </div>

                    <div className="form-group" style={{ marginBottom: "var(--space-md)" }}>
                      <label className="form-label" htmlFor={`verification-note-${record.id}`} style={{ fontSize: "0.8rem" }}>
                        Verification note (optional)
                      </label>
                      <textarea
                        id={`verification-note-${record.id}`}
                        className="form-textarea"
                        maxLength={500}
                        rows={2}
                        value={notes[record.id] || ""}
                        onChange={(event) => setNotes((current) => ({ ...current, [record.id]: event.target.value }))}
                        placeholder="Document the review or notes for this record"
                      />
                    </div>
                  </div>

                  <div className="flex gap-sm" style={{ flexWrap: "wrap", marginTop: "auto" }}>
                    <button
                      className="btn btn-primary btn-sm"
                      disabled={workingId === record.id}
                      onClick={() => updateVerification(record, "verified")}
                      style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}
                    >
                      <CheckCircle size={15} /> Verify Record
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      disabled={workingId === record.id}
                      onClick={() => setPendingReject(record)}
                      style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}
                    >
                      <XCircle size={15} /> Reject
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </>
        )
      ) : (
        /* Incomplete Tab */
        incompleteRecords.length === 0 && !error ? (
          <div className="empty-state">
            <div className="empty-state-icon"><ClipboardCheck size={48} /></div>
            <h3 className="empty-state-title">No Incomplete Records</h3>
            <p className="empty-state-text">Every active grave has a name, burial date, plot assignment, and plot GPS coordinates.</p>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted" style={{ margin: "0 0 var(--space-md)" }}>
              Showing {incompleteRecords.length} record{incompleteRecords.length === 1 ? "" : "s"} missing required burial data
            </p>
            <div className="grid grid-2">
              {incompleteRecords.map((record) => (
                <article key={record.id} className="card">
                  <div className="flex justify-between items-center gap-sm" style={{ marginBottom: "var(--space-md)" }}>
                    <div>
                      <h3 style={{ margin: 0 }}>{record.deceasedName?.trim() || "Unnamed record"}</h3>
                      <p className="text-sm text-muted" style={{ margin: 0 }}>Grave #{record.id} · Plot {record.plotNumber || record.plotId || "unassigned"}</p>
                    </div>
                    <span className={`badge ${record.verificationStatus === "rejected" ? "badge-danger" : "badge-warning"}`}>
                      {record.verificationStatus || "pending"}
                    </span>
                  </div>
                  <div style={{ marginBottom: "var(--space-md)" }}>
                    <div className="text-xs text-muted" style={{ fontWeight: 600, marginBottom: 6 }}>MISSING REQUIREMENTS</div>
                    <div className="flex gap-xs" style={{ flexWrap: "wrap" }}>
                      {record.missing.map((field) => <span key={field} className="badge badge-danger">{field}</span>)}
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor={`verification-note-${record.id}`}>Verification note</label>
                    <textarea
                      id={`verification-note-${record.id}`}
                      className="form-textarea"
                      maxLength={500}
                      rows={2}
                      value={notes[record.id] || ""}
                      onChange={(event) => setNotes((current) => ({ ...current, [record.id]: event.target.value }))}
                      placeholder="Document the review or required correction"
                    />
                  </div>

                  <div className="flex gap-sm" style={{ flexWrap: "wrap" }}>
                    <button className="btn btn-primary btn-sm" disabled={workingId === record.id} onClick={() => updateVerification(record, "verified")}>
                      <CheckCircle size={15} /> Re-check &amp; Verify
                    </button>
                    <button className="btn btn-danger btn-sm" disabled={workingId === record.id} onClick={() => setPendingReject(record)}>
                      <XCircle size={15} /> Reject
                    </button>
                    <button className="btn btn-ghost btn-sm" disabled={workingId === record.id} onClick={() => updateVerification(record, "pending")}>
                      <RotateCcw size={15} /> Keep Pending
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </>
        )
      )}

      <ConfirmDialog
        open={Boolean(pendingReject)}
        title="Reject this record?"
        description={
          pendingReject
            ? `The record for ${pendingReject.deceasedName?.trim() || `grave #${pendingReject.id}`} will be marked as rejected and returned for correction. Your verification note is saved with the decision.`
            : ""
        }
        confirmLabel="Reject record"
        busy={workingId === pendingReject?.id}
        onConfirm={async () => {
          const record = pendingReject;
          await updateVerification(record, "rejected");
          setPendingReject(null);
        }}
        onCancel={() => setPendingReject(null)}
      />
    </div>
  );
}