import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { useAnalyticsDashboard } from '../hooks/useAnalytics';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { recordProfileView } from '../../../api/analytics.api';
import {
  trackPageView,
  trackTrendingClick,
  trackTopViewedClick,
  trackAnalyticsTabSwitch,
} from '../../../utils/ga4';
import {
  Flame,
  Eye,
  BarChart2,
  Users,
  Image as ImageIcon,
  MessageSquare,
  Lock,
  AlertCircle,
} from 'lucide-react';

const TABS = [
  { id: 'trending',   label: 'Trending',    icon: Flame     },
  { id: 'top-viewed', label: 'Most Viewed', icon: Eye       },
  { id: 'my-stats',   label: 'My Stats',    icon: BarChart2 },
];

function Avatar({ src, name, size = 44 }) {
  const initials = name?.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        style={{ width: size, height: size }}
        className="rounded-full object-cover shrink-0 border-2 border-yellow-400/30"
      />
    );
  }
  return (
    <div
      style={{ width: size, height: size, fontSize: size * 0.35 }}
      className="rounded-full shrink-0 bg-slate-900 text-yellow-400 flex items-center justify-center font-extrabold border-2 border-yellow-400/30"
    >
      {initials}
    </div>
  );
}

function StatCard({ label, value, icon: Icon, colorClass, bgClass }) {
  return (
    <div className="bg-white rounded-2xl p-5 border-[1.5px] border-slate-100 shadow-[0_2px_12px_rgba(29,43,75,0.06)] flex flex-col gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${bgClass}`}>
        <Icon className={`w-5 h-5 ${colorClass}`} />
      </div>
      <div>
        <div className="text-2xl font-extrabold text-slate-900 leading-none">
          {value ?? '—'}
        </div>
        <div className="text-xs text-slate-400 mt-1">{label}</div>
      </div>
    </div>
  );
}

function Skeleton({ height = 16, radius = 8 }) {
  return (
    <div
      style={{ height, borderRadius: radius }}
      className="bg-[linear-gradient(90deg,#f1f5f9_25%,#e2e8f0_50%,#f1f5f9_75%)] bg-[length:200%_100%] animate-pulse"
    />
  );
}

function AlumniCard({ person, rank, badge, onClick, currentUserId }) {
  const isCurrentUser = currentUserId && String(person.id) === String(currentUserId);
  const displayName = isCurrentUser ? 'You' : person.name;
  const medals = ['🥇', '🥈', '🥉'];

  return (
    <button
      onClick={onClick}
      className="group flex items-center gap-3.5 w-full text-left bg-white hover:bg-indigo-50 border-[1.5px] border-slate-100 hover:border-indigo-600 rounded-2xl p-3.5 cursor-pointer transition-all duration-200 shadow-[0_2px_8px_rgba(29,43,75,0.04)] hover:shadow-[0_8px_24px_rgba(63,81,181,0.1)]"
    >
      <span
        className={`w-7 shrink-0 text-center font-bold ${
          rank <= 3 ? 'text-[20px] text-yellow-400' : 'text-[13px] text-slate-400'
        }`}
      >
        {rank <= 3 ? medals[rank - 1] : `#${rank}`}
      </span>

      <Avatar src={person.profile_picture} name={displayName} size={44} />

      <div className="flex-1 min-w-0">
        <p className="m-0 text-sm font-bold text-slate-900 whitespace-nowrap overflow-hidden text-ellipsis">
          {displayName}
        </p>
        <p className="mt-0.5 text-xs text-slate-400">
          {person.course} · {person.batch || person.graduation_year}
        </p>
      </div>

      <div className="text-right shrink-0">
        <p className="m-0 text-[15px] font-extrabold text-slate-900">
          {(badge ?? 0).toLocaleString()}
        </p>
        <p className="m-0 text-[11px] text-slate-400">views</p>
      </div>
    </button>
  );
}

