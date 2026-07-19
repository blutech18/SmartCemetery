"use client";

import { useState, useEffect } from "react";
import { Users, Search } from "lucide-react";

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortOrder, setSortOrder] = useState("newest");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
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

  const filteredUsers = users.filter((u) => {
    const matchesSearch = !searchQuery || 
      (u.name || "").toLowerCase().includes(searchQuery.toLowerCase()) || 
      (u.email || "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = !statusFilter || u.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const sortedUsers = [...filteredUsers].sort((a, b) => {
    const dateA = new Date(a.createdAt || 0).getTime();
    const dateB = new Date(b.createdAt || 0).getTime();
    return sortOrder === "newest" ? dateB - dateA : dateA - dateB;
  });

  const totalPages = Math.ceil(sortedUsers.length / pageSize);
  const paginatedUsers = sortedUsers.slice((currentPage - 1) * pageSize, currentPage * pageSize);

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

      <div className="flex gap-sm items-center mb-lg" style={{ flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 250 }}>
          <Search size={16} className="text-muted" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
          <input
            type="text"
            className="form-input"
            style={{ paddingLeft: 36 }}
            placeholder="Search users by name or email..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
          />
        </div>
        <select
          className="form-select"
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
          style={{ width: 160 }}
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>

        <select 
          className="form-select" 
          style={{ width: 160 }}
          value={sortOrder}
          onChange={(e) => { setSortOrder(e.target.value); setCurrentPage(1); }}
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </select>

        {(searchQuery || statusFilter) && (
          <button
            className="btn btn-ghost"
            onClick={() => { setSearchQuery(""); setStatusFilter(""); }}
          >
            ✕ Clear
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center" style={{ padding: "var(--space-3xl)" }}>
          <div className="spinner spinner-lg" />
        </div>
      ) : filteredUsers.length > 0 ? (
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
              {paginatedUsers.map((user) => (
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
          <div className="flex justify-between items-center" style={{ padding: "var(--space-md) var(--space-lg)", borderTop: "1px solid var(--color-border)" }}>
            <span className="text-sm text-muted">
              Showing {filteredUsers.length === 0 ? 0 : ((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, filteredUsers.length)} of {filteredUsers.length} records
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
      ) : (
        <div className="empty-state">
          <div className="empty-state-icon">
            <Users size={48} />
          </div>
          <h3 className="empty-state-title">No Users Found</h3>
          <p className="empty-state-text">No users match your current filters.</p>
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
