"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, CheckCircle } from "lucide-react";

function getErrorMessage(body, fallback) {
  return body?.error?.message || body?.error || fallback;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [markingId, setMarkingId] = useState(null);

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

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Notifications</h1>
          <p className="page-subtitle">Updates about your request outcomes</p>
        </div>
      </div>

      {error && <div className="card" role="alert" style={{ marginBottom: "var(--space-lg)", color: "var(--danger)" }}>{error}</div>}

      {loading ? (
        <div className="flex justify-center" style={{ padding: "var(--space-3xl)" }} role="status" aria-label="Loading notifications">
          <div className="spinner spinner-lg" />
        </div>
      ) : notifications.length ? (
        <div className="flex flex-col gap-md">
          {notifications.map((notification) => {
            const isUnread = !notification.readAt;
            return (
              <article key={notification.id} className="card" style={{ borderLeft: isUnread ? "4px solid var(--primary)" : undefined }}>
                <div className="flex justify-between items-center gap-md" style={{ flexWrap: "wrap" }}>
                  <div className="flex items-center gap-md">
                    <div className="empty-state-icon" style={{ width: 42, height: 42, margin: 0 }}>
                      {isUnread ? <Bell size={20} aria-hidden="true" /> : <CheckCircle size={20} aria-hidden="true" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-sm" style={{ flexWrap: "wrap", marginBottom: 4 }}>
                        <span className={`badge ${isUnread ? "badge-primary" : "badge-muted"}`}>{isUnread ? "Unread" : "Read"}</span>
                        <span className={`badge ${notification.outcome === "approved" ? "badge-success" : "badge-danger"}`}>{notification.outcome}</span>
                      </div>

                      <h2 style={{ fontSize: "1rem", margin: 0 }}>Request {notification.referenceId}</h2>
                      <p className="text-sm text-muted" style={{ margin: "4px 0 0" }}>
                        Your request was {notification.outcome} on {new Date(notification.createdAt).toLocaleString()}.
                      </p>
                    </div>
                  </div>
                  {isUnread && (
                    <button
                      className="btn btn-ghost btn-sm"
                      type="button"
                      disabled={markingId === notification.id}
                      onClick={() => markAsRead(notification.id)}
                      aria-label={`Mark notification for request ${notification.referenceId} as read`}
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
          <h2 className="empty-state-title">No Notifications</h2>
          <p className="empty-state-text">Request outcome updates will appear here.</p>
        </div>
      )}
    </div>
  );
}