function SparkBars({ labels, values }) {
  if (!values?.length) return null;
  const max = Math.max(...values, 1);
  const step = Math.max(1, Math.floor(labels.length / 6));

  return (
    <div className="bg-white rounded-2xl p-5 border-[1.5px] border-slate-100 shadow-[0_2px_8px_rgba(29,43,75,0.04)] mt-4">
      <p className="m-0 mb-4 text-[13px] font-semibold text-slate-900">
        Profile views — last {labels.length} days
      </p>
      <div className="flex items-end gap-[3px] h-20">
        {values.map((v, i) => (
          <div
            key={labels[i]}
            title={`${labels[i]}: ${v} views`}
            className="flex-1 rounded-t-[3px] transition-[height] duration-300 bg-gradient-to-t from-indigo-600 to-indigo-400"
            style={{ height: `${Math.max(4, (v / max) * 80)}px` }}
          />
        ))}
      </div>
      <div className="flex mt-1.5">
        {labels.map((l, i) => (
          <span key={l} className="flex-1 text-center text-[10px] text-slate-400">
            {i % step === 0 ? l.slice(5) : ''}
          </span>
        ))}
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, colorClass, bgClass, title, desc }) {
  return (
    <div className="text-center py-[60px] px-10 bg-white rounded-2xl border-[1.5px] border-slate-100 shadow-[0_2px_12px_rgba(29,43,75,0.06)]">
      <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 ${bgClass}`}>
        <Icon className={`w-6 h-6 ${colorClass}`} />
      </div>
      <h3 className="text-base font-extrabold text-slate-900 m-0 mb-2">{title}</h3>
      <p className="text-[13px] text-slate-400 m-0">{desc}</p>
    </div>
  );
}

export default function AnalyticsPage({ isAuthenticated = true }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [tab, setTab] = useState('trending');

  const { summary, trending, topViewed, myStats, trend, batchmates } =
    useAnalyticsDashboard({ isAuthenticated });

  useEffect(() => {
    trackPageView(location.pathname, 'Analytics · Alumni Yearbook');
  }, [location.pathname]);

  useEffect(() => {
    if (tab !== 'my-stats' || !isAuthenticated) return undefined;

    const refresh = () => {
      myStats.refetch(true);
      trend.refetch(true);
    };

    refresh();
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, [tab, isAuthenticated, myStats.refetch, trend.refetch]);

  function handleTabSwitch(tabId) {
    setTab(tabId);
    trackAnalyticsTabSwitch(tabId);
  }

  function handleTrendingClick(person) {
    trackTrendingClick(person);
    if (person.type && person.type !== 'profile') {
      navigate(person.url || '#');
      return;
    }
    recordProfileView(person.id);
    openProfile(person);
  }

  function handleTopViewedClick(person) {
    trackTopViewedClick(person);
    if (person.type && person.type !== 'profile') {
      navigate(person.url || '#');
      return;
    }
    recordProfileView(person.id);
    openProfile(person);
  }

  const topTrending      = trending.data?.[0]  ?? null;
  const topViewedProfile = topViewed.data?.[0] ?? null;
  const currentUserId    = user?.id;
  const topBatchmates    = (batchmates.data?.top_profiles ?? []).filter(
    person => !currentUserId || String(person.id) !== String(currentUserId)
  );

  const openProfile = person => {
    if (currentUserId && String(person.id) === String(currentUserId)) {
      navigate('/profile');
      return;
    }
    navigate(`/students/${person.id}`);
  };

  const heroStats =
    tab === 'trending'
      ? [
          {
            label: 'Total views this week',
            value: trending.loading ? '—' : trending.viewsThisWeek,
            icon: Eye,
          },
          { label: 'Ranked this week', value: trending.data?.length ?? 0,        icon: Flame     },
          { label: 'Top viewed count',  value: topTrending?.views_this_week ?? 0, icon: BarChart2 },
        ]
      : tab === 'top-viewed'
      ? [
          { label: 'Top profile',     value: topViewedProfile?.name ?? 'No data', icon: Users     },
          { label: 'Profile views',   value: topViewedProfile?.views ?? 0,        icon: Eye       },
          { label: 'Profiles ranked', value: topViewed.data?.length ?? 0,         icon: BarChart2 },
        ]
      : [
          { label: 'Personal profile views', value: myStats.data?.profile_views ?? 0,   icon: Eye           },
          { label: 'Photos uploaded',        value: myStats.data?.photos_uploaded ?? 0, icon: ImageIcon     },
          { label: 'Times tagged',           value: myStats.data?.times_tagged ?? 0,    icon: Users         },
          { label: 'Messages sent',          value: myStats.data?.messages_sent ?? 0,   icon: MessageSquare },
        ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans">
      <Navbar />

      {/* Hero Discovery style */}
      <header
        className="text-white text-center relative overflow-hidden"
        style={{
          background:   'linear-gradient(135deg, #1d2b4b 0%, #2a3d66 100%)',
          padding:      '52px 8% 72px',
          borderRadius: '0 0 48px 48px',
        }}
      >
        {/* Decorative blobs */}
        <div className="absolute -top-20 -right-20 w-[360px] h-[360px] rounded-full bg-indigo-500/10 pointer-events-none blur-3xl" />
        <div className="absolute -bottom-16 -left-10 w-[280px] h-[280px] rounded-full bg-yellow-400/5 pointer-events-none blur-2xl" />

        <div className="relative z-10">
          {/* Eyebrow */}
          <p style={{
            fontSize:      '0.7rem',
            fontWeight:    800,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            opacity:       0.6,
            marginBottom:  '14px',
            margin:        '0 0 14px',
          }}>
            National University Lipa
          </p>

          {/* Title */}
          <h1 style={{
            fontSize:      '2.4rem',
            fontWeight:    900,
            letterSpacing: '-1.5px',
            margin:        '0 0 12px',
            lineHeight:    1.1,
          }}>
            Alumni <span style={{ color: '#fdb813' }}>Analytics</span>
          </h1>

          {/* Subtitle */}
          <p style={{
            fontSize:   '0.92rem',
            fontWeight: 300,
            opacity:    0.75,
            maxWidth:   '480px',
            margin:     '0 auto 24px',
            lineHeight: 1.6,
          }}>
            Discover trending profiles and engagement stats across your batch.
          </p>

          {/* Stat pills */}
          {!summary.loading && summary.data && (
            <div className="flex items-center justify-center flex-wrap gap-3">
              {heroStats.map(s => (
                <div
                  key={s.label}
                  style={{
                    display:      'inline-flex',
                    alignItems:   'center',
                    gap:          '8px',
                    background:   'rgba(255,255,255,0.08)',
                    border:       '1px solid rgba(255,255,255,0.12)',
                    backdropFilter: 'blur(12px)',
                    padding:      '8px 18px',
                    borderRadius: '50px',
                  }}
                >
                  <s.icon size={14} style={{ color: '#fdb813', flexShrink: 0 }} />
                  <div className="text-left">
                    <div style={{ fontSize: '1rem', fontWeight: 800, color: 'white', lineHeight: 1.1 }}>
                      {typeof s.value === 'number' ? s.value.toLocaleString() : (s.value ?? '—')}
                    </div>
                    <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>
                      {s.label}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* Tabs bar */}
      <div className="bg-white border-b border-slate-200 shadow-[0_2px_12px_rgba(29,43,75,0.06)] sticky top-16 z-40">
        <div className="max-w-[900px] mx-auto px-10 flex gap-1">
          {TABS.map(t => {
            const active   = t.id === tab;
            const disabled = t.id === 'my-stats' && !isAuthenticated;
            return (
              <button
                key={t.id}
                onClick={() => !disabled && handleTabSwitch(t.id)}
                title={disabled ? 'Sign in to view your personal stats' : undefined}
                className={`flex items-center gap-2 px-5 py-4 bg-transparent border-b-2 text-[13px] whitespace-nowrap transition-all duration-150
                  ${disabled ? 'cursor-not-allowed opacity-50 text-slate-300 border-transparent' : 'cursor-pointer'}
                  ${active
                    ? 'border-[#1d2b4b] text-[#1d2b4b] font-bold'
                    : 'border-transparent text-slate-500 font-medium hover:text-slate-900'}
                `}
              >
                <t.icon className="w-4 h-4" />
                {t.label}
                {t.id === 'my-stats' && !isAuthenticated && <Lock className="w-3 h-3 ml-0.5" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 max-w-[900px] mx-auto w-full px-10 py-9 pb-16 box-border">

        {/* Trending Tab */}
        {tab === 'trending' && (
          <section className="fade-in-up">
            <div className="mb-5">
              <h2 className="m-0 text-lg font-extrabold text-slate-900 flex items-center gap-2">
                <Flame className="w-5 h-5 text-orange-500" /> Trending this week
              </h2>
              <p className="mt-1 text-[13px] text-slate-400">
                Profiles with the most views in the last 7 days
              </p>
            </div>

            {trending.loading ? (
              <div className="flex flex-col gap-2.5">
                {[...Array(6)].map((_, i) => <Skeleton key={i} height={74} radius={16} />)}
              </div>
            ) : trending.error ? (
              <EmptyState
                icon={AlertCircle} colorClass="text-red-500" bgClass="bg-red-500/10"
                title="Failed to load"
                desc="Could not load trending alumni. Please try again."
              />
            ) : trending.data.length === 0 ? (
              <EmptyState
                icon={Flame} colorClass="text-orange-500" bgClass="bg-orange-500/10"
                title="No trending data yet"
                desc="Check back later — views are tracked weekly."
              />
            ) : (
              <div className="flex flex-col gap-2.5">
                {trending.data.map((person, i) => (
                  <AlumniCard
                    key={person.id} person={person} rank={i + 1}
                    badge={person.views_this_week} currentUserId={currentUserId}
                    onClick={() => handleTrendingClick(person)}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {/* Most Viewed Tab */}
        {tab === 'top-viewed' && (
          <section className="fade-in-up">
            <div className="mb-5">
              <h2 className="m-0 text-lg font-extrabold text-slate-900 flex items-center gap-2">
                <Eye className="w-5 h-5 text-indigo-500" /> Most viewed all-time
              </h2>
              <p className="mt-1 text-[13px] text-slate-400">
                Alumni with the highest total profile view counts
              </p>
            </div>

            {topViewed.loading ? (
              <div className="flex flex-col gap-2.5">
                {[...Array(6)].map((_, i) => <Skeleton key={i} height={74} radius={16} />)}
              </div>
            ) : topViewed.error ? (
              <EmptyState
                icon={AlertCircle} colorClass="text-red-500" bgClass="bg-red-500/10"
                title="Failed to load"
                desc="Could not load top viewed alumni. Please try again."
              />
            ) : topViewed.data.length === 0 ? (
              <EmptyState
                icon={Eye} colorClass="text-slate-500" bgClass="bg-slate-500/10"
                title="No data yet"
                desc="Profile views will appear here once alumni start getting visits."
              />
            ) : (
              <div className="flex flex-col gap-2.5">
                {topViewed.data.map((person, i) => (
                  <AlumniCard
                    key={person.id} person={person} rank={i + 1}
                    badge={person.views} currentUserId={currentUserId}
                    onClick={() => handleTopViewedClick(person)}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {/* My Stats Tab */}
        {tab === 'my-stats' && isAuthenticated && (
          <section className="fade-in-up">
            <div className="mb-5">
              <h2 className="m-0 text-lg font-extrabold text-slate-900 flex items-center gap-2">
                <BarChart2 className="w-5 h-5 text-emerald-500" /> Your engagement stats
              </h2>
              <p className="mt-1 text-[13px] text-slate-400">
                How your profile is performing among your batchmates
              </p>
            </div>

            {myStats.loading ? (
              <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3.5">
                {[...Array(5)].map((_, i) => <Skeleton key={i} height={100} radius={16} />)}
              </div>
            ) : myStats.error ? (
              <EmptyState
                icon={AlertCircle} colorClass="text-red-500" bgClass="bg-red-500/10"
                title="Failed to load"
                desc="Could not load your stats. Please try again."
              />
            ) : (
              <>
                <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3.5 mb-2">
                  <StatCard label="Personal profile views" value={Number(myStats.data?.profile_views ?? 0).toLocaleString()} icon={Eye}           colorClass="text-indigo-600"  bgClass="bg-indigo-600/10"  />
                  <StatCard label="Photos uploaded"        value={Number(myStats.data?.photos_uploaded ?? 0).toLocaleString()} icon={ImageIcon}     colorClass="text-emerald-500" bgClass="bg-emerald-500/10" />
                  <StatCard label="Times tagged"           value={Number(myStats.data?.times_tagged ?? 0).toLocaleString()}    icon={Users}         colorClass="text-purple-500"  bgClass="bg-purple-500/10"  />
                  <StatCard label="Messages sent"          value={Number(myStats.data?.messages_sent ?? 0).toLocaleString()}   icon={MessageSquare} colorClass="text-orange-500"  bgClass="bg-orange-500/10"  />
                  <StatCard label="Messages received" value={myStats.data?.messages_received?.toLocaleString()} icon={MessageSquare} colorClass="text-pink-500"    bgClass="bg-pink-500/10"    />
                </div>

                {trend.loading ? (
                  <Skeleton height={120} radius={16} />
                ) : (
                  <SparkBars labels={trend.labels} values={trend.values} />
                )}
              </>
            )}

            {/* Top Batchmates */}
            {topBatchmates.length > 0 && (
              <div className="mt-8">
                <h3 className="m-0 mb-4 text-base font-extrabold text-slate-900">
                  Top batchmates
                </h3>
                <div className="flex flex-col gap-2.5">
                  {topBatchmates.map((person, i) => (
                    <AlumniCard
                      key={person.id} person={person} rank={i + 1} badge={person.views}
                      currentUserId={currentUserId}
                      onClick={() => { recordProfileView(person.id); openProfile(person); }}
                    />
                  ))}
                </div>
              </div>
            )}
          </section>
        )}
      </main>

      <Footer />
    </div>
  );
}