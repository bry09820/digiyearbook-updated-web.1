import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import {
  DASHBOARD_API_PATH,
  AUDIT_LOGS_PATH,
  LOCALE,
  buildMetricCards,
} from "../config/dashboard.config";

const fmt = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));
const cx  = (...v) => v.filter(Boolean).join(" ");

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

// Card shell
const Card = ({ className = "", children }) => (
  <div className={cx("rounded-2xl border border-slate-200 bg-white", className)}>
    {children}
  </div>
);

// Section heading
const SectionHeading = ({ icon, title, subtitle, action }) => (
  <div className="mb-4 flex items-center justify-between gap-3">
    <div className="flex items-center gap-2">
      {icon && <i className={cx("fas", icon, "text-sm text-indigo-400")} aria-hidden="true" />}
      <div>
        <h3 className="text-sm font-bold text-slate-800">{title}</h3>
        {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
      </div>
    </div>
    {action}
  </div>
);

// Metric Cards
function MetricCard({ label, value, rawValue, sub, icon, iconBg, iconColor, subBg, subColor, cardType, loading }) {
  const isAlertCard = /alert|error/i.test(label ?? "");
  const isDanger = cardType === "danger" || (isAlertCard && Number(rawValue ?? 0) > 0);

  return (
    <Card className={cx("p-5 flex items-center gap-4", isDanger && "border-l-4 border-l-red-500 bg-red-50")}>
      <div
        className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-base"
        style={{ background: iconBg, color: iconColor }}
      >
        <i className={cx("fas", icon)} aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="mb-1 text-[11px] font-semibold text-slate-400 leading-tight">{label}</p>
        {loading ? (
          <>
            <Skeleton className="mb-2 h-7 w-16" />
            <Skeleton className="h-4 w-24" />
          </>
        ) : (
          <>
            <p className="mb-1.5 text-2xl font-black leading-none text-slate-800">{value}</p>
            <span
              className="inline-flex rounded-md px-2 py-0.5 text-[10px] font-bold"
              style={{ background: subBg, color: subColor }}
            >
              {sub}
            </span>
          </>
        )}
      </div>
    </Card>
  );
}

// Enrollment Chart
function EnrollmentChart({ data, loading }) {
  const canvasRef = useRef(null);
  const chartRef  = useRef(null);
  const chartData = useMemo(() => (Array.isArray(data) ? data : []), [data]);
  const hasData = chartData.some((d) => Number(d.total ?? 0) > 0);

  useEffect(() => {
    if (!hasData || loading) {
      if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }
      return;
    }

    const loadChart = () => {
      if (!window.Chart || !canvasRef.current) return;
      if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }

      chartRef.current = new window.Chart(canvasRef.current, {
        type: "bar",
        data: {
          labels: chartData.map((d) => d.year),
          datasets: [{
            label: "Enrolled Students",
            data: chartData.map((d) => d.total),
            backgroundColor: "rgba(79,70,229,0.12)",
            borderColor: "#4f46e5",
            borderWidth: 2,
            borderRadius: 8,
            borderSkipped: false,
            hoverBackgroundColor: "rgba(79,70,229,0.25)",
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: "#1e293b",
              padding: 10,
              cornerRadius: 8,
              callbacks: { label: (ctx) => ` ${ctx.parsed.y.toLocaleString()} students` },
            },
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { color: "#94a3b8", font: { size: 11, weight: "600" } },
              border: { display: false },
            },
            y: {
              beginAtZero: true,
              grid: { color: "#f1f5f9", lineWidth: 1 },
              ticks: { color: "#94a3b8", font: { size: 11 }, callback: (v) => v.toLocaleString() },
              border: { display: false },
            },
          },
        },
      });
    };

    if (window.Chart) {
      loadChart();
    } else {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js";
      s.onload = loadChart;
      document.head.appendChild(s);
    }

    return () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; } };
  }, [chartData, hasData, loading]);

  return (
    <Card className="p-5">
      <SectionHeading
        icon="fa-chart-bar"
        title="Enrollment analytics"
        subtitle="Students per batch year"
        action={
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-indigo-600 transition hover:border-indigo-200 hover:bg-indigo-50"
          >
            <i className="fas fa-download text-[10px]" aria-hidden="true" />
            Export
          </button>
        }
      />
      {loading ? (
        <Skeleton className="h-56 w-full rounded-xl" />
      ) : !hasData ? (
        <div className="grid h-56 place-items-center rounded-xl border border-dashed border-slate-200 bg-slate-50/70 text-center">
          <div>
            <i className="fas fa-chart-column mb-3 text-3xl text-slate-300" aria-hidden="true" />
            <p className="text-sm font-bold text-slate-700">No enrollment data yet</p>
            <p className="mt-1 text-xs text-slate-400">Data will appear here once batches are populated.</p>
          </div>
        </div>
      ) : (
        <div className="relative h-56">
          <canvas ref={canvasRef} role="img" aria-label="Bar chart showing enrolled students per batch year" />
        </div>
      )}
    </Card>
  );
}

