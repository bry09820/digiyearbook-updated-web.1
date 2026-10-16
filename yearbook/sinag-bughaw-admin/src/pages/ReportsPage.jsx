/**
 * ReportsPage.jsx
 * NU Lipa / Sinag-Bughaw — Admin Panel
 *
 * Single file for: Audit Logs + Upload Logs + Consent Logs tabs
 * All audit log logic consolidated here AuditLogsPage.jsx is removed.
 *
 * API (all routed through ReportsController):
 *   GET /api/admin/reports/stats
 *   GET /api/admin/reports/audit-logs   ?action&status&search&page&per_page
 *   GET /api/admin/reports/upload-logs  ?type&search&page&per_page
 *   GET /api/admin/privacy/consents     ?search&type&page&per_page
 */

import { useEffect, useState, useCallback, useRef } from "react";
import api from "../services/api";

const ICONS = {
  activity: <path d="M4 12h4l2-6 4 12 2-6h4" />,
  upload: <><path d="M12 16V4" /><path d="m7 9 5-5 5 5" /><path d="M5 20h14" /></>,
  login: <><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><path d="m10 17 5-5-5-5" /><path d="M15 12H3" /></>,
  check: <><path d="M20 6 9 17l-5-5" /><path d="M4 4h16v16H4z" /></>,
  x: <><path d="m15 9-6 6" /><path d="m9 9 6 6" /><path d="M4 4h16v16H4z" /></>,
  consent: <><path d="M8 3h8l4 4v14H4V3h4z" /><path d="M14 3v5h5" /><path d="m8 14 2 2 5-5" /></>,
  shield: <path d="M12 3 5 6v5c0 5 3.5 8 7 10 3.5-2 7-5 7-10V6l-7-3z" />,
};

function Icon({ name, className = "h-6 w-6" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {ICONS[name] ?? ICONS.activity}
    </svg>
  );
}

// Shared UI primitives

/** Animated skeleton loader */
function Skeleton({ className = "", style }) {
  return (
    <div
      style={style}
      className={`animate-pulse rounded bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 bg-[length:200%_100%] ${className}`}
    />
  );
}

function FileTypeChip({ type }) {
  const styles = {
    photo: "bg-indigo-50 text-indigo-700",
  };
  const labels = {
    photo: "PHOTO",
  };
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold ${styles[type] ?? "bg-slate-100 text-slate-600"}`}>
      {labels[type] ?? "FILE"}
    </span>
  );
}

/** Status / type badge */
function Badge({ label, variant = "default" }) {
  const variants = {
    success:  "bg-green-100 text-green-700",
    danger:   "bg-red-100 text-red-600",
    warning:  "bg-amber-100 text-amber-700",
    primary:  "bg-indigo-100 text-indigo-700",
    default:  "bg-slate-100 text-slate-500",
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold whitespace-nowrap ${variants[variant] ?? variants.default}`}>
      {label}
    </span>
  );
}

/** Reusable table header cell */
function Th({ children }) {
  return (
    <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">
      {children}
    </th>
  );
}

/** Reusable table data cell */
function Td({ children, className = "" }) {
  return (
    <td className={`px-4 py-3 text-sm text-slate-700 border-b border-slate-100 ${className}`}>
      {children}
    </td>
  );
}

