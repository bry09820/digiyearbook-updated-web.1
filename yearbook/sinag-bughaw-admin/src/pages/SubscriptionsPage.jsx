/**
 * SubscriptionsPage.jsx
 * NU Lipa / Sinag-Bughaw — Admin Panel (Redesigned)
 *
 * API:
 *   GET   /api/admin/subscriptions         ?search&plan&status&page
 *   GET   /api/admin/subscriptions/stats
 *   GET   /api/admin/subscriptions/{id}
 *   PATCH /api/admin/subscriptions/{id}/cancel
 */

import { useEffect, useState, useCallback, useRef } from "react";
import api from "../services/api";

const cx = (...v) => v.filter(Boolean).join(" ");

// Skeleton
const Skeleton = ({ className = "", style }) => (
  <div
    style={style}
    className={cx(
      "animate-pulse rounded-md bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 bg-[length:200%_100%]",
      className,
    )}
  />
);

// Badge
function Badge({ label, tone = "default" }) {
  const tones = {
    success:    "bg-emerald-50 text-emerald-700 border border-emerald-200",
    neutral:    "bg-slate-100 text-slate-600 border border-slate-200",
    danger:     "bg-red-50 text-red-700 border border-red-200",
    warning:    "bg-amber-50 text-amber-700 border border-amber-200",
    purple:     "bg-indigo-600 text-white border border-indigo-700",
    purpleSoft: "bg-indigo-50 text-indigo-700 border border-indigo-200",
    indigo:     "bg-indigo-50 text-indigo-700 border border-indigo-200",
    default:    "bg-slate-100 text-slate-600 border border-slate-200",
  };
  return (
    <span className={cx("inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-bold", tones[tone] ?? tones.default)}>
      {label}
    </span>
  );
}

function planBadge(plan) {
  if (plan === "premium_monthly")  return <Badge label="Premium Monthly"  tone="purple" />;
  if (plan === "premium_yearly")   return <Badge label="Premium Yearly"   tone="purple" />;
  if (plan === "standard_monthly") return <Badge label="Standard Monthly" tone="purpleSoft" />;
  if (plan === "standard_yearly")  return <Badge label="Standard Yearly"  tone="purpleSoft" />;
  return <Badge label={plan ?? "Free"} tone="neutral" />;
}

function statusBadge(status) {
  const map = {
    active:    { label: "Active",    tone: "success" },
    expired:   { label: "Expired",   tone: "neutral" },
    cancelled: { label: "Cancelled", tone: "danger"  },
    pending:   { label: "Pending",   tone: "warning" },
  };
  const s = map[status] ?? { label: status ?? "—", tone: "neutral" };
  return <Badge {...s} />;
}