// Trending Alumni
function TrendingAlumni({ items, loading }) {
  return (
    <Card className="p-5">
      <SectionHeading icon="fa-fire" title="Trending alumni" />

      <div className="flex flex-col gap-2.5">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-full flex-shrink-0" />
              <div className="flex-1">
                <Skeleton className="mb-1.5 h-3 w-3/5" />
                <Skeleton className="h-3 w-2/5" />
              </div>
              <Skeleton className="h-5 w-14 rounded-full" />
            </div>
          ))
        ) : items.length === 0 ? (
          <div className="py-8 text-center">
            <i className="fas fa-user-slash mb-2 text-2xl text-slate-200" aria-hidden="true" />
            <p className="text-sm text-slate-400">No trending alumni yet.</p>
          </div>
        ) : (
          items.map((a, i) => {
            const name = a.name?.trim() || "Unknown user";
            const hasName = Boolean(a.name?.trim());
            return (
            <div key={a.id ?? i} className="flex items-center gap-3 rounded-xl p-2 transition hover:bg-slate-50">
              <div className={cx(
                "grid h-9 w-9 shrink-0 place-items-center rounded-full border text-xs font-bold",
                hasName ? "border-indigo-100 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-slate-100 text-slate-500",
              )}>
                {hasName ? (a.avatar_initials ?? name.slice(0, 2).toUpperCase()) : "?"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-slate-800">{name}</p>
                <p className="truncate text-xs text-slate-400">{a.program}</p>
              </div>
              <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-100 whitespace-nowrap">
                {fmt(a.views)} views
              </span>
            </div>
            );
          })
        )}
      </div>
    </Card>
  );
}

// Recent Uploads
const TYPE_STYLES = {
  image: { bg: "#ede9fe", color: "#4338ca", icon: "fa-image",      label: "IMG" },
  video: { bg: "#fef3c7", color: "#92400e", icon: "fa-video",      label: "VID" },
  audio: { bg: "#d1fae5", color: "#065f46", icon: "fa-music",      label: "AUD" },
  doc:   { bg: "#f0f9ff", color: "#0369a1", icon: "fa-file-lines", label: "DOC" },
};

