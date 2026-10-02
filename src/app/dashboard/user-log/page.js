"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, ScrollText, Search } from "lucide-react";
import { categoryLabel, categoryOf, describeAction, formatDetail } from "@/lib/user-log";

const PAGE_SIZE = 25;

/** Local start/end of a `YYYY-MM-DD` day as ISO timestamps (so filters follow the admin's clock). */
function dayBounds(value, end) {
  if (!value) return null;
  const [y, m, d] = value.split("-").map(Number);
  const date = end ? new Date(y, m - 1, d, 23, 59, 59, 999) : new Date(y, m - 1, d, 0, 0, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function formatWhen(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "medium" });
}

function actionBadge(key) {
  if (key === "auth.login_failed" || key === "auth.login_blocked") return "badge-danger";
  if (key === "auth.login" || key === "auth.logout") return "badge-success";
  if (key.endsWith(".delete")) return "badge-warning";
  return "badge-info";
}

export default function UserLogPage() {
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [category, setCategory] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);

  // Wait for the admin to stop typing before querying.
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQuery(query.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (debouncedQuery) params.set("q", debouncedQuery);
      if (category) params.set("category", category);
      const fromIso = dayBounds(from, false);
      const toIso = dayBounds(to, true);
      if (fromIso) params.set("from", fromIso);
      if (toIso) params.set("to", toIso);

      const res = await fetch(`/api/user-logs?${params}`, { cache: "no-store" });
      if (!res.ok) {
        setError(res.status === 403 ? "Only administrators can view the user log." : "The user log could not be loaded.");
        setLogs([]);
        return;
      }
      const data = await res.json();
      setLogs(data.logs || []);
      setPagination(data.pagination || { page: 1, total: 0, totalPages: 0 });
      setCategories(data.categories || []);
    } catch (err) {
      console.error(err);
      setError("The user log could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [page, debouncedQuery, category, from, to]);

  useEffect(() => {
    void Promise.resolve().then(fetchLogs);
  }, [fetchLogs]);

  const filtered = Boolean(debouncedQuery || category || from || to);
  const firstShown = pagination.total === 0 ? 0 : (pagination.page - 1) * PAGE_SIZE + 1;
  const lastShown = Math.min(pagination.page * PAGE_SIZE, pagination.total);
  const categoryOptions = useMemo(() => categories.map((c) => ({ value: c, label: categoryLabel(c) })), [categories]);

  function clearFilters() {
    setQuery("");
    setDebouncedQuery("");
    setCategory("");
    setFrom("");
    setTo("");
    setPage(1);
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--space-md)", flexWrap: "wrap" }}>
        <div>
          <h1 className="page-title">User Log</h1>
          <p className="page-subtitle">Who signed in and what each user changed, with date, time and IP address</p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={fetchLogs} disabled={loading} id="user-log-refresh">
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      <div className="flex gap-sm items-center mb-lg" style={{ flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 240 }}>
          <Search size={16} className="text-muted" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
          <input
            type="text"
            className="form-input"
            style={{ paddingLeft: 36 }}
            placeholder="Search by user name, email, action or IP address..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search the user log"
            id="user-log-search"
          />
        </div>

        <select
          className="form-select"
          style={{ width: 200 }}
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setPage(1);
          }}
          aria-label="Filter by type of activity"
          id="user-log-category"
        >
          <option value="">All activity</option>
          {categoryOptions.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>

        <label className="flex items-center gap-xs text-sm text-muted">
          From
          <input
            type="date"
            className="form-input"
            value={from}
            max={to || undefined}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(1);
            }}
            id="user-log-from"
          />
        </label>
        <label className="flex items-center gap-xs text-sm text-muted">
          To
          <input
            type="date"
            className="form-input"
            value={to}
            min={from || undefined}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(1);
            }}
            id="user-log-to"
          />
        </label>

        {filtered && (
          <button type="button" className="btn btn-ghost" onClick={clearFilters}>
            ✕ Clear
          </button>
        )}
      </div>

      {error && (
        <div className="alert alert-danger" role="alert" style={{ marginBottom: "var(--space-md)" }}>
          {error}
        </div>
      )}

      {loading && logs.length === 0 ? (
        <div className="flex justify-center" style={{ padding: "var(--space-3xl)" }}>
          <div className="spinner spinner-lg" />
        </div>
      ) : logs.length > 0 ? (
        <div className="table-container" style={{ opacity: loading ? 0.6 : 1 }}>
          <table className="table" id="user-log-table">
            <thead>
              <tr>
                <th>When</th>
                <th style={{ textAlign: "left" }}>User</th>
                <th style={{ textAlign: "left" }}>Activity</th>
                <th>IP address</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => {
                const { key, label, detail } = describeAction(log.action);
                return (
                  <tr key={log.id}>
                    <td style={{ whiteSpace: "nowrap" }}>{formatWhen(log.createdAt)}</td>
                    <td style={{ textAlign: "left" }}>
                      {log.user ? (
                        <>
                          <div style={{ fontWeight: 600 }}>{log.user.name}</div>
                          <div className="text-sm text-muted">
                            {log.user.email}
                            {log.user.role ? ` · ${log.user.role}` : ""}
                          </div>
                        </>
                      ) : (
                        <span className="text-muted">Unknown account</span>
                      )}
                    </td>
                    <td style={{ textAlign: "left" }}>
                      <span className={`badge ${actionBadge(key)}`}>{label}</span>
                      <div className="text-sm text-muted" style={{ marginTop: 2 }}>
                        {categoryLabel(categoryOf(log.action))}
                        {detail ? ` · ${formatDetail(detail)}` : ""}
                      </div>
                    </td>
                    <td style={{ fontFamily: "var(--font-mono)" }}>{log.ipAddress || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="table-footer">
            <span className="text-sm text-muted">
              Showing {firstShown} to {lastShown} of {pagination.total} entries
            </span>
            <div className="flex gap-sm">
              <button className="btn btn-secondary btn-sm" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>
                Previous
              </button>
              <button
                className="btn btn-secondary btn-sm"
                disabled={page >= pagination.totalPages || loading}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      ) : (
        !error && (
          <div className="empty-state">
            <div className="empty-state-icon">
              <ScrollText size={48} />
            </div>
            <h3 className="empty-state-title">No Activity Found</h3>
            <p className="empty-state-text">
              {filtered ? "No entries match your filters." : "Nothing has been recorded yet."}
            </p>
          </div>
        )
      )}
    </div>
  );
}
