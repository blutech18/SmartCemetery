"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, CheckCircle, Search, AlertTriangle } from "lucide-react";

function getErrorMessage(body, fallback) {
  return body?.error?.message || body?.error || fallback;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [markingId, setMarkingId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [readFilter, setReadFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/notifications");
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(getErrorMessage(body, "Failed to load notifications."));
      setNotifications(Array.isArray(body) ? body : []);
    } catch (notificationError) {
      setNotifications([]);
      setError(notificationError.message || "Failed to load notifications.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(fetchNotifications);
  }, [fetchNotifications]);

  async function markAsRead(id) {
    setMarkingId(id);
    setError("");
    try {
      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(getErrorMessage(body, "Failed to mark notification as read."));
      setNotifications((current) => current.map((notification) => (
        notification.id === id ? { ...notification, readAt: new Date().toISOString() } : notification
      )));
    } catch (notificationError) {
      setError(notificationError.message || "Failed to mark notification as read.");
    } finally {
      setMarkingId(null);
    }
  }

  const unreadCount = notifications.filter((n) => !n.readAt).length;

  const visibleNotifications = notifications.filter((notification) => {
    const term = searchQuery.trim().toLowerCase();
    const matchesSearch = !term ||
      (notification.title || "").toLowerCase().includes(term) ||
      (notification.message || "").toLowerCase().includes(term) ||
      (notification.referenceId || "").toLowerCase().includes(term);
    const matchesRead = !readFilter ||
      (readFilter === "unread" ? !notification.readAt : Boolean(notification.readAt));
    const matchesCategory = !categoryFilter || notification.category === categoryFilter;
    return matchesSearch && matchesRead && matchesCategory;
  });

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Notifications</h1>
          <p className="page-subtitle">
            {unreadCount > 0
              ? `${unreadCount} unread announcement${unreadCount === 1 ? "" : "s"} and request update${unreadCount === 1 ? "" : "s"}`
              : "Announcements and request updates"}
          </p>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger flex items-center gap-sm" role="alert" style={{ marginBottom: "var(--space-lg)" }}>
          <AlertTriangle size={18} aria-hidden="true" />
          <span style={{ flex: 1 }}>{error}</span>
          <button className="btn btn-ghost btn-sm" onClick={fetchNotifications}>Retry</button>
        </div>
      )}

      {/* Filter row — matches the admin table pattern */}
      <div className="flex gap-sm items-center mb-lg" style={{ flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 250 }}>
          <Search size={16} className="text-muted" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
          <input
            type="text"
            className="form-input"
            style={{ paddingLeft: 36 }}
            placeholder="Search notifications..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search notifications"
          />
        </div>
        <select
          className="form-select"
          style={{ width: 150 }}
          value={readFilter}
          onChange={(e) => setReadFilter(e.target.value)}
          aria-label="Filter by read state"
        >
          <option value="">All States</option>
          <option value="unread">Unread</option>
          <option value="read">Read</option>
        </select>
        <select
          className="form-select"
          style={{ width: 150 }}
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          aria-label="Filter by category"
        >
          <option value="">All Types</option>
          <option value="broadcast">Broadcast</option>
          <option value="request_outcome">Request</option>
        </select>
        {(searchQuery || readFilter || categoryFilter) && (
          <button
            className="btn btn-ghost"
            onClick={() => { setSearchQuery(""); setReadFilter(""); setCategoryFilter(""); }}
          >
            ✕ Clear
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center" style={{ padding: "var(--space-3xl)" }} role="status" aria-label="Loading notifications">
          <div className="spinner spinner-lg" />
        </div>
      ) : visibleNotifications.length ? (
        <div className="flex flex-col gap-md">
          <p className="text-sm text-muted" style={{ margin: 0 }}>
            Showing {visibleNotifications.length} of {notifications.length} notifications
          </p>
          {visibleNotifications.map((notification) => {
            const isUnread = !notification.readAt;
            return (
              <article key={notification.id} className="card" style={{ borderLeft: isUnread ? "4px solid var(--primary)" : undefined }}>
                <div className="flex justify-between items-center gap-md" style={{ flexWrap: "wrap" }}>
                  <div className="flex items-center gap-md">
                    <div className={`stat-icon ${isUnread ? "stat-icon-primary" : "stat-icon-accent"}`} style={{ width: 42, height: 42, marginBottom: 0, flexShrink: 0 }}>
                      {isUnread ? <Bell size={20} aria-hidden="true" /> : <CheckCircle size={20} aria-hidden="true" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-sm" style={{ flexWrap: "wrap", marginBottom: 4 }}>
                        <span className={`badge ${isUnread ? "badge-primary" : "badge-muted"}`}>{isUnread ? "Unread" : "Read"}</span>
                        <span className="badge badge-muted">{notification.category === "broadcast" ? "Broadcast" : "Request"}</span>
                        {notification.outcome && <span className={`badge ${notification.outcome === "approved" ? "badge-success" : "badge-danger"}`}>{notification.outcome}</span>}
                      </div>

                      <h2 style={{ fontSize: "1rem", margin: 0 }}>{notification.title || "Notification"}</h2>
                      <p className="text-sm text-muted" style={{ margin: "4px 0 0" }}>
                        {notification.message || (notification.referenceId ? `Your request ${notification.referenceId} was ${notification.outcome}.` : "You have a new notification.")} · {new Date(notification.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  {isUnread && (
                    <button
                      className="btn btn-ghost btn-sm"
                      type="button"
                      disabled={markingId === notification.id}
                      onClick={() => markAsRead(notification.id)}
                      aria-label={`Mark ${notification.title || "notification"} as read`}
                    >
                      {markingId === notification.id ? "Marking..." : "Mark as read"}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-state-icon"><Bell size={48} aria-hidden="true" /></div>
          <h3 className="empty-state-title">
            {notifications.length === 0 ? "No Notifications" : "No Matching Notifications"}
          </h3>
          <p className="empty-state-text">
            {notifications.length === 0
              ? "Announcements and request updates will appear here."
              : "No notifications match your current filters."}
          </p>
        </div>
      )}
    </div>
  );
}