/** Pagination bar */
function Pagination({ meta, onPage }) {
  if (!meta || meta.last_page <= 1) return null;
  const { current_page: cur, last_page: last, total } = meta;

  const pages = [];
  for (let i = Math.max(1, cur - 2); i <= Math.min(last, cur + 2); i++) pages.push(i);

  const Btn = ({ label, page, disabled, active }) => (
    <button
      onClick={() => !disabled && onPage(page)}
      disabled={disabled}
      className={`px-3 py-1.5 rounded-lg border text-sm font-semibold transition-colors
        ${active
          ? "bg-indigo-600 border-indigo-600 text-white"
          : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-default"
        }`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex flex-wrap justify-between items-center gap-3 mt-4">
      <span className="text-sm text-slate-400">
        Page {cur} of {last} · {total} records
      </span>
      <div className="flex gap-1.5">
        <Btn label="←" page={cur - 1} disabled={cur === 1} />
        {pages.map(p => <Btn key={p} label={p} page={p} active={p === cur} />)}
        <Btn label="→" page={cur + 1} disabled={cur === last} />
      </div>
    </div>
  );
}

/** Shared search + filter bar wrapper */
function FilterBar({ children }) {
  return (
    <div className="flex flex-wrap gap-3 mb-5">
      {children}
    </div>
  );
}

/** Shared input style */
function Input({ className = "", ...props }) {
  return (
    <input
      className={`px-3.5 py-2 rounded-xl border border-slate-200 text-sm text-slate-700 bg-white outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition ${className}`}
      {...props}
    />
  );
}

/** Shared select style */
function Select({ className = "", ...props }) {
  return (
    <select
      className={`px-3.5 py-2 rounded-xl border border-slate-200 text-sm text-slate-700 bg-white cursor-pointer outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition ${className}`}
      {...props}
    />
  );
}

/** Shared table card wrapper */
function TableCard({ children }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

// Audit Logs Tab
function AuditLogsTab() {
  const [logs,    setLogs]    = useState([]);
  const [meta,    setMeta]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [page,    setPage]    = useState(1);
  const [search,  setSearch]  = useState("");
  const [action,  setAction]  = useState("");
  const [status,  setStatus]  = useState("");
  const timer = useRef(null);

  const load = useCallback(async (p = 1, q = search, a = action, s = status) => {
    setLoading(true);
    try {
      const res = await api.get("/admin/reports/audit-logs", {
        params: { page: p, search: q, action: a, status: s, per_page: 15 },
      });
      setLogs(res.data.data ?? []);
      setMeta(res.data.meta ?? null);
    } catch {
      // silently fail you can add a toast here
    } finally {
      setLoading(false);
    }
  }, [search, action, status]);

  useEffect(() => { load(page); }, [page]);

  const handleSearch = v => {
    setSearch(v);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { setPage(1); load(1, v, action, status); }, 400);
  };

  const statusVariant = s => ({ Success: "success", Failed: "danger", Warning: "warning" }[s] ?? "default");

  const fmt = ts =>
    ts ? new Date(ts).toLocaleDateString("en-PH", {
      year: "numeric", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    }) : "—";

  return (
    <>
      <FilterBar>
        <Input
          value={search}
          onChange={e => handleSearch(e.target.value)}
          placeholder="Search user, action..."
          className="flex-1 min-w-[200px]"
        />
        <Select
          value={action}
          onChange={e => { setAction(e.target.value); setPage(1); load(1, search, e.target.value, status); }}
        >
          <option value="">All Actions</option>
          {["login","logout","upload","delete","update","approve","reject","settings","cancel_subscription"].map(a => (
            <option key={a} value={a}>{a.replace(/_/g, " ")}</option>
          ))}
        </Select>
        <Select
          value={status}
          onChange={e => { setStatus(e.target.value); setPage(1); load(1, search, action, e.target.value); }}
        >
          <option value="">All Statuses</option>
          <option value="Success">Success</option>
          <option value="Failed">Failed</option>
          <option value="Warning">Warning</option>
        </Select>
      </FilterBar>

      <TableCard>
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              {["Admin / User","Action","Details","IP Address","Status","Logged At"].map(h => (
                <Th key={h}>{h}</Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    {[120, 80, 220, 100, 70, 130].map((w, j) => (
                      <Td key={j}><Skeleton className="h-3.5" style={{ width: `${w}px` }} /></Td>
                    ))}
                  </tr>
                ))
              : logs.length === 0
              ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-slate-400">
                    No audit logs found.
                  </td>
                </tr>
              )
              : logs.map(l => (
                <tr
                  key={l.id}
                  className="hover:bg-indigo-50/40 transition-colors"
                >
                  <Td><span className="font-bold text-slate-800">{l.user_name?.trim() || "system"}</span></Td>
                  <Td><Badge label={l.action ?? "—"} variant="primary" /></Td>
                  <Td className="max-w-[260px]">
                    <span className="block text-xs text-slate-400 truncate">{l.details ?? "—"}</span>
                  </Td>
                  <Td><span className="font-mono text-xs text-slate-400">{l.ip_address ?? "—"}</span></Td>
                  <Td><Badge label={l.status ?? "—"} variant={statusVariant(l.status)} /></Td>
                  <Td><span className="font-mono text-xs text-slate-400">{fmt(l.logged_at)}</span></Td>
                </tr>
              ))
            }
          </tbody>
        </table>
        <div className="px-5 py-3.5 border-t border-slate-100">
          <Pagination meta={meta} onPage={setPage} />
        </div>
      </TableCard>
    </>
  );
}