function RecentUploads({ items, loading }) {
  return (
    <Card className="p-5">
      <SectionHeading icon="fa-upload" title="Recent uploads" />

      <div className="flex flex-col gap-2.5">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
              <div className="flex-1">
                <Skeleton className="mb-1.5 h-3 w-2/3" />
                <Skeleton className="h-3 w-2/5" />
              </div>
            </div>
          ))
        ) : items.length === 0 ? (
          <div className="py-8 text-center">
            <i className="fas fa-inbox mb-2 text-2xl text-slate-200" aria-hidden="true" />
            <p className="text-sm text-slate-400">No recent uploads.</p>
          </div>
        ) : (
          items.map((u, i) => {
            const s = TYPE_STYLES[u.type] ?? TYPE_STYLES.doc;
            return (
              <div key={u.id ?? i} className="flex items-center gap-3 rounded-xl p-2 transition hover:bg-slate-50">
                <div
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-xs font-bold"
                  style={{ background: s.bg, color: s.color }}
                >
                  <i className={cx("fas", s.icon)} aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-800">{u.filename}</p>
                  <p className="truncate text-xs text-slate-400">{u.uploader} · {u.time}</p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}

// Activity Feed
const ACTIVITY_COLORS = {
  register: { dot: "bg-emerald-500", bg: "bg-emerald-50",  text: "text-emerald-700", icon: "fa-user-plus"   },
  upload:   { dot: "bg-blue-500",    bg: "bg-blue-50",     text: "text-blue-700",    icon: "fa-upload"      },
  update:   { dot: "bg-amber-500",   bg: "bg-amber-50",    text: "text-amber-700",   icon: "fa-pen"         },
  delete:   { dot: "bg-red-500",     bg: "bg-red-50",      text: "text-red-700",     icon: "fa-trash"       },
  settings: { dot: "bg-violet-500",  bg: "bg-violet-50",   text: "text-violet-700",  icon: "fa-gear"        },
  login:    { dot: "bg-cyan-500",    bg: "bg-cyan-50",     text: "text-cyan-700",    icon: "fa-right-to-bracket" },
  default:  { dot: "bg-slate-400",   bg: "bg-slate-100",   text: "text-slate-600",   icon: "fa-circle-dot"  },
};

function ActivityFeed({ items, loading, onViewAll }) {
  return (
    <Card className="p-5">
      <SectionHeading
        icon="fa-bolt"
        title="Recent audit activity"
        action={
          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-emerald-600">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
            Live
          </span>
        }
      />

      <div className="flex flex-col gap-2">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3 rounded-xl p-2">
              <Skeleton className="mt-1 h-7 w-7 rounded-lg flex-shrink-0" />
              <div className="flex-1">
                <Skeleton className="mb-1.5 h-3 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))
        ) : items.length === 0 ? (
          <div className="py-8 text-center">
            <i className="fas fa-list-check mb-2 text-2xl text-slate-200" aria-hidden="true" />
            <p className="text-sm text-slate-400">No recent activity.</p>
          </div>
        ) : (
          items.map((a, i) => {
            const s = ACTIVITY_COLORS[a.type] ?? ACTIVITY_COLORS.default;
            return (
              <div key={a.id ?? i} className="flex items-start gap-3 rounded-xl p-2 transition hover:bg-slate-50">
                <div
                  className={cx(
                    "grid h-7 w-7 shrink-0 place-items-center rounded-lg text-xs",
                    s.bg, s.text,
                  )}
                >
                  <i className={cx("fas", s.icon)} aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-800 leading-snug">{a.title}</p>
                  <div className="mt-0.5 flex flex-wrap gap-x-2 text-[11px] text-slate-400">
                    <span>{a.subject}</span>
                    <span>·</span>
                    <span>{a.time}</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <button
        onClick={onViewAll}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-bold text-indigo-600 transition hover:border-indigo-200 hover:bg-indigo-50"
      >
        <i className="fas fa-arrow-right text-[10px]" aria-hidden="true" />
        View full log
      </button>
    </Card>
  );
}

// Engagement Card
function EngagementBar({ label, value, max, barColor, loading }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="mb-4 last:mb-0">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500">{label}</span>
        {loading
          ? <Skeleton className="h-3 w-10" />
          : <span className="text-xs font-bold text-slate-800">{value.toLocaleString()}</span>
        }
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
        {!loading && (
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${pct}%`, background: barColor }}
          />
        )}
        {loading && <Skeleton className="h-full w-full" />}
      </div>
    </div>
  );
}

function EngagementCard({ data, loading }) {
  const maxVal = data
    ? Math.max(data.weekly_visits ?? 0, data.returning_alumni ?? 0, data.new_registrations ?? 0, 1)
    : 1;

  const bars = [
    { label: "Weekly visits",      key: "weekly_visits",      color: "#4f46e5" },
    { label: "Returning alumni",   key: "returning_alumni",   color: "#10b981" },
    { label: "New registrations",  key: "new_registrations",  color: "#f59e0b" },
  ];

  return (
    <Card className="p-5">
      <SectionHeading icon="fa-chart-line" title="Engagement overview" />
      {bars.map(b => (
        <EngagementBar
          key={b.key}
          label={b.label}
          value={data?.[b.key] ?? 0}
          max={maxVal}
          barColor={b.color}
          loading={loading}
        />
      ))}
    </Card>
  );
}

// Page Header
function PageHeader({ lastRefresh, onRefresh, refreshing }) {
  const today = new Date().toLocaleDateString("en-PH", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="mb-0.5 text-xs font-semibold text-indigo-400 uppercase tracking-wider">{today}</p>
        <h1 className="text-2xl font-black tracking-tight text-slate-800">Dashboard</h1>
        <p className="mt-0.5 text-sm text-slate-400">
          Manage your yearbook system data efficiently.
          {lastRefresh && <span className="ml-1.5">· Last updated: {lastRefresh}</span>}
        </p>
      </div>
      <button
        onClick={onRefresh}
        disabled={refreshing}
        className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-indigo-600 transition hover:border-indigo-200 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <i className={cx("fas fa-rotate-right text-xs", refreshing && "animate-spin")} aria-hidden="true" />
        Refresh
      </button>
    </div>
  );
}

// Main Page
export default function DashboardPage() {
  const navigate = useNavigate();

  const [data,        setData]        = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [refreshing,  setRefreshing]  = useState(false);
  const [lastRefresh, setLastRefresh] = useState(null);

  const load = useCallback(async (isRefresh = false) => {
    const silent = isRefresh === "silent";
    if (isRefresh === true) setRefreshing(true);
    else if (!silent) setLoading(true);
    if (!silent) setError(null);
    try {
      const res = await api.get(DASHBOARD_API_PATH);
      setData(res.data);
    } catch (err) {
      const msg =
        err.response?.data?.message ??
        err.response?.data?.error ??
        err.message ??
        "Failed to load dashboard data.";
      if (!silent) setError(msg);
    } finally {
      if (!silent) setLoading(false);
      if (isRefresh === true) setRefreshing(false);
      setLastRefresh(
        new Date().toLocaleTimeString(LOCALE, { hour: "2-digit", minute: "2-digit" }),
      );
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const refresh = () => load(true);
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const timer = window.setInterval(() => load("silent"), 8000);
    window.addEventListener("admin-users-changed", refresh);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("admin-users-changed", refresh);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  // Enrich metric cards with icon/color config matching the design system
  const ICON_MAP = {
    "Registered Users":     { icon: "fa-users", iconBg: "#dbeafe", iconColor: "#1d4ed8", subBg: "#dbeafe", subColor: "#1d4ed8" },
    "Current Students":     { icon: "fa-user-graduate", iconBg: "#e0f2fe", iconColor: "#0369a1", subBg: "#e0f2fe", subColor: "#0369a1" },
    "Alumni":               { icon: "fa-user-check", iconBg: "#fef3c7", iconColor: "#92400e", subBg: "#fef3c7", subColor: "#92400e" },
    "Verified":             { icon: "fa-circle-check", iconBg: "#d1fae5", iconColor: "#065f46", subBg: "#d1fae5", subColor: "#065f46" },
    "Unverified":           { icon: "fa-clock", iconBg: "#ffedd5", iconColor: "#9a3412", subBg: "#ffedd5", subColor: "#9a3412" },
    "Batches":              { icon: "fa-graduation-cap", iconBg: "#e0e7ff", iconColor: "#3730a3", subBg: "#e0e7ff", subColor: "#3730a3" },
    "Sections":             { icon: "fa-layer-group", iconBg: "#ede9fe", iconColor: "#5b21b6", subBg: "#ede9fe", subColor: "#5b21b6" },
    "Faculty Members":      { icon: "fa-chalkboard-user",iconBg: "#ede9fe", iconColor: "#4338ca", subBg: "#ede9fe", subColor: "#4338ca" },
    "Gallery Photos":       { icon: "fa-images",        iconBg: "#fef3c7", iconColor: "#92400e", subBg: "#fef3c7", subColor: "#92400e" },
    "Active Subscriptions": { icon: "fa-crown",         iconBg: "#ede9fe", iconColor: "#4338ca", subBg: "#ede9fe", subColor: "#4338ca" },
    "System Alerts":        { icon: "fa-triangle-exclamation", iconBg: "#fee2e2", iconColor: "#991b1b", subBg: "#fee2e2", subColor: "#991b1b" },
  };

  const metricCards = buildMetricCards(data?.metrics).map((card) => ({
    ...card,
    rawValue: card.value,
    cardType: card.metricKey === "system_alerts" && Number(card.value ?? 0) > 0 ? "danger" : card.cardType,
    value: typeof card.value === "number" ? fmt(card.value) : card.value,
    ...(ICON_MAP[card.label] ?? {
      icon: "fa-circle-info",
      iconBg: "#f1f5f9",
      iconColor: "#475569",
      subBg: "#f1f5f9",
      subColor: "#475569",
    }),
  }));

  return (
    <div className="min-h-screen bg-[#f4f6fb] px-6 py-7">
      <PageHeader
        lastRefresh={lastRefresh}
        onRefresh={() => load(true)}
        refreshing={refreshing}
      />

      {/* Error banner */}
      {error && (
        <div className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          <div className="flex items-center gap-2">
            <i className="fas fa-circle-exclamation text-red-500" aria-hidden="true" />
            {error}
          </div>
          <button
            onClick={() => load()}
            className="shrink-0 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      )}

      {/* Metric cards */}
      <div className="mb-5 grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
        {metricCards.map((card) => (
          <MetricCard key={card.label} {...card} loading={loading} />
        ))}
      </div>

      {/* Engagement */}
      <div className="mb-5">
        <EngagementCard data={data?.engagement} loading={loading} />
      </div>

      {/* Chart + Trending */}
      <div className="mb-5 grid grid-cols-1 gap-4 xl:grid-cols-[1fr_300px]">
        <EnrollmentChart data={data?.enrollment_by_year} loading={loading} />
        <TrendingAlumni  items={data?.trending_alumni ?? []} loading={loading} />
      </div>

      {/* Uploads + Activity */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <RecentUploads items={data?.recent_uploads ?? []} loading={loading} />
        <ActivityFeed
          items={data?.recent_activity ?? []}
          loading={loading}
          onViewAll={() => navigate(AUDIT_LOGS_PATH)}
        />
      </div>
    </div>
  );
}
