/**
 * UsersPage.jsx
 * NU Lipa / Sinag-Bughaw — Admin Panel
 * User Management: view, search, filter, suspend, approve, disapprove, role-assign
 *
 * API: GET    /api/admin/users
 *      GET    /api/admin/users/{id}
 *      PATCH  /api/admin/users/{id}
 *      PATCH  /api/admin/users/{id}/suspend
 *      PATCH  /api/admin/users/{id}/unsuspend
 *      PATCH  /api/admin/users/{id}/approve
 *      PATCH  /api/admin/users/{id}/disapprove
 *      DELETE /api/admin/users/{id}
 *      POST   /api/admin/users/{id}/reset-password
 */

import { useCallback, useEffect, useRef, useState } from "react";
import api, { notifyAdminAccountsChanged } from "../services/api";

const cx = (...v) => v.filter(Boolean).join(" ");

const Skeleton = ({ className = "", style }) => (
  <div
    style={style}
    className={cx(
      "animate-pulse rounded-md bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 bg-[length:200%_100%]",
      className,
    )}
  />
);

function Badge({ label, tone = "default" }) {
  const tones = {
    indigo: "bg-indigo-50 text-indigo-700",
    violet: "bg-violet-50 text-violet-700",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-700",
    emerald: "bg-emerald-50 text-emerald-700",
    default: "bg-slate-100 text-slate-600",
  };
  return (
    <span className={cx("inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold", tones[tone] ?? tones.default)}>
      {label}
    </span>
  );
}

function standingBadge(user) {
  const role = String(user.role || "").toLowerCase();
  if (role === "faculty" || role === "admin") return <span className="text-xs text-slate-400">—</span>;
  const alumni = Boolean(user.is_alumni)
    || role === "alumni"
    || user.academic_status === "Alumni";
  return roleBadge(alumni ? "alumni" : "student", alumni ? "Alumni" : "Current Student");
}

function roleBadge(role, label) {
  const map = {
    student: { label: "Student", tone: "indigo" },
    alumni: { label: "Alumni", tone: "emerald" },
    faculty: { label: "Faculty", tone: "violet" },
    admin: { label: "Admin", tone: "amber" },
  };
  const s = map[role] ?? { label: role ?? "—", tone: "default" };
  return <Badge label={label || s.label} tone={s.tone} />;
}

function approvalStatus(user) {
  const status = String(user.status || "").toLowerCase();
  if (status === "approved" || status === "disapproved" || status === "pending") return status;
  return user.email_verified ? "approved" : "pending";
}

function statusBadge(user) {
  const status = approvalStatus(user);
  const approval = status === "approved"
    ? <Badge label="Approved" tone="emerald" />
    : status === "disapproved"
      ? <Badge label="Disapproved" tone="red" />
      : <Badge label="Pending" tone="amber" />;

  return (
    <>
      {approval}
      {user.suspended_at && <Badge label="Suspended" tone="red" />}
    </>
  );
}

function hasName(user) {
  return Boolean(`${user.first_name ?? ""}${user.last_name ?? ""}`.trim());
}

function hasStudentRecord(user) {
  return Boolean(user.student_id || user.course || user.batch || user.graduation_year);
}

function statusBadges(user) {
  const incomplete = !hasStudentRecord(user);
  return (
    <div className="flex flex-wrap gap-1.5">
      {statusBadge(user)}
      {incomplete && <Badge label="Incomplete" tone="default" />}
    </div>
  );
}

function Avatar({ user, size = 36 }) {
  const initials = [user.first_name?.[0], user.last_name?.[0]].filter(Boolean).join("").toUpperCase() || "?";
  if (user.profile_picture || user.avatar) {
    return (
      <img
        src={user.profile_picture ?? user.avatar}
        alt={initials}
        style={{ width: size, height: size }}
        className="shrink-0 rounded-full border-2 border-slate-200 object-cover"
        onError={(e) => {
          e.target.style.display = "none";
        }}
      />
    );
  }
  return (
    <div
      style={{ width: size, height: size, fontSize: `${size * 0.33}px` }}
      className="grid shrink-0 place-items-center rounded-full border-2 border-indigo-200 bg-indigo-50 font-extrabold text-indigo-700"
    >
      {initials}
    </div>
  );
}

function Toast({ toasts }) {
  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2.5">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cx(
            "rounded-xl border px-4 py-3 text-sm font-semibold shadow-lg",
            t.type === "error" && "border-red-300 bg-red-50 text-red-700",
            t.type === "warn" && "border-amber-300 bg-amber-50 text-amber-700",
            t.type !== "error" && t.type !== "warn" && "border-emerald-300 bg-emerald-50 text-emerald-700",
          )}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}