// Upload Logs Tab
function UploadLogsTab() {
  const [logs,    setLogs]    = useState([]);
  const [meta,    setMeta]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [page,    setPage]    = useState(1);
  const [search,  setSearch]  = useState("");
  const [type,    setType]    = useState("");
  const timer = useRef(null);

  const load = useCallback(async (p = 1, q = search, t = type) => {
    setLoading(true);
    try {
      const res = await api.get("/admin/reports/upload-logs", {
        params: { page: p, search: q, type: t, per_page: 15 },
      });
      setLogs(res.data.data ?? []);
      setMeta(res.data.meta ?? null);
    } catch {
      // silently fail add toast if needed
    } finally {
      setLoading(false);
    }
  }, [search, type]);

  useEffect(() => { load(page); }, [page]);

  const handleSearch = v => {
    setSearch(v);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { setPage(1); load(1, v, type); }, 400);
  };

  const statusVariant = s => ({ approved: "success", pending: "warning", rejected: "danger" }[s] ?? "default");

  const fmt = ts =>
    ts ? new Date(ts).toLocaleDateString("en-PH", {
      year: "numeric", month: "short", day: "numeric",
    }) : "—";

  return (
    <>
      <FilterBar>
        <Input
          value={search}
          onChange={e => handleSearch(e.target.value)}
          placeholder="Search filename, uploader..."
          className="flex-1 min-w-[200px]"
        />
        <Select
          value={type}
          onChange={e => { setType(e.target.value); setPage(1); load(1, search, e.target.value); }}
        >
          <option value="">All Types</option>
          <option value="photo">Photo</option>
        </Select>
      </FilterBar>

      <TableCard>
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              {["File","Uploader","Type","Status","Uploaded"].map(h => (
                <Th key={h}>{h}</Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    {[180, 100, 70, 80, 110].map((w, j) => (
                      <Td key={j}><Skeleton className="h-3.5" style={{ width: `${w}px` }} /></Td>
                    ))}
                  </tr>
                ))
              : logs.length === 0
              ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-slate-400">
                    No upload logs found.
                  </td>
                </tr>
              )
              : logs.map(l => (
                <tr
                  key={l.id}
                  className="hover:bg-indigo-50/40 transition-colors"
                >
                  <Td>
                    <div className="flex items-center gap-2">
                      <FileTypeChip type={l.type} />
                      <span className="font-semibold text-sm truncate max-w-[160px]">{l.filename ?? "—"}</span>
                    </div>
                  </Td>
                  <Td><span className="text-sm">{l.uploader ?? "—"}</span></Td>
                  <Td><Badge label={l.type?.toUpperCase() ?? "—"} variant="primary" /></Td>
                  <Td><Badge label={l.status ?? "pending"} variant={statusVariant(l.status)} /></Td>
                  <Td><span className="font-mono text-xs text-slate-400">{fmt(l.created_at)}</span></Td>
                </tr>
              ))
            }
          </tbody>
        </table>
        <div className="px-5 py-3.5 border-t border-slate-100">
          <Pagination meta={meta} onPage={setPage} />
        </div>
      </TableCard>
    </>
  );
}

// Consent Logs Tab
function ConsentLogsTab() {
  const [logs, setLogs] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const timer = useRef(null);

  const load = useCallback(async (p = 1, q = search, t = type) => {
    setLoading(true);
    try {
      const res = await api.get("/admin/privacy/consents", {
        params: { page: p, search: q, type: t, per_page: 15 },
      });
      setLogs(res.data.data ?? []);
      setMeta(res.data.meta ?? null);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [search, type]);

  useEffect(() => { load(page); }, [page]);

  const handleSearch = (v) => {
    setSearch(v);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { setPage(1); load(1, v, type); }, 400);
  };

  const consentStatusVariant = (accepted) => (accepted ? "success" : "danger");

  const fmt = (ts) =>
    ts ? new Date(ts).toLocaleDateString("en-PH", {
      year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    }) : "—";

  return (
    <>
      <FilterBar>
        <Input
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search user, email..."
          className="flex-1 min-w-[200px]"
        />
        <Select
          value={type}
          onChange={(e) => { setType(e.target.value); setPage(1); load(1, search, e.target.value); }}
        >
          <option value="">All Types</option>
          <option value="privacy_policy">Privacy Policy</option>
          <option value="terms_of_service">Terms of Service</option>
          <option value="data_processing">Data Processing</option>
          <option value="marketing">Marketing</option>
        </Select>
      </FilterBar>

      <TableCard>
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              {["User", "Type", "Version", "Status", "IP Address", "Date Accepted"].map((h) => (
                <Th key={h}>{h}</Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    {[170, 120, 90, 80, 120, 140].map((w, j) => (
                      <Td key={j}><Skeleton className="h-3.5" style={{ width: `${w}px` }} /></Td>
                    ))}
                  </tr>
                ))
              : logs.length === 0
                ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-slate-400">
                      No consent logs found.
                    </td>
                  </tr>
                )
                : logs.map((l) => (
                  <tr key={l.id} className="hover:bg-indigo-50/40 transition-colors">
                    <Td>
                      <div className="font-bold text-slate-800">{l.user?.first_name} {l.user?.last_name}</div>
                      <div className="text-xs text-slate-400">{l.user?.email}</div>
                    </Td>
                    <Td>
                      <Badge label={l.type?.replace(/_/g, " ") ?? "—"} variant="primary" />
                    </Td>
                    <Td>
                      <span className="font-mono text-xs text-slate-500">{l.version ?? "—"}</span>
                    </Td>
                    <Td>
                      <Badge label={l.accepted ? "Accepted" : "Declined"} variant={consentStatusVariant(l.accepted)} />
                    </Td>
                    <Td>
                      <span className="font-mono text-xs text-slate-400">{l.ip_address ?? "—"}</span>
                    </Td>
                    <Td>
                      <span className="font-mono text-xs text-slate-400">{fmt(l.accepted_at)}</span>
                    </Td>
                  </tr>
                ))
            }
          </tbody>
        </table>
        <div className="px-5 py-3.5 border-t border-slate-100">
          <Pagination meta={meta} onPage={setPage} />
        </div>
      </TableCard>
    </>
  );
}

