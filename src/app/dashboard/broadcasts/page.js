"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Megaphone, Send, Search } from "lucide-react";

function errorMessage(body, fallback) {
  return body?.error?.message || body?.error || fallback;
}

export default function BroadcastsPage() {
  const { data: session, status: sessionStatus } = useSession();
  const isAdmin = session?.user?.role === "Admin";
  const [broadcasts, setBroadcasts] = useState([]);
  const [form, setForm] = useState({ audience: "All", title: "", message: "" });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState("newest");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/broadcasts");
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(errorMessage(body, "Failed to load broadcast history."));
      setBroadcasts(Array.isArray(body) ? body : []);
    } catch (loadError) {
      setError(loadError.message);
      setBroadcasts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (sessionStatus === "authenticated" && isAdmin) {
      void Promise.resolve().then(loadHistory);
    }
  }, [isAdmin, loadHistory, sessionStatus]);

  async function submit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/api/broadcasts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(errorMessage(body, "Broadcast failed."));
      setSuccess(`Broadcast delivered in-app to ${body.recipients} recipient(s).`);
      setForm((current) => ({ ...current, title: "", message: "" }));
      await loadHistory();
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (sessionStatus === "loading") {
    return <div className="flex justify-center" style={{ padding: "var(--space-3xl)" }}><div className="spinner spinner-lg" /></div>;
  }
  if (!isAdmin) {
    return <div className="card" role="alert"><h1 className="page-title">Broadcasts</h1><p>Admin access is required.</p></div>;
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Broadcasts</h1>
          <p className="page-subtitle">Send in-app and email announcements to an audience</p>
        </div>
      </div>

      {error && <div className="card" role="alert" style={{ color: "var(--danger)", marginBottom: "var(--space-lg)" }}>{error}</div>}
      {success && <div className="card" role="status" style={{ color: "var(--accent)", marginBottom: "var(--space-lg)" }}>{success}</div>}

      <form className="card" onSubmit={submit} style={{ marginBottom: "var(--space-xl)" }}>
        <h2 style={{ fontSize: "1.1rem", display: "flex", gap: 8, alignItems: "center" }}><Megaphone size={20} /> Compose announcement</h2>
        <div className="grid grid-2" style={{ marginTop: "var(--space-md)" }}>
          <div className="form-group">
            <label className="form-label" htmlFor="broadcast-audience">Audience</label>
            <select id="broadcast-audience" className="form-select" value={form.audience} onChange={(event) => setForm({ ...form, audience: event.target.value })}>
              {['All', 'Admin', 'Staff', 'Client'].map((audience) => <option key={audience}>{audience}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="broadcast-title">Title</label>
            <input id="broadcast-title" className="form-input" required maxLength={160} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
          </div>
        </div>
        <div className="form-group" style={{ marginTop: "var(--space-md)" }}>
          <label className="form-label" htmlFor="broadcast-message">Message</label>
          <textarea id="broadcast-message" className="form-input" required rows={6} maxLength={10000} value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} />
          <div className="text-xs text-muted" style={{ textAlign: "right" }}>{form.message.length}/10000</div>
        </div>
        <button className="btn btn-primary flex items-center gap-xs" type="submit" disabled={submitting} style={{ marginTop: "var(--space-md)" }}>
          <Send size={16} /> {submitting ? "Sending..." : "Send broadcast"}
        </button>
      </form>

      <div className="flex gap-sm items-center mb-lg" style={{ flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 250 }}>
          <Search size={16} className="text-muted" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
          <input
            type="text"
            className="form-input"
            style={{ paddingLeft: 36 }}
            placeholder="Search broadcasts by title..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
          />
        </div>

        <select 
          className="form-select" 
          style={{ width: 160 }}
          value={sortOrder}
          onChange={(e) => { setSortOrder(e.target.value); setCurrentPage(1); }}
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </select>

        {searchQuery && (
          <button
            className="btn btn-ghost"
            onClick={() => { setSearchQuery(""); setCurrentPage(1); }}
          >
            ✕ Clear
          </button>
        )}
      </div>

      <div className="card">
        <h2 style={{ fontSize: "1.1rem", marginBottom: "var(--space-md)" }}>History</h2>
        {loading ? <div className="spinner" role="status" aria-label="Loading broadcasts" /> : broadcasts.length ? (() => {
          const filteredBroadcasts = broadcasts.filter((b) => !searchQuery || b.title.toLowerCase().includes(searchQuery.toLowerCase()));
          
          const sortedBroadcasts = [...filteredBroadcasts].sort((a, b) => {
            const dateA = new Date(a.createdAt || 0).getTime();
            const dateB = new Date(b.createdAt || 0).getTime();
            return sortOrder === "newest" ? dateB - dateA : dateA - dateB;
          });

          const totalPages = Math.ceil(sortedBroadcasts.length / pageSize);
          const paginatedBroadcasts = sortedBroadcasts.slice((currentPage - 1) * pageSize, currentPage * pageSize);
          
          return (
          <div className="table-container">
            <table className="table">
              <thead><tr><th>Sent</th><th>Audience</th><th>Title</th><th>Status</th><th>Delivery</th></tr></thead>
              <tbody>{paginatedBroadcasts.map((broadcast) => (
                <tr key={broadcast.id}>
                  <td className="text-sm">{new Date(broadcast.createdAt).toLocaleString()}</td>
                  <td><span className="badge badge-primary">{broadcast.audience}</span></td>
                  <td><strong>{broadcast.title}</strong><div className="text-xs text-muted">by {broadcast.creator?.name || "Admin"}</div></td>
                  <td><span className={`badge ${broadcast.status === "failed" ? "badge-danger" : broadcast.status === "partial" ? "badge-warning" : "badge-success"}`}>{broadcast.status}</span></td>
                  <td className="text-sm">{broadcast.deliveryCounts?.sent || 0} sent · {broadcast.deliveryCounts?.skipped || 0} in-app only · {broadcast.deliveryCounts?.failed || 0} failed</td>
                </tr>
              ))}</tbody>
            </table>
            <div className="table-footer">
              <span className="text-sm text-muted">
                Showing {filteredBroadcasts.length === 0 ? 0 : ((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, filteredBroadcasts.length)} of {filteredBroadcasts.length} records
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
                  disabled={currentPage >= totalPages || totalPages === 0} 
                  onClick={() => setCurrentPage(p => p + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )
        })() : <p className="text-muted">No broadcasts have been sent.</p>}
      </div>
    </div>
  );
}