function useToast() {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((message, type = "success") => {
    const id = Date.now();
    setToasts((p) => [...p, { id, message, type }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 3000);
  }, []);
  return { toasts, push };
}

function ConfirmModal({ open, title, message, confirmLabel, confirmColor, onConfirm, onCancel, loading }) {
  if (!open) return null;
  const confirmTone =
    confirmColor === "warning" ? "bg-amber-600 hover:bg-amber-700" :
    confirmColor === "success" ? "bg-emerald-600 hover:bg-emerald-700" :
    confirmColor === "danger" ? "bg-red-600 hover:bg-red-700" :
    "bg-indigo-600 hover:bg-indigo-700";

  return (
    <div className="fixed inset-0 z-[1000] grid place-items-center bg-slate-900/55 p-4" onClick={onCancel}>
      <div className="w-full max-w-md rounded-2xl bg-white p-7 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 text-lg font-extrabold text-slate-800">{title}</div>
        <div className="mb-6 text-sm leading-relaxed text-slate-500">{message}</div>
        <div className="flex justify-end gap-2.5">
          <button
            onClick={onCancel}
            disabled={loading}
            className="rounded-lg border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-500 transition hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={cx("rounded-lg px-5 py-2 text-sm font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-70", confirmTone)}
          >
            {loading ? "Processing…" : confirmLabel ?? "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}

function UserModal({ user, onClose, onSaved, toast }) {
  const initialVisibility = user.profile_visibility === "alumni_only"
    ? "batchmates"
    : (user.profile_visibility ?? "public");
  const [form, setForm] = useState({ role: user.role ?? "student", profile_visibility: initialVisibility });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      await api.patch(`/admin/users/${user.id}`, form);
      toast("User updated successfully.");
      onSaved();
    } catch {
      toast("Failed to update user.", "error");
    } finally {
      setSaving(false);
    }
  };

  const Field = ({ label, children }) => (
    <div className="mb-4">
      <label className="mb-1.5 block text-xs font-semibold text-slate-500">{label}</label>
      {children}
    </div>
  );

  return (
    <div className="fixed inset-0 z-[1000] grid place-items-center bg-slate-900/55 p-4" onClick={onClose}>
      <div className="w-full max-w-xl overflow-hidden rounded-3xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3.5 border-b border-slate-200 px-7 py-5">
          <Avatar user={user} size={48} />
          <div>
            <div className="text-base font-extrabold text-slate-800">{user.first_name} {user.last_name}</div>
            <div className="text-xs text-slate-500">{user.email}</div>
          </div>
          <button onClick={onClose} className="ml-auto text-2xl leading-none text-slate-500 transition hover:text-slate-700">×</button>
        </div>

        <div className="px-7 py-6">
          <div className="mb-5 grid grid-cols-1 gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-2">
            {[
              ["Student ID", user.student_id ?? "—"],
              ["Course", user.course ?? "—"],
              ["Batch", user.batch ?? "—"],
              ["Grad Year",  user.graduation_year ?? "—"],
              ["Consent", user.consent_accepted ? "Accepted" : "Not Accepted"],
              ["SSO", user.google_id ? "Google" : "Email/Password"],
            ].map(([k, v]) => (
              <div key={k}>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{k}</div>
                <div className="mt-0.5 text-sm font-semibold text-slate-800">{v}</div>
              </div>
            ))}
          </div>

          <Field label="Role">
            <select
              value={form.role}
              onChange={(e) => set("role", e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
            >
              <option value="student">Student</option>
              <option value="alumni">Alumni</option>
              <option value="faculty">Faculty</option>
              <option value="admin">Admin</option>
            </select>
          </Field>
          <Field label="Profile Visibility">
            <select
              value={form.profile_visibility}
              onChange={(e) => set("profile_visibility", e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
            >
              <option value="public">Public</option>
              <option value="batchmates">Batchmates Only</option>
              <option value="private">Private</option>
            </select>
          </Field>
        </div>

        <div className="flex justify-end gap-2.5 px-7 pb-6">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-500 transition hover:bg-slate-50"
          >
            Close
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-bold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ActionMenu({ user, onEdit, onSuspend, onUnsuspend, onApprove, onDisapprove, onResetPw, onDelete }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const Item = ({ label, color, onClick, disabled }) => (
    <button
      disabled={disabled}
      onClick={() => {
        setOpen(false);
        onClick();
      }}
      className={cx(
        "block w-full px-4 py-2 text-left text-sm font-semibold transition",
        disabled ? "cursor-not-allowed text-slate-400" : "cursor-pointer text-slate-700 hover:bg-slate-50",
        color === "warning" && "text-amber-700",
        color === "danger" && "text-red-700",
      )}
    >
      {label}
    </button>
  );

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((p) => !p)}
        className="rounded-lg border border-slate-200 px-2.5 py-1 text-lg leading-none text-slate-500 transition hover:bg-slate-50"
      >
        ⋯
      </button>
      {open && (
        <div className="absolute right-0 top-[110%] z-50 min-w-[170px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          <Item label="Edit / View" onClick={onEdit} />
          {user.suspended_at
            ? <Item label="Unsuspend" onClick={onUnsuspend} />
            : <Item label="Suspend" onClick={onSuspend} color="warning" />
          }
          {approvalStatus(user) !== "approved" && <Item label="Approve" onClick={onApprove} />}
          {approvalStatus(user) !== "disapproved" && <Item label="Disapprove" onClick={onDisapprove} color="danger" />}
          <Item label="Reset Password" onClick={onResetPw} />
          <div className="my-1 h-px bg-slate-200" />
          <Item label="Delete" onClick={onDelete} color="danger" />
        </div>
      )}
    </div>
  );
}

function Pagination({ meta, onPage }) {
  if (!meta || meta.last_page <= 1) return null;
  const { current_page: cur, last_page: last } = meta;

  const pages = [];
  for (let i = Math.max(1, cur - 2); i <= Math.min(last, cur + 2); i++) pages.push(i);

  const Btn = ({ label, page, disabled, active }) => (
    <button
      onClick={() => !disabled && onPage(page)}
      className={cx(
        "rounded-lg border px-3 py-1.5 text-sm font-semibold transition",
        active ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
        disabled && "cursor-default opacity-40",
      )}
    >
      {label}
    </button>
  );

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-2.5">
      <div className="text-sm font-medium text-slate-500">
        Showing {meta.from}–{meta.to} of {meta.total} users
      </div>
      <div className="flex gap-1.5">
        <Btn label="←" page={cur - 1} disabled={cur === 1} />
        {pages.map((p) => <Btn key={p} label={p} page={p} active={p === cur} />)}
        <Btn label="→" page={cur + 1} disabled={cur === last} />
      </div>
    </div>
  );
}

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [meta, setMeta] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [editUser, setEditUser] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [actLoading, setActLoading] = useState(false);

  const { toasts, push: toast } = useToast();
  const searchTimer = useRef(null);

  const fetchUsers = useCallback(async (p = 1, q = search, role = roleFilter, status = statusFilter) => {
    setLoading(true);
    try {
      const params = { page: p, per_page: 15 };
      if (q)      params.search = q;
      if (role)   params.role   = role;
      if (status) params.status = status;

      const res = await api.get("/admin/users", { params });
      setUsers(res.data.data ?? []);
      setMeta(res.data.meta ?? res.data);
      setSummary(res.data.summary ?? null);
    } catch {
      toast("Failed to load users.", "error");
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter, statusFilter]);

  useEffect(() => {
    fetchUsers(page);
  }, [page]);

  const handleSearch = (v) => {
    setSearch(v);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setPage(1);
      fetchUsers(1, v, roleFilter, statusFilter);
    }, 400);
  };

  const handleFilter = (type, v) => {
    if (type === "role") {
      setRoleFilter(v);
      setPage(1);
      fetchUsers(1, search, v, statusFilter);
    }
    if (type === "status") {
      setStatusFilter(v);
      setPage(1);
      fetchUsers(1, search, roleFilter, v);
    }
  };

  const doAction = async () => {
    if (!confirm) return;
    setActLoading(true);
    const { type, user } = confirm;
    try {
      let response = null;
      if (type === "suspend")    response = await api.patch(`/admin/users/${user.id}/suspend`);
      if (type === "unsuspend")  response = await api.patch(`/admin/users/${user.id}/unsuspend`);
      if (type === "approve")    response = await api.patch(`/admin/users/${user.id}/approve`);
      if (type === "disapprove") response = await api.patch(`/admin/users/${user.id}/disapprove`);
      if (type === "resetpw")    response = await api.post(`/admin/users/${user.id}/reset-password`);
      if (type === "delete")     response = await api.delete(`/admin/users/${user.id}`);

      const msgs = {
        suspend: "User suspended.",
        unsuspend: "User unsuspended.",
        approve: "User approved.",
        disapprove: "User disapproved.",
        resetpw: "Password reset email sent.",
        delete: "User deleted.",
      };
      toast(response?.data?.message || msgs[type]);
      if (response?.data?.data && type !== "delete") {
        setUsers(prev => prev.map(item => item.id === user.id ? { ...item, ...response.data.data } : item));
      }
      setConfirm(null);
      fetchUsers(page, search, roleFilter, statusFilter);
      if (type === "delete" || type === "approve" || type === "disapprove") notifyAdminAccountsChanged();
    } catch {
      toast("Action failed. Please try again.", "error");
    } finally {
      setActLoading(false);
    }
  };

  const confirmMap = {
    suspend: { title: "Suspend User", message: (u) => `Suspend ${u.first_name} ${u.last_name}? They won't be able to log in.`, label: "Suspend", color: "warning" },
    unsuspend: { title: "Unsuspend User", message: (u) => `Re-activate ${u.first_name} ${u.last_name}'s account?`, label: "Unsuspend", color: "success" },
    approve: { title: "Approve Account", message: (u) => `Approve ${u.first_name} ${u.last_name}? They will be able to sign in.`, label: "Approve", color: "success" },
    disapprove: { title: "Disapprove Account", message: (u) => `Disapprove ${u.first_name} ${u.last_name}? They will not be able to sign in.`, label: "Disapprove", color: "danger" },
    resetpw: { title: "Reset Password", message: (u) => `Send a password reset email to ${u.email}?`, label: "Send Reset", color: "primary" },
    delete: { title: "Delete User", message: (u) => `Permanently delete ${u.first_name} ${u.last_name}? This cannot be undone.`, label: "Delete", color: "danger" },
  };

  const displayedUsers = users;
  const pendingOnly = statusFilter === "pending";

  return (
    <>
      <div className="min-h-screen bg-slate-50 px-6 py-7 animate-[fadeIn_.3s_ease]">
        <div className="mb-6">
          <h1 className="text-3xl font-black tracking-tight text-slate-800">User Management</h1>
          <p className="mt-1 text-sm text-slate-500">View, moderate, and manage all registered users.</p>
        </div>

        {summary && (
          <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            {[
              ["Registered users", summary.total_users],
              ["Current students", summary.total_students],
              ["Alumni", summary.total_alumni],
              ["Pending", summary.pending_users],
              ["Approved", summary.approved_users],
              ["Disapproved", summary.disapproved_users],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</div>
                <div className="mt-1 text-2xl font-black text-slate-800">{Number(value ?? 0).toLocaleString()}</div>
              </div>
            ))}
          </div>
        )}

        <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <input
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search name, email, student ID..."
            className="min-w-[220px] flex-1 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
          />
          <select value={roleFilter} onChange={(e) => handleFilter("role", e.target.value)} className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200">
            <option value="">All Roles</option>
            <option value="student">Student</option>
            <option value="alumni">Alumni</option>
            <option value="faculty">Faculty</option>
            <option value="admin">Admin</option>
          </select>
          <select value={statusFilter} onChange={(e) => handleFilter("status", e.target.value)} className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200">
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="disapproved">Disapproved</option>
            <option value="suspended">Suspended</option>
          </select>
          {(search || roleFilter || statusFilter) && (
            <button
              onClick={() => {
                setSearch("");
                setRoleFilter("");
                setStatusFilter("");
                setPage(1);
                fetchUsers(1, "", "", "");
              }}
              className="rounded-lg border border-red-200 px-3.5 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50"
            >
              Clear
            </button>
          )}
        </div>

        <div className="mb-3 flex justify-end">
          <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
            {[
              { label: "Show all", value: false },
              { label: "Pending only", value: true },
            ].map((option) => (
              <button
                key={option.label}
                type="button"
                onClick={() => handleFilter("status", option.value ? "pending" : "")}
                className={cx(
                  "rounded-lg px-3.5 py-2 text-sm font-bold transition",
                  pendingOnly === option.value
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-800",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full table-auto border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  {["User", "Student ID", "Course / Batch", "Role", "Standing", "Status", "Registered", "Actions"].map((h) => (
                    <th key={h} className="whitespace-nowrap px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading
                  ? Array.from({ length: 8 }).map((_, i) => (
                      <tr key={i} className="border-b border-slate-200">
                        {Array.from({ length: 8 }).map((_, j) => (
                          <td key={j} className="px-4 py-3.5">
                            <Skeleton className="h-3.5" style={{ width: `${j === 0 ? 140 : j === 6 ? 60 : 90}px` }} />
                          </td>
                        ))}
                      </tr>
                    ))
                  : displayedUsers.length === 0
                    ? (
                        <tr>
                          <td colSpan={8} className="px-6 py-12 text-center text-sm text-slate-500">
                            No users found.
                          </td>
                        </tr>
                      )
                    : displayedUsers.map((u, i) => {
                        const userHasName = hasName(u);
                        const userIncomplete = !hasStudentRecord(u);
                        const userMuted = approvalStatus(u) !== "approved" || userIncomplete;
                        const primaryName = userHasName ? `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim() : u.email;

                        return (
                        <tr
                          key={u.id}
                          className={cx(
                            "border-b border-slate-200 transition-colors hover:bg-indigo-50/40",
                            i % 2 === 0 ? "bg-white" : "bg-slate-50/40",
                            userMuted && "[&>td:not(:last-child)]:opacity-60",
                          )}
                        >
                          <td className="px-4 py-3.5 text-sm text-slate-800">
                            <div className="flex items-center gap-2.5">
                              <Avatar user={u} />
                              <div className="min-w-0">
                                <div className="max-w-[240px] truncate text-sm font-bold text-slate-800">
                                  {primaryName}
                                </div>
                                <div className={cx("max-w-[260px] truncate text-xs", userHasName ? "text-slate-500" : "italic text-slate-400")}>
                                  {userHasName ? u.email : "(No name on record)"}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-sm text-slate-800">
                            <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-500">
                              {u.student_id ?? "—"}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-sm text-slate-800">
                            <div className="text-sm font-semibold text-slate-800">{u.course ?? "—"}</div>
                            <div className="text-xs text-slate-500">{u.batch ? `Batch ${u.batch}` : ""} {u.graduation_year ? `· ${u.graduation_year}` : ""}</div>
                          </td>
                          <td className="px-4 py-3.5 text-sm text-slate-800">{roleBadge(u.role)}</td>
                          <td className="px-4 py-3.5 text-sm text-slate-800">{standingBadge(u)}</td>
                          <td className="px-4 py-3.5 text-sm text-slate-800">{statusBadges(u)}</td>
                          <td className="px-4 py-3.5 text-xs text-slate-500">
                            {u.created_at ? new Date(u.created_at).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" }) : "—"}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {approvalStatus(u) === "pending" && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => setConfirm({ type: "approve", user: u })}
                                    className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white transition hover:bg-emerald-700"
                                  >
                                    Approve
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirm({ type: "disapprove", user: u })}
                                    className="rounded-lg bg-red-600 px-2.5 py-1 text-xs font-bold text-white transition hover:bg-red-700"
                                  >
                                    Disapprove
                                  </button>
                                </>
                              )}
                              <ActionMenu
                                user={u}
                                onEdit={() => setEditUser(u)}
                                onSuspend={() => setConfirm({ type: "suspend", user: u })}
                                onUnsuspend={() => setConfirm({ type: "unsuspend", user: u })}
                                onApprove={() => setConfirm({ type: "approve", user: u })}
                                onDisapprove={() => setConfirm({ type: "disapprove", user: u })}
                                onResetPw={() => setConfirm({ type: "resetpw", user: u })}
                                onDelete={() => setConfirm({ type: "delete", user: u })}
                              />
                            </div>
                          </td>
                        </tr>
                        );
                      })
                }
              </tbody>
            </table>
          </div>

          <div className="border-t border-slate-200 px-5 py-4">
            <Pagination
              meta={meta}
              onPage={(p) => {
                setPage(p);
                fetchUsers(p);
              }}
            />
          </div>
        </div>
      </div>

      {editUser && (
        <UserModal
          user={editUser}
          onClose={() => setEditUser(null)}
          onSaved={() => {
            setEditUser(null);
            fetchUsers(page);
            notifyAdminAccountsChanged();
          }}
          toast={toast}
        />
      )}

      {confirm && confirmMap[confirm.type] && (
        <ConfirmModal
          open
          title={confirmMap[confirm.type].title}
          message={confirmMap[confirm.type].message(confirm.user)}
          confirmLabel={confirmMap[confirm.type].label}
          confirmColor={confirmMap[confirm.type].color}
          onConfirm={doAction}
          onCancel={() => setConfirm(null)}
          loading={actLoading}
        />
      )}

      <Toast toasts={toasts} />
    </>
  );
}