// Stat card
function StatCard({ icon, label, value, loading, colorClass = "text-indigo-600", bgClass = "bg-indigo-50" }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl px-5 py-4 flex items-center gap-4 shadow-sm">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${bgClass} ${colorClass}`}>
        <Icon name={icon} />
      </div>
      <div>
        <p className="text-xs text-slate-400 mb-1">{label}</p>
        {loading
          ? <Skeleton className="h-6 w-12" />
          : <p className={`text-2xl font-black ${colorClass}`}>{value}</p>
        }
      </div>
    </div>
  );
}

// Tab definitions
const TABS = [
  { key: "audit", label: "Audit Logs" },
  { key: "uploads", label: "Upload Logs" },
  { key: "consents", label: "Consent Logs" },
];

// Main Page
export default function ReportsPage() {
  const [tab,          setTab]          = useState("audit");
  const [stats,        setStats]        = useState(null);
  const [privacyStats, setPrivacyStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get("/admin/reports/stats"),
      api.get("/admin/privacy/stats"),
    ])
      .then(([reportsRes, privacyRes]) => {
        setStats(reportsRes.data);
        setPrivacyStats(privacyRes.data);
      })
      .catch(() => {})
      .finally(() => setStatsLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-8 animate-[fadeIn_.3s_ease]">

      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-black text-slate-800">Reports & Audit Logs</h1>
        <p className="text-sm text-slate-400 mt-1">Full activity history across the entire system.</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4 mb-6">
        <StatCard
          icon="activity" label="Total Audit Events"
          value={stats?.total_audit ?? 0}
          loading={statsLoading}
          colorClass="text-indigo-600" bgClass="bg-indigo-50"
        />
        <StatCard
          icon="upload" label="Total Uploads"
          value={stats?.total_uploads ?? 0}
          loading={statsLoading}
          colorClass="text-green-600" bgClass="bg-green-50"
        />
        <StatCard
          icon="login" label="Logins Today"
          value={stats?.logins_today ?? 0}
          loading={statsLoading}
          colorClass="text-amber-600" bgClass="bg-amber-50"
        />
        <StatCard
          icon="check" label="Consent Approved"
          value={privacyStats?.privacy_accepted ?? 0}
          loading={statsLoading}
          colorClass="text-emerald-600" bgClass="bg-emerald-50"
        />
        <StatCard
          icon="x" label="Consent Declined"
          value={privacyStats?.declined ?? 0}
          loading={statsLoading}
          colorClass="text-red-600" bgClass="bg-red-50"
        />
        <StatCard
          icon="consent" label="Total Consents"
          value={privacyStats?.total_consents ?? 0}
          loading={statsLoading}
          colorClass="text-indigo-600" bgClass="bg-indigo-50"
        />
        <StatCard
          icon="shield" label="Privacy Audit Today"
          value={privacyStats?.audit_today ?? 0}
          loading={statsLoading}
          colorClass="text-cyan-600" bgClass="bg-cyan-50"
        />
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-5">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-5 py-2 rounded-xl border font-bold text-sm transition-all
              ${tab === t.key
                ? "bg-indigo-600 border-indigo-600 text-white shadow-sm"
                : "bg-white border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600"
              }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "audit"   && <AuditLogsTab />}
      {tab === "uploads" && <UploadLogsTab />}
      {tab === "consents" && <ConsentLogsTab />}

      <style>{`
        @keyframes fadeIn { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
      `}</style>
    </div>
  );
}
