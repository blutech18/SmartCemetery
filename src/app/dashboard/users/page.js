"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Users, Search, Pencil, UserCheck, UserX, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import { useBodyScrollLock } from "../../../lib/use-body-scroll-lock";

const ROLE_BADGE = { Admin: "badge-primary", Staff: "badge-warning", Client: "badge-muted" };
const ROLE_TO_TYPE_ID = { Admin: "1", Staff: "2", Client: "3" };
const EMPTY_FORM = { name: "", email: "", password: "", role: "Client" };

export default function UsersPage() {
  const { data: session, status: sessionStatus } = useSession();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [sortOrder, setSortOrder] = useState("newest");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const [showModal, setShowModal] = useState(false);
  useBodyScrollLock(showModal);
  const [editingUser, setEditingUser] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [pendingDisable, setPendingDisable] = useState(null);

  const isAdmin = session?.user?.role === "Admin";
  const currentUserId = session?.user?.id != null ? Number(session.user.id) : null;

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/users");
      if (!res.ok) throw new Error("Unable to load users");
      const data = await res.json();
      setUsers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Unable to load users");
    } finally {
      setLoading(false);
    }
  }, []);

  // Load the roster once the session resolves. The fetch is kept out of the
  // effect body so state updates happen in async callbacks, not synchronously.
  useEffect(() => {
    if (sessionStatus === "loading") return undefined;

    if (sessionStatus !== "authenticated" || !isAdmin) {
      const idle = setTimeout(() => setLoading(false), 0);
      return () => clearTimeout(idle);
    }

    const timer = setTimeout(() => { void fetchUsers(); }, 0);
    return () => clearTimeout(timer);
  }, [sessionStatus, isAdmin, fetchUsers]);

  function openCreate() {
    setEditingUser(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  }

  function openEdit(user) {
    setEditingUser(user);
    setForm({
      name: user.name || "",
      email: user.email || "",
      password: "",
      role: user.userType?.typeName || "Client",
    });
    setShowModal(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const isEdit = Boolean(editingUser);
      const url = isEdit ? `/api/users/${editingUser.id}` : "/api/users";
      const payload = isEdit
        ? {
            name: form.name,
            email: form.email,
            role: form.role,
            ...(form.password ? { password: form.password } : {}),
          }
        : {
            name: form.name,
            email: form.email,
            password: form.password,
            userTypeId: Number(ROLE_TO_TYPE_ID[form.role] || 3),
          };

      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || "Failed to save the user");

      toast.success(isEdit ? "User updated" : "User created");
      setShowModal(false);
      setEditingUser(null);
      setForm(EMPTY_FORM);
      await fetchUsers();
    } catch (error) {
      toast.error(error.message || "An error occurred");
    } finally {
      setSubmitting(false);
    }
  }

  function requestStatusChange(user) {
    // Enabling is non-destructive, so it applies immediately; disabling asks.
    if (user.status !== "active") {
      void applyStatus(user, "active");
      return;
    }
    setPendingDisable(user);
  }

  async function applyStatus(user, nextStatus) {
    setBusyId(user.id);
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || "Failed to update status");
      toast.success(nextStatus === "active" ? "Account enabled" : "Account disabled");
      await fetchUsers();
    } catch (error) {
      toast.error(error.message || "An error occurred");
    } finally {
      setBusyId(null);
      setPendingDisable(null);
    }
  }

  if (sessionStatus !== "loading" && !isAdmin) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon"><ShieldAlert size={48} /></div>
        <h3 className="empty-state-title">Admin access is required</h3>
        <p className="empty-state-text">You do not have permission to manage system users.</p>
      </div>
    );
  }

  const filteredUsers = users.filter((u) => {
    const matchesSearch = !searchQuery ||
      (u.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.email || "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = !statusFilter || u.status === statusFilter;
    const matchesRole = !roleFilter || u.userType?.typeName === roleFilter;
    return matchesSearch && matchesStatus && matchesRole;
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
          <p className="page-subtitle">Manage system users, roles, and account access</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate} id="add-user-btn">
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
            aria-label="Search users"
          />
        </div>
        <select
          className="form-select"
          value={roleFilter}
          onChange={(e) => { setRoleFilter(e.target.value); setCurrentPage(1); }}
          style={{ width: 150 }}
          aria-label="Filter by role"
        >
          <option value="">All Roles</option>
          <option value="Admin">Admin</option>
          <option value="Staff">Staff</option>
          <option value="Client">Client</option>
        </select>
        <select
          className="form-select"
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
          style={{ width: 150 }}
          aria-label="Filter by status"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="disabled">Disabled</option>
        </select>
        <select
          className="form-select"
          style={{ width: 150 }}
          value={sortOrder}
          onChange={(e) => { setSortOrder(e.target.value); setCurrentPage(1); }}
          aria-label="Sort order"
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </select>

        {(searchQuery || statusFilter || roleFilter) && (
          <button
            className="btn btn-ghost"
            onClick={() => { setSearchQuery(""); setStatusFilter(""); setRoleFilter(""); }}
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
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedUsers.map((user) => {
                const isSelf = currentUserId === user.id;
                const roleName = user.userType?.typeName || "Client";
                return (
                  <tr key={user.id}>
                    <td>
                      <div className="flex items-center gap-md">
                        <div className="avatar" style={{ width: 32, height: 32, fontSize: "0.7rem" }}>
                          {user.name?.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                        </div>
                        <span style={{ fontWeight: 600 }}>{user.name}</span>
                        {isSelf && <span className="badge badge-info">You</span>}
                      </div>
                    </td>
                    <td className="text-sm">{user.email}</td>
                    <td>
                      <span className={`badge ${ROLE_BADGE[roleName] || "badge-muted"}`}>{roleName}</span>
                    </td>
                    <td>
                      <span className={`badge ${user.status === "active" ? "badge-success" : "badge-danger"}`}>
                        {user.status}
                      </span>
                    </td>
                    <td className="text-sm text-muted">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td>
                      <div className="table-actions justify-center">
                        <button
                          className="icon-action"
                          onClick={() => openEdit(user)}
                          title="Edit user"
                          aria-label={`Edit ${user.name}`}
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          className={`icon-action ${user.status === "active" ? "danger" : "success"}`}
                          onClick={() => requestStatusChange(user)}
                          disabled={isSelf || busyId === user.id}
                          title={isSelf ? "You cannot disable your own account" : user.status === "active" ? "Disable account" : "Enable account"}
                          aria-label={`${user.status === "active" ? "Disable" : "Enable"} ${user.name}`}
                        >
                          {user.status === "active" ? <UserX size={16} /> : <UserCheck size={16} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="table-footer">
            <span className="text-sm text-muted">
              Showing {filteredUsers.length === 0 ? 0 : ((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, filteredUsers.length)} of {filteredUsers.length} records
            </span>
            <div className="flex gap-sm">
              <button
                className="btn btn-secondary btn-sm"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => p - 1)}
              >
                Previous
              </button>
              <button
                className="btn btn-secondary btn-sm"
                disabled={currentPage >= totalPages || totalPages === 0}
                onClick={() => setCurrentPage((p) => p + 1)}
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

      <ConfirmDialog
        open={Boolean(pendingDisable)}
        title="Disable this account?"
        description={
          pendingDisable
            ? `${pendingDisable.name} (${pendingDisable.email}) will be signed out and blocked from signing in. Their records and history are preserved, and you can re-enable the account at any time.`
            : ""
        }
        confirmLabel="Disable account"
        busy={busyId === pendingDisable?.id}
        onConfirm={() => applyStatus(pendingDisable, "disabled")}
        onCancel={() => setPendingDisable(null)}
      />

      {/* Add / Edit User Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editingUser ? "Edit User" : "Add User"}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)} aria-label="Close">✕</button>
            </div>
            <form className="modal-body" onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label" htmlFor="user-form-name">Full Name *</label>
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
                <label className="form-label" htmlFor="user-form-email">Email *</label>
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
                <label className="form-label" htmlFor="user-form-password">
                  {editingUser ? "New Password (leave blank to keep current)" : "Password *"}
                </label>
                <input
                  type="password"
                  className="form-input"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required={!editingUser}
                  minLength={8}
                  id="user-form-password"
                  autoComplete="new-password"
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="user-form-role">Role *</label>
                <select
                  className="form-select"
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  id="user-form-role"
                  disabled={Boolean(editingUser) && currentUserId === editingUser.id}
                >
                  <option value="Admin">Admin</option>
                  <option value="Staff">Staff</option>
                  <option value="Client">Client</option>
                </select>
                {editingUser && currentUserId === editingUser.id && (
                  <p className="text-xs text-muted" style={{ marginTop: 4 }}>
                    You cannot change your own role.
                  </p>
                )}
              </div>
              <div className="flex gap-sm" style={{ marginTop: "0.75rem" }}>
                <button type="button" className="btn btn-ghost" style={{ flex: 1, justifyContent: "center" }} onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1, justifyContent: "center" }} disabled={submitting} id="user-form-submit">
                  {submitting ? "Saving..." : editingUser ? "Save Changes" : "Save User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