// Toast
function useToast() {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((message, type = "success") => {
    const id = Date.now();
    setToasts(p => [...p, { id, message, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3000);
  }, []);
  return { toasts, push };
}

function Toast({ toasts }) {
  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2.5">
      {toasts.map(t => (
        <div
          key={t.id}
          className={cx(
            "rounded-xl border px-4 py-3 text-sm font-semibold shadow-lg",
            t.type === "error"
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-700",
          )}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}

// Pagination
function Pagination({ meta, onPage }) {
  if (!meta || meta.last_page <= 1) return null;
  const { current_page: cur, last_page: last } = meta;
  const pages = [];
  for (let i = Math.max(1, cur - 2); i <= Math.min(last, cur + 2); i++) pages.push(i);

  const Btn = ({ label, page, disabled, active }) => (
    <button
      onClick={() => !disabled && onPage(page)}
      className={cx(
        "rounded-lg border px-3 py-1.5 text-xs font-bold transition",
        active
          ? "border-indigo-600 bg-indigo-600 text-white"
          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
        disabled && "cursor-default opacity-40",
      )}
    >
      {label}
    </button>
  );

  return (
    <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-slate-100 px-5 py-3.5">
      <div className="text-xs text-slate-400 font-medium">
        Page {cur} of {last} · {meta.total} records
      </div>
      <div className="flex gap-1.5">
        <Btn label="←" page={cur - 1} disabled={cur === 1} />
        {pages.map(p => <Btn key={p} label={p} page={p} active={p === cur} />)}
        <Btn label="→" page={cur + 1} disabled={cur === last} />
      </div>
    </div>
  );
}

// Detail Modal
function SubDetailModal({ sub, onClose, onCancel, loading }) {
  if (!sub) return null;

  const fmt = v =>
    v ? new Date(v).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" }) : "—";
  const fmtMoney = v =>
    v != null ? `₱${parseFloat(v).toLocaleString("en-PH", { minimumFractionDigits: 2 })}` : "—";

  const fullName = `${sub.user?.first_name ?? ""} ${sub.user?.last_name ?? ""}`.trim() || "—";
  const initials = fullName !== "—"
    ? fullName.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase()
    : "?";

  const fields = [
    ["Plan",        sub.plan ?? "—"],
    ["Status",      sub.status ?? "—"],
    ["Amount paid", fmtMoney(sub.amount_paid == null ? null : sub.amount_paid / 100)],
    ["Started",     fmt(sub.created_at)],
    ["Expires",     fmt(sub.expires_at)],
  ];

  return (
    <div
      className="fixed inset-0 z-[1000] grid place-items-center bg-slate-900/50 p-5 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[460px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <span className="text-sm font-bold text-slate-800">Subscription details</span>
          <button
            onClick={onClose}
            className="grid h-7 w-7 place-items-center rounded-lg border border-slate-200 text-slate-400 transition hover:bg-slate-50 hover:text-slate-600"
          >
            <i className="fas fa-times text-xs" />
          </button>
        </div>

        <div className="px-6 py-5">
          {/* User row */}
          <div className="mb-5 flex items-center gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700">
              {initials}
            </div>
            <div>
              <div className="text-sm font-bold text-slate-800">{fullName}</div>
              <div className="text-xs text-slate-500">{sub.user?.email ?? "—"}</div>
            </div>
            <div className="ml-auto">{planBadge(sub.plan)}</div>
          </div>

          {/* Fields grid */}
          <div className="mb-4 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-4">
            {fields.map(([k, v]) => (
              <div key={k}>
                <div className="mb-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">{k}</div>
                <div className="text-sm font-semibold text-slate-700">{v}</div>
              </div>
            ))}
          </div>

          {/* PayMongo ID */}
          {sub.paymongo_payment_intent_id && (
            <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3">
              <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">PayMongo intent ID</div>
              <div className="font-mono text-xs text-slate-600 break-all">{sub.paymongo_payment_intent_id}</div>
            </div>
          )}

          {/* Cancel button */}
          {sub.status === "active" && (
            <button
              onClick={() => onCancel(sub)}
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <>
                  <i className="fas fa-spinner fa-spin text-xs" />
                  Cancelling…
                </>
              ) : (
                <>
                  <i className="fas fa-ban text-xs" />
                  Cancel subscription
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Storage Tier Overview
function StorageOverview({ stats, loading }) {
  const tiers = [
    {
      key:   "free",
      label: "Free",
      icon:  "fa-user",
      color: "text-slate-600",
      bg:    "bg-slate-100",
      border:"border-slate-200",
    },
    {
      key:   "premium_standard",
      label: "Standard plans",
      icon:  "fa-star-half-stroke",
      color: "text-indigo-700",
      bg:    "bg-indigo-50",
      border:"border-indigo-200",
    },
    {
      key:   "premium",
      label: "Premium plans",
      icon:  "fa-crown",
      color: "text-indigo-100",
      bg:    "bg-indigo-600",
      border:"border-indigo-700",
    },
    {
      key:   "faculty",
      label: "Faculty",
      icon:  "fa-chalkboard-user",
      color: "text-violet-700",
      bg:    "bg-violet-50",
      border:"border-violet-200",
    },
    {
      key:   "admin",
      label: "Admin",
      icon:  "fa-user-shield",
      color: "text-slate-700",
      bg:    "bg-slate-200",
      border:"border-slate-300",
    },
  ];

  const registeredTotal = tiers.reduce(
    (sum, tier) => sum + Number(stats?.tiers?.[tier.key] ?? 0),
    0,
  );

  return (
    <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <i className="fas fa-database text-sm text-indigo-500" />
          <span className="text-sm font-bold text-slate-800">Storage tier overview</span>
        </div>
        <span className="text-xs font-bold text-slate-500">
          {loading ? "…" : `${registeredTotal.toLocaleString()} registered accounts`}
        </span>
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3">
        {tiers.map(t => (
          <div key={t.key} className={cx("rounded-xl border p-4", t.border, "bg-slate-50")}>
            <div className={cx("mb-3 grid h-8 w-8 place-items-center rounded-lg text-sm", t.bg)}>
              <i className={cx("fas", t.icon, t.color)} />
            </div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">{t.label}</div>
            {loading
              ? <Skeleton className="h-7 w-12 mt-1" />
              : <div className="text-2xl font-black text-slate-800 leading-none">{stats?.tiers?.[t.key] ?? 0}</div>
            }
            <div className="mt-1 text-[11px] text-slate-400">accounts</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Stat Cards
function StatCards({ stats, loading }) {
  const cards = [
    {
      key:   "active",
      label: "Active subscriptions",
      icon:  "fa-users",
      color: "#065f46",
      bg:    "#d1fae5",
      value: Number(stats?.tiers?.premium_standard ?? 0) + Number(stats?.tiers?.premium ?? 0),
    },
    {
      key:   "revenue",
      label: "Revenue (all time)",
      icon:  "fa-peso-sign",
      color: "#3730a3",
      bg:    "#ede9fe",
      value: `₱${((stats?.total_revenue ?? 0) / 100).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`,
    },
    {
      key:   "expiring",
      label: "Expiring this month",
      icon:  "fa-clock",
      color: "#92400e",
      bg:    "#fef3c7",
      value: stats?.expiring_soon ?? 0,
    },
    {
      key:   "cancelled",
      label: "Cancelled",
      icon:  "fa-ban",
      color: "#991b1b",
      bg:    "#fee2e2",
      value: stats?.cancelled_count ?? 0,
    },
  ];

  return (
    <div className="mb-5 grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
      {cards.map(c => (
        <div
          key={c.key}
          className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5"
        >
          <div
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-base"
            style={{ background: c.bg, color: c.color }}
          >
            <i className={cx("fas", c.icon)} />
          </div>
          <div className="min-w-0">
            <div className="mb-1 text-[11px] font-semibold text-slate-500 leading-tight">{c.label}</div>
            {loading
              ? <Skeleton className="h-7 w-20" />
              : <div className="text-2xl font-black leading-none" style={{ color: c.color }}>{c.value}</div>
            }
          </div>
        </div>
      ))}
    </div>
  );
}

// Main Page
export default function SubscriptionsPage() {
  const [subs,       setSubs]       = useState([]);
  const [meta,       setMeta]       = useState(null);
  const [stats,      setStats]      = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [statsLoad,  setStatsLoad]  = useState(true);
  const [page,       setPage]       = useState(1);
  const [search,     setSearch]     = useState("");
  const [plan,       setPlan]       = useState("");
  const [status,     setStatus]     = useState("");
  const [selected,   setSelected]   = useState(null);
  const [cancelling, setCancelling] = useState(false);

  const { toasts, push: toast } = useToast();
  const timer = useRef(null);

  const fetchSubs = useCallback(async (p = 1, q = search, pl = plan, st = status) => {
    setLoading(true);
    try {
      const res = await api.get("/admin/subscriptions", {
        params: { page: p, search: q, plan: pl, status: st, per_page: 15 },
      });
      setSubs(res.data.data ?? []);
      setMeta(res.data.meta ?? null);
    } catch {
      toast("Failed to load subscriptions.", "error");
    } finally {
      setLoading(false);
    }
  }, [search, plan, status]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get("/admin/subscriptions/stats");
      setStats(res.data);
    } catch {}
    finally { setStatsLoad(false); }
  }, []);

  useEffect(() => { fetchSubs(1); fetchStats(); }, []);

  const handleSearch = v => {
    setSearch(v);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setPage(1);
      fetchSubs(1, v, plan, status);
    }, 400);
  };

  const doCancel = async sub => {
    setCancelling(true);
    try {
      await api.patch(`/admin/subscriptions/${sub.id}/cancel`);
      toast("Subscription cancelled.");
      setSelected(null);
      fetchSubs(page);
      fetchStats();
    } catch {
      toast("Failed to cancel subscription.", "error");
    } finally {
      setCancelling(false);
    }
  };

  const fmtMoney = v =>
    v != null
      ? `₱${(parseFloat(v) / 100).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`
      : "—";

  const fmtDate = v =>
    v ? new Date(v).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" }) : "Never";

  return (
    <>
      <div className="min-h-screen bg-[#f4f6fb] px-6 py-7">

        {/* Page header */}
        <div className="mb-6">
          <h1 className="text-2xl font-black tracking-tight text-slate-800">
            Subscriptions & storage
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Monitor premium subscriptions and storage quotas.
          </p>
        </div>

        {/* Stat cards */}
        <StatCards stats={stats} loading={statsLoad} />

        {/* Storage tier overview */}
        <StorageOverview stats={stats} loading={statsLoad} />

        {/* Filters */}
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
          <div className="relative flex-1 min-w-[200px]">
            <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400" />
            <input
              value={search}
              onChange={e => handleSearch(e.target.value)}
              placeholder="Search user, email…"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-8 pr-3.5 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100"
            />
          </div>
          <select
            value={plan}
            onChange={e => { setPlan(e.target.value); setPage(1); fetchSubs(1, search, e.target.value, status); }}
            className="cursor-pointer rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100"
          >
            <option value="">All plans</option>
            <option value="standard">Standard (Monthly & Yearly)</option>
            <option value="premium">Premium (Monthly & Yearly)</option>
          </select>
          <select
            value={status}
            onChange={e => { setStatus(e.target.value); setPage(1); fetchSubs(1, search, plan, e.target.value); }}
            className="cursor-pointer rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100"
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="expired">Expired</option>
            <option value="cancelled">Cancelled</option>
            <option value="pending">Pending</option>
          </select>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  {["User", "Plan", "Status", "Amount paid", "Expires", "Actions"].map(h => (
                    <th
                      key={h}
                      className="whitespace-nowrap px-5 py-3 text-left text-[10.5px] font-black uppercase tracking-wider text-slate-400"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="border-b border-slate-100">
                      {[140, 110, 80, 80, 90, 60].map((w, j) => (
                        <td key={j} className="px-5 py-4">
                          <Skeleton style={{ width: `${w}px`, height: "13px" }} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : subs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-16 text-center">
                      <div className="mb-2 text-3xl text-slate-200">
                        <i className="fas fa-inbox" />
                      </div>
                      <div className="text-sm text-slate-400">No subscriptions found.</div>
                    </td>
                  </tr>
                ) : (
                  subs.map(s => (
                    <tr
                      key={s.id}
                      className="border-b border-slate-100 transition-colors last:border-0 hover:bg-indigo-50/30"
                    >
                      <td className="px-5 py-3.5">
                        <div className="text-sm font-bold text-slate-800">
                          {s.user?.first_name} {s.user?.last_name}
                        </div>
                        <div className="text-xs text-slate-400">{s.user?.email}</div>
                      </td>
                      <td className="px-5 py-3.5">{planBadge(s.plan)}</td>
                      <td className="px-5 py-3.5">{statusBadge(s.status)}</td>
                      <td className="px-5 py-3.5 text-sm font-bold text-slate-800">
                        {fmtMoney(s.amount_paid)}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-slate-400">
                        {fmtDate(s.expires_at)}
                      </td>
                      <td className="px-5 py-3.5">
                        <button
                          onClick={() => setSelected(s)}
                          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-indigo-600 transition hover:border-indigo-200 hover:bg-indigo-50"
                        >
                          <i className="fas fa-eye text-[10px]" />
                          View
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <Pagination meta={meta} onPage={p => { setPage(p); fetchSubs(p); }} />
        </div>
      </div>

      <SubDetailModal
        sub={selected}
        onClose={() => setSelected(null)}
        onCancel={doCancel}
        loading={cancelling}
      />
      <Toast toasts={toasts} />
    </>
  );
}
