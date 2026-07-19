"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { AlertTriangle, CheckCircle, ClipboardCheck, RotateCcw, XCircle } from "lucide-react";

export default function VerificationPage() {
  const { data: session, status: sessionStatus } = useSession();
  const role = session?.user?.role;
  const canVerify = role === "Admin" || role === "Staff";
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [workingId, setWorkingId] = useState(null);
  const [notes, setNotes] = useState({});

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
      const response = await fetch("/api/graves/incomplete");
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error?.message || data.error || "Failed to load verification queue");
      }
      setRecords(data.records || []);
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
      setNotes((current) => ({ ...current, [record.id]: "" }));
      await loadRecords();
    } catch (err) {
      setError(err.message || "Verification failed");
    } finally {
      setWorkingId(null);
    }
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Record Verification</h1>
          <p className="page-subtitle">Review missing burial identifiers and plot GPS before verification</p>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger flex items-center gap-sm" role="alert" style={{ marginBottom: "var(--space-lg)" }}>
          <AlertTriangle size={18} />
          <span style={{ flex: 1 }}>{error}</span>
          {canVerify && <button className="btn btn-ghost btn-sm" onClick={loadRecords}>Retry</button>}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center" style={{ padding: "var(--space-3xl)" }}>
          <div className="spinner spinner-lg" aria-label="Loading verification queue" />
        </div>
      ) : records.length === 0 && !error ? (
        <div className="empty-state">
          <div className="empty-state-icon"><ClipboardCheck size={48} /></div>
          <h3 className="empty-state-title">No Incomplete Records</h3>
          <p className="empty-state-text">Every active grave has a name, burial date, plot assignment, and plot GPS coordinates.</p>
        </div>
      ) : records.length > 0 ? (
        <div className="grid grid-2">
          {records.map((record) => (
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
                  value={notes[record.id] || ""}
                  onChange={(event) => setNotes((current) => ({ ...current, [record.id]: event.target.value }))}
                  placeholder="Document the review or required correction"
                />
              </div>

              <div className="flex gap-sm" style={{ flexWrap: "wrap" }}>
                <button className="btn btn-primary btn-sm" disabled={workingId === record.id} onClick={() => updateVerification(record, "verified")}>
                  <CheckCircle size={15} /> Re-check &amp; Verify
                </button>
                <button className="btn btn-ghost btn-sm" disabled={workingId === record.id} onClick={() => updateVerification(record, "rejected")} style={{ color: "var(--danger)" }}>
                  <XCircle size={15} /> Reject
                </button>
                <button className="btn btn-ghost btn-sm" disabled={workingId === record.id} onClick={() => updateVerification(record, "pending")}>
                  <RotateCcw size={15} /> Keep Pending
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </div>
  );
}