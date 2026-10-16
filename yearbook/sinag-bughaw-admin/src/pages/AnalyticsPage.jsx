/**
 * AnalyticsPage.jsx
 * NU Lipa / Sinag-Bughaw — Admin Panel · Phase 5
 *
 * Sections:
 *  - Overview stats cards
 *  - Views over time (line chart via SVG)
 *  - Top viewed profiles and content
 *  - Trending profiles and content
 *  - Platform engagement breakdown
 *  - Online presence
 *
 * API:
 *   GET /api/admin/analytics/overview
 *   GET /api/admin/analytics/views-trend      ?days=30
 *   GET /api/admin/analytics/top-profiles     ?limit=10
 *   GET /api/admin/analytics/trending         ?limit=10
 *   GET /api/admin/analytics/engagement
 *   GET /api/admin/analytics/presence
 */

import { useCallback, useEffect, useState } from "react";
import api from "../services/api";
const cx = (...v) => v.filter(Boolean).join(" ");
const Card = ({ className = "", children }) => (
  <section className={cx("rounded-2xl border border-slate-200 bg-white p-5 shadow-sm", className)}>{children}</section>
);
const Skeleton = ({ className = "" }) => (
  <div className={cx("animate-pulse rounded-md bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 bg-[length:200%_100%]", className)} />
);
function Avatar({ src, name, size = 36 }) {
  const initials = name ? name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase() : "?";
  return src ? (
    <img src={src} alt={name} style={{ width: size, height: size }} className="rounded-full object-cover shrink-0" onError={(e) => (e.target.style.display = "none")} />
  ) : (
    <div style={{ width: size, height: size }} className="flex shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-extrabold text-white">
      {initials}
    </div>
  );
}
function StatCard({ toneClass, label, value, sub }) {
  return (
    <Card className="p-4">
      <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</div>
      <div className={cx("text-3xl font-black leading-none", toneClass)}>{value ?? "—"}</div>
      {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
    </Card>
  );
}

// Mini Line Chart (SVG)
function LineChart({ data = [], color = "#4f46e5", height = 180 }) {
  if (!data.length) return <div style={{ height }} className="flex items-center justify-center text-sm text-slate-500">No data</div>;

  const W = 600, H = height - 40;
  const max = Math.max(...data.map(d => d.value), 1);
  const min = 0;
  const pts = data.map((d, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = H - ((d.value - min) / (max - min)) * H;
    return [x, y];
  });

  const path   = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x},${y}`).join(" ");
  const filled = `${path} L${W},${H} L0,${H} Z`;

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H + 40}`} style={{ width: "100%", minWidth: 300 }}>
        {[0, 0.25, 0.5, 0.75, 1].map(f => {
          const y = H - f * H;
          return (
            <g key={f}>
              <line x1={0} y1={y} x2={W} y2={y} stroke="#e2e8f0" strokeWidth={1} />
              <text x={0} y={y - 4} fontSize={10} fill="#64748b">{Math.round(min + f * (max - min))}</text>
            </g>
          );
        })}
        <path d={filled} fill={color + "18"} />
        <path d={path} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        {pts.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={3.5} fill={color} />
        ))}
        {data.map((d, i) => {
          if (data.length > 14 && i % 7 !== 0) return null;
          const [x] = pts[i];
          return <text key={i} x={x} y={H + 30} fontSize={9} fill="#64748b" textAnchor="middle">{d.label}</text>;
        })}
      </svg>
    </div>
  );
}

// Bar Chart (SVG)
function BarChart({ data = [], color = "#7c3aed", height = 180 }) {
  if (!data.length) return <div style={{ height }} className="flex items-center justify-center text-sm text-slate-500">No data</div>;

  const W = 600, H = height - 40;
  const max = Math.max(...data.map(d => d.value), 1);
  const barW = Math.max(8, (W / data.length) - 6);

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H + 40}`} style={{ width: "100%", minWidth: 300 }}>
        {[0, 0.5, 1].map(f => {
          const y = H - f * H;
          return (
            <g key={f}>
              <line x1={0} y1={y} x2={W} y2={y} stroke="#e2e8f0" strokeWidth={1} />
              <text x={0} y={y - 4} fontSize={10} fill="#64748b">{Math.round(f * max)}</text>
            </g>
          );
        })}
        {data.map((d, i) => {
          const x   = (i / data.length) * W + (W / data.length - barW) / 2;
          const bH  = (d.value / max) * H;
          const y   = H - bH;
          return (
            <g key={i}>
              <rect x={x} y={y} width={barW} height={bH} rx={4} fill={color + "cc"} />
              <text x={x + barW / 2} y={H + 28} fontSize={9} fill="#64748b" textAnchor="middle">{d.label}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// Top Profiles List
function TopProfilesList({ items, loading }) {
  if (loading) return (
    <div className="flex flex-col gap-2.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-full" />
          <div className="flex-1">
            <Skeleton className="mb-1.5 h-3 w-1/2" />
            <Skeleton className="h-2.5 w-1/3" />
          </div>
          <Skeleton className="h-6 w-14 rounded-full" />
        </div>
      ))}
    </div>
  );

  if (!items?.length) return <div className="py-8 text-center text-sm text-slate-500">No data available.</div>;

  return (
    <div className="flex flex-col gap-2">
      {items.map((p, i) => (
        <div key={p.id ?? i} className="flex items-center gap-3 border-b border-slate-200 py-2.5 last:border-b-0">
          <div className={cx("w-6 text-center text-xs font-extrabold", i < 3 ? "text-indigo-600" : "text-slate-400")}>#{i + 1}</div>
          <Avatar src={p.profile_picture ?? p.avatar} name={p.name} size={36} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-bold text-slate-800">{p.name}</div>
            <div className="text-xs text-slate-500">{p.course ?? "—"} · {p.batch_year ?? p.graduation_year ?? ""}</div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-base font-extrabold text-indigo-600">{p.view_count?.toLocaleString() ?? p.profile_views ?? "—"}</div>
            <div className="text-[11px] text-slate-500">views</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Presence Panel
function PresencePanel({ data, loading }) {
  if (loading) return <div className="flex flex-col gap-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="flex gap-2.5"><Skeleton className="h-8 w-8 rounded-full" /><div className="flex-1"><Skeleton className="mb-1.5 h-2.5 w-2/5" /><Skeleton className="h-2.5 w-1/4" /></div></div>)}</div>;
  const onlineUsers = data?.filter((u) => u.is_online) ?? [];
  if (!onlineUsers.length) return <div className="py-8 text-center text-sm text-slate-500">No users online.</div>;

  return (
    <div className="flex max-h-80 flex-col gap-2 overflow-y-auto">
      {onlineUsers.map((u) => (
        <div key={u.user_id} className="flex items-center gap-2.5">
          <div className="relative">
            <Avatar src={u.profile_picture} name={u.name} size={34} />
            <div className={cx("absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white", u.is_online ? "bg-emerald-500" : "bg-slate-400")} />
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold text-slate-800">{u.name}</div>
            <div className="text-xs text-slate-500">{u.is_online ? "Online now" : `Last seen ${u.last_seen_at_human}`}</div>
          </div>
          {u.is_online && <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />}
        </div>
      ))}
    </div>
  );
}

// Main Page
export default function AnalyticsPage() {
  const [overview,    setOverview]    = useState(null);
  const [viewsTrend,  setViewsTrend]  = useState([]);
  const [topProfiles, setTopProfiles] = useState([]);
  const [trending,    setTrending]    = useState([]);
  const [engagement,  setEngagement]  = useState(null);
  const [presence,    setPresence]    = useState([]);
  const [trendDays,   setTrendDays]   = useState(30);

  const [loadingOverview,   setLoadingOverview]   = useState(true);
  const [loadingTrend,      setLoadingTrend]      = useState(true);
  const [loadingProfiles,   setLoadingProfiles]   = useState(true);
  const [loadingTrending,   setLoadingTrending]   = useState(true);
  const [loadingEngagement, setLoadingEngagement] = useState(true);
  const [loadingPresence,   setLoadingPresence]   = useState(true);

  const loadOverview = useCallback(() => {
    setLoadingOverview(true);
    api.get("/admin/analytics/overview")
      .then(r => setOverview(r.data))
      .catch(() => {})
      .finally(() => setLoadingOverview(false));
  }, []);

  useEffect(() => {
    loadOverview();

    api.get("/admin/analytics/top-profiles", { params: { limit: 10 } })
      .then(r => setTopProfiles(r.data.data ?? []))
      .catch(() => {})
      .finally(() => setLoadingProfiles(false));

    api.get("/admin/analytics/trending", { params: { limit: 10 } })
      .then(r => setTrending(r.data.data ?? []))
      .catch(() => {})
      .finally(() => setLoadingTrending(false));

    api.get("/admin/analytics/engagement")
      .then(r => setEngagement(r.data))
      .catch(() => {})
      .finally(() => setLoadingEngagement(false));

    api.get("/admin/analytics/presence")
      .then(r => setPresence(r.data.data ?? []))
      .catch(() => {})
      .finally(() => setLoadingPresence(false));
  }, [loadOverview]);

  useEffect(() => {
    const refresh = () => loadOverview();
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("admin-users-changed", refresh);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("admin-users-changed", refresh);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [loadOverview]);

  const fetchTrend = useCallback((days) => {
    setLoadingTrend(true);
    api.get("/admin/analytics/views-trend", { params: { days } })
      .then((r) => setViewsTrend(r.data.data ?? []))
      .catch(() => {})
      .finally(() => setLoadingTrend(false));
  }, []);

  useEffect(() => { fetchTrend(trendDays); }, [trendDays]);

  const Section = ({ title, children, action }) => (
    <Card>
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="text-base font-extrabold text-slate-800">{title}</div>
        {action}
      </div>
      {children}
    </Card>
  );

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-7 animate-[fadeIn_.3s_ease]">
      <div className="mb-6">
        <h1 className="text-3xl font-black tracking-tight text-slate-800">Analytics & Engagement</h1>
        <p className="mt-1 text-sm text-slate-500">Platform-wide engagement, content views, and user activity.</p>
      </div>

      {loadingOverview ? (
        <div className="mb-6 grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3.5">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}
        </div>
      ) : overview && (
        <div className="mb-6 grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3.5">
          <StatCard toneClass="text-indigo-600" label="Registered Users" value={overview.total_users?.toLocaleString()} sub="Matches User Management" />
          <StatCard toneClass="text-sky-600" label="Current Students" value={overview.total_students?.toLocaleString()} sub="Same student filter" />
          <StatCard toneClass="text-amber-600" label="Alumni" value={overview.total_alumni?.toLocaleString()} sub="Same alumni filter" />
          <StatCard toneClass="text-emerald-600" label="Verified" value={overview.verified_users?.toLocaleString()} sub="Verified and active" />
          <StatCard toneClass="text-orange-600" label="Unverified" value={overview.unverified_users?.toLocaleString()} sub="Not yet verified" />
          <StatCard toneClass="text-sky-600" label="Enrolled" value={overview.enrolled_students?.toLocaleString()} sub="Student records in a section" />
          <StatCard toneClass="text-violet-600" label="Total Views" value={overview.total_views?.toLocaleString()} sub="Profiles and content" />
          <StatCard toneClass="text-emerald-600" label="Views Today" value={overview.views_today?.toLocaleString()} sub="Last 24 hours" />
          <StatCard toneClass="text-emerald-600" label="Online Now" value={overview.online_now?.toLocaleString()} sub="Active users" />
        </div>
      )}

      {overview?.by_section?.length > 0 && (
        <div className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Section title="Students by section">
            <ul className="m-0 max-h-64 list-none space-y-2 overflow-auto p-0 text-sm">
              {overview.by_section.map((section) => (
                <li key={section.id} className="flex justify-between gap-3 border-b border-slate-100 pb-2">
                  <span>{section.name}{section.course ? ` · ${section.course}` : ""}</span>
                  <span className="font-bold">{section.students_count}</span>
                </li>
              ))}
            </ul>
          </Section>
          <Section title="Students by batch">
            <ul className="m-0 max-h-64 list-none space-y-2 overflow-auto p-0 text-sm">
              {(overview.by_batch ?? []).map((batch) => (
                <li key={batch.id} className="flex justify-between gap-3 border-b border-slate-100 pb-2">
                  <span>{batch.name}{batch.graduation_year ? ` · ${batch.graduation_year}` : ""}</span>
                  <span className="font-bold">{batch.students_count}</span>
                </li>
              ))}
            </ul>
          </Section>
        </div>
      )}

      <div className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Section
          title="Views Trend"
          action={
            <div className="flex gap-1.5">
              {[7, 30, 90].map((d) => (
                <button
                  key={d}
                  onClick={() => setTrendDays(d)}
                  className={cx(
                    "rounded-full border px-3 py-1 text-xs font-bold transition",
                    trendDays === d ? "border-indigo-300 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-500 hover:border-slate-300",
                  )}
                >
                  {d}d
                </button>
              ))}
            </div>
          }
        >
          {loadingTrend ? <Skeleton className="h-48 w-full rounded-xl" /> : <LineChart data={viewsTrend} color="#4f46e5" height={200} />}
        </Section>

        <Section title="Engagement Breakdown">
          {loadingEngagement ? (
            <Skeleton className="h-48 w-full rounded-xl" />
          ) : engagement ? (
            <BarChart
              data={[
                { label: "Photos", value: engagement.photos ?? 0 },
                { label: "Videos", value: engagement.videos ?? 0 },
                { label: "Messages", value: engagement.messages ?? 0 },
                { label: "Tags", value: engagement.tags ?? 0 },
              ]}
              color="#7c3aed"
              height={200}
            />
          ) : (
            <div className="py-8 text-center text-sm text-slate-500">No data</div>
          )}
        </Section>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Section title="Top Viewed Profiles">
          <TopProfilesList items={topProfiles} loading={loadingProfiles} />
        </Section>
        <Section title="Trending This Week">
          <TopProfilesList items={trending} loading={loadingTrending} />
        </Section>
        <Section title="User Presence">
          <PresencePanel data={presence} loading={loadingPresence} />
        </Section>
      </div>
    </div>
  );
}
