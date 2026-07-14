"use client";

import { useState, useEffect } from "react";
import { Users } from "lucide-react";

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    userTypeId: "3",
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    setLoading(true);
    try {
      const res = await fetch("/api/users");
      const data = await res.json();
      setUsers(data || []);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          userTypeId: parseInt(form.userTypeId),
        }),
      });

      if (res.ok) {
        setShowModal(false);
        setForm({ name: "", email: "", password: "", userTypeId: "3" });
        fetchUsers();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to create user");
      }
    } catch {
      alert("An error occurred");
    }
    setSubmitting(false);
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">User Management</h1>
          <p className="page-subtitle">Manage system users and role assignments</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)} id="add-user-btn">
          + Add User
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center" style={{ padding: "var(--space-3xl)" }}>
          <div className="spinner spinner-lg" />
        </div>
      ) : users.length > 0 ? (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>
                    <div className="flex items-center gap-md">
                      <div className="avatar" style={{ width: 32, height: 32, fontSize: "0.7rem" }}>
                        {user.name?.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                      </div>
                      <span style={{ fontWeight: 600 }}>{user.name}</span>
                    </div>
                  </td>
                  <td className="text-sm">{user.email}</td>
                  <td>
                    <span
                      className={`badge ${
                        user.userType?.typeName === "Admin"
                          ? "badge-primary"
                          : user.userType?.typeName === "Staff"
                          ? "badge-warning"
                          : "badge-muted"
                      }`}
                    >
                      {user.userType?.typeName || "Client"}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`badge ${
                        user.status === "active" ? "badge-success" : "badge-danger"
                      }`}
                    >
                      {user.status}
                    </span>
                  </td>
                  <td className="text-sm text-muted">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-state-icon">
            <Users size={48} />
          </div>
          <h3 className="empty-state-title">No Users</h3>
          <p className="empty-state-text">Add users to manage the system.</p>
        </div>
      )}

      {/* Add User Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Add User</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form className="modal-body" onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input
                  type="text"
                  className="form-input"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  id="user-form-name"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Email *</label>
                <input
                  type="email"
                  className="form-input"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                  id="user-form-email"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Password *</label>
                <input
                  type="password"
                  className="form-input"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                  minLength={6}
                  id="user-form-password"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Role *</label>
                <select
                  className="form-select"
                  value={form.userTypeId}
                  onChange={(e) => setForm({ ...form, userTypeId: e.target.value })}
                  id="user-form-role"
                >
                  <option value="1">Admin</option>
                  <option value="2">Staff</option>
                  <option value="3">Client</option>
                </select>
              </div>
              <div className="flex gap-sm" style={{ marginTop: "var(--space-xl)" }}>
                <button type="button" className="btn btn-ghost" style={{ flex: 1, justifyContent: "center" }} onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1, justifyContent: "center" }} disabled={submitting} id="user-form-submit">
                  {submitting ? "Saving..." : "Save User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
