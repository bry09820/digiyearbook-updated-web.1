import { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { useAlumniList, useYearbookDeepLink } from '../hooks/useAlumniTracker';
import { faceApi } from '@/api/gallery.api';
import FaceSearchButton from '@/components/ui/FaceSearchButton';
import { imageUrl, avatarUrl } from '@/utils/imageUrl';
import LoadingSkeleton from '@/components/ui/LoadingSkeleton';

const GOLD = '#fdb813';
const NAVY = '#1d2b4b';

function normalizeText(value) {
  return String(value ?? '').trim().toLowerCase();
}

function alumniMatchIds(alumni) {
  return [
    alumni?.id,
    alumni?.user_id,
    alumni?.account_user_id,
    alumni?.student_id,
    alumni?.student?.id,
    alumni?.student?.user_id,
  ].map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0);
}

function faceMatchIds(match) {
  return [
    match?.account_user_id,
    match?.user_id,
    match?.student_user_id,
    match?.student_record_id,
    match?.student_id,
    match?.id,
  ].map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0);
}

function usableFaceMatches(matches = []) {
  const normalized = matches
    .map((match) => ({ ...match, match_ids: faceMatchIds(match) }))
    .filter((match) => match.match_ids.length);

  return Array.from(new Map(normalized.map((match) => [match.match_ids[0], match])).values());
}


// Alumni Card


function AlumniCard({ alumni }) {
  const { yearbookUrl, loading: linkLoading } = useYearbookDeepLink(alumni.id);
  const pic = imageUrl(alumni.profile_picture) || avatarUrl(alumni.name);

  const badges = [
    alumni.batch_year ? { key: 'batch', icon: 'fa-graduation-cap', label: `Batch ${alumni.batch_year}`, tone: 'gold' } : null,
    alumni.academic_status ? { key: 'status', icon: 'fa-user-graduate', label: alumni.academic_status, tone: 'navy' } : null,
    alumni.course ? { key: 'course', icon: 'fa-book', label: alumni.course, tone: 'slate' } : null,
  ].filter(Boolean);

  return (
    <article className="alumni-card">
      <div className="alumni-card-accent" />

      <div className="alumni-card-body">
        <div className="alumni-card-identity">
          <div className="alumni-card-avatar">
            <img src={pic} alt={alumni.name} />
            {alumni.is_verified && (
              <span className="alumni-card-verified" aria-label="Verified">
                <i className="fas fa-check" />
              </span>
            )}
          </div>
          <div className="alumni-card-heading">
            <h4 className="alumni-card-name">{alumni.name}</h4>
            <p className="alumni-card-meta">{alumni.section || 'Section not listed'}</p>
          </div>
        </div>

        {badges.length > 0 && (
          <div className="alumni-badges">
            {badges.map((badge) => (
              <span key={badge.key} className={`alumni-badge alumni-badge-${badge.tone}`}>
                <i className={`fas ${badge.icon}`} />
                <span>{badge.label}</span>
              </span>
            ))}
          </div>
        )}

        <div className="alumni-career">
          {alumni.career?.job_title && (
            <div className="alumni-career-row">
              <span className="alumni-career-icon"><i className="fas fa-briefcase" /></span>
              <div className="alumni-card-heading">
                <p className="alumni-card-line alumni-card-line-strong">{alumni.career.job_title}</p>
                {alumni.career.company && (
                  <p className="alumni-card-line">{alumni.career.company}</p>
                )}
              </div>
            </div>
          )}

          {alumni.career?.location && (
            <div className="alumni-career-row">
              <span className="alumni-career-icon"><i className="fas fa-location-dot" /></span>
              <p className="alumni-card-line">{alumni.career.location}</p>
            </div>
          )}

          {alumni.career?.field && (
            <span className="alumni-badge alumni-badge-field">
              <i className="fas fa-tag" />
              <span>{alumni.career.field}</span>
            </span>
          )}
        </div>
      </div>

      <div className="alumni-actions">
        <Link to={`/students/${alumni.student_id ?? alumni.id}`} className="alumni-action alumni-action-primary">
          <i className="fas fa-user" />
          View Profile
        </Link>

        {yearbookUrl ? (
          <Link to={yearbookUrl} title="View this alumni's page in the yearbook" className="alumni-action alumni-action-yearbook">
            <i className="fas fa-book-open" />
            Yearbook
          </Link>
        ) : (
          !linkLoading && (
            <span className="alumni-action alumni-action-muted" aria-hidden="true">
              <i className="fas fa-book" />
            </span>
          )
        )}
      </div>
    </article>
  );
}


// Filter Bar


function FilterBar({ filters, onFilter, batches = [], onFaceFile, faceSearching = false }) {
  const FIELDS = ['Engineering', 'Business', 'Education', 'Health Sciences', 'Technology', 'Arts', 'Law', 'Other'];

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
      {/* Search */}
      <div style={{ position: 'relative', flex: '1 1 220px' }}>
        <i className="fas fa-search" style={{
          position: 'absolute', left: 14, top: '50%',
          transform: 'translateY(-50%)',
          color: '#cbd5e1', fontSize: 13, pointerEvents: 'none',
        }} />
        <input
          type="text"
          placeholder="Search alumni…"
          value={filters.q ?? ''}
          onChange={e => onFilter('q', e.target.value)}
          style={{
            width: '100%', height: 44,
            padding: '0 52px 0 42px',
            border: '1.5px solid #e2e8f0', borderRadius: 12,
            fontSize: '0.82rem', color: NAVY,
            outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
          }}
          onFocus={e => e.target.style.borderColor = '#3f51b5'}
          onBlur={e  => e.target.style.borderColor = '#e2e8f0'}
        />
        <FaceSearchButton onFile={onFaceFile} loading={faceSearching} />
      </div>

      {/* Batch */}
      {batches.length > 0 && (
        <select
          value={filters.batch_id ?? ''}
          onChange={e => onFilter('batch_id', e.target.value || undefined)}
          style={{ height: 44, padding: '0 14px', border: '1.5px solid #e2e8f0', borderRadius: 12, fontSize: '0.82rem', color: NAVY, outline: 'none', fontFamily: 'inherit', background: '#fff', cursor: 'pointer' }}
        >
          <option value="">All Batches</option>
          {batches
            .filter(b => {
              const year = Number(b.year ?? b.graduation_year);
              return year >= 2022 && year <= new Date().getFullYear();
            })
            .map(b => <option key={b.id} value={b.id}>Batch {b.year ?? b.graduation_year}</option>)}
        </select>
      )}

      {/* Career field */}
      <select
        value={filters.field ?? ''}
        onChange={e => onFilter('field', e.target.value || undefined)}
        style={{ height: 44, padding: '0 14px', border: '1.5px solid #e2e8f0', borderRadius: 12, fontSize: '0.82rem', color: NAVY, outline: 'none', fontFamily: 'inherit', background: '#fff', cursor: 'pointer' }}
      >
        <option value="">All Fields</option>
        {FIELDS.map(f => <option key={f} value={f}>{f}</option>)}
      </select>
    </div>
  );
}


// Main Page


export default function AlumniTrackerPage() {
  const [searchParams]   = useSearchParams();
  const batchFromYearbook = searchParams.get('batch_id');
  const highlightAlumniId = searchParams.get('highlight');

  const { list, loading, error, meta, filters, applyFilter, clearFilters } =
    useAlumniList({ batch_id: batchFromYearbook ?? undefined });

  const [batches, setBatches] = useState([]);
  const [faceSearching, setFaceSearching] = useState(false);
  const [faceMatches, setFaceMatches] = useState([]);
  const [matchedIds, setMatchedIds] = useState(new Set());

  const clearFace = () => {
    setFaceMatches([]);
    setMatchedIds(new Set());
  };

  const handleFilter = (key, value) => {
    clearFace();
    applyFilter(key, value);
  };

  const handleClearFilters = () => {
    clearFace();
    clearFilters();
  };

  const handleFaceFile = async (file) => {
    setFaceSearching(true);
    setFaceMatches([]);
    setMatchedIds(new Set());
    try {
      const formData = new FormData();
      formData.append('face_image', file);
      const { data } = await faceApi.search(formData);
      const matches = usableFaceMatches(data?.matches ?? data?.data?.matches ?? []);
      if (!matches.length) {
        alert('No matching alumni found. Use a clear front-facing photo.');
        return;
      }
      setFaceMatches(matches);
      setMatchedIds(new Set(matches.flatMap((match) => match.match_ids)));
    } catch (requestError) {
      alert(requestError?.response?.data?.message || 'Face search failed. Please try again.');
    } finally {
      setFaceSearching(false);
    }
  };

  const visibleAlumni = useMemo(() => {
    const query = normalizeText(filters.q);
    const field = normalizeText(filters.field);

    return list.filter((alumni) => {
      const searchable = [
        alumni?.name,
        alumni?.full_name,
        alumni?.email,
        alumni?.section,
        alumni?.course,
        alumni?.batch_year,
        alumni?.career?.job_title,
        alumni?.career?.company,
        alumni?.career?.location,
        alumni?.career?.field,
      ].map(normalizeText).join(' ');
      const textMatch = !query || searchable.includes(query);
      const fieldMatch = !field || normalizeText(alumni?.career?.field).includes(field);
      const faceMatch = matchedIds.size === 0 || alumniMatchIds(alumni).some((id) => matchedIds.has(id));
      return textMatch && fieldMatch && faceMatch;
    });
  }, [filters.field, filters.q, list, matchedIds]);

  useEffect(() => {
    import('@/api/yearbook.api').then(({ yearbookApi }) => {
      yearbookApi.batches?.()
        .then(({ data }) => setBatches(data?.data ?? []))
        .catch(() => {});
    }).catch(() => {});
  }, []);

  // Scroll to highlighted alumni
  useEffect(() => {
    if (highlightAlumniId && !loading) {
      const el = document.getElementById('highlighted-alumni');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightAlumniId, loading]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f8fafc', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .alumni-card-anim { animation: fadeInUp 0.4s ease both; }
        .alumni-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr));
          gap: 20px;
          align-items: stretch;
        }
        .alumni-grid-item {
          display: flex;
          min-width: 0;
          height: 100%;
        }
        .alumni-card {
          display: flex;
          flex-direction: column;
          width: 100%;
          height: 100%;
          min-width: 0;
          background: #fff;
          border-radius: 24px;
          border: 1px solid #f1f5f9;
          box-shadow: 0 4px 20px rgba(29,43,75,0.06);
          overflow: hidden;
          transition: box-shadow 0.2s ease, transform 0.2s ease;
        }
        .alumni-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 16px 36px rgba(29,43,75,0.12);
        }
        .alumni-card-accent {
          height: 6px;
          flex: 0 0 auto;
          background: linear-gradient(90deg, #1d2b4b, #fdb813);
        }
        .alumni-card-body {
          display: flex;
          flex-direction: column;
          gap: 14px;
          flex: 1 1 auto;
          min-width: 0;
          padding: 20px 20px 16px;
        }
        .alumni-card-identity,
        .alumni-career-row {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          min-width: 0;
        }
        .alumni-card-avatar {
          position: relative;
          flex: 0 0 auto;
        }
        .alumni-card-avatar img {
          display: block;
          width: 60px;
          height: 60px;
          border-radius: 18px;
          object-fit: cover;
          border: 2px solid #fdb813;
        }
        .alumni-card-verified {
          position: absolute;
          right: -4px;
          bottom: -4px;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #3f51b5;
          border: 2px solid #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          font-size: 8px;
        }
        .alumni-card-heading { min-width: 0; flex: 1 1 auto; }
        .alumni-card-name,
        .alumni-card-meta,
        .alumni-card-line,
        .alumni-badge span {
          margin: 0;
          overflow-wrap: anywhere;
          word-break: break-word;
        }
        .alumni-card-name {
          font-size: 0.95rem;
          font-weight: 800;
          line-height: 1.3;
          color: #1d2b4b;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .alumni-card-meta {
          margin-top: 4px;
          font-size: 0.72rem;
          font-weight: 600;
          line-height: 1.35;
          color: #64748b;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .alumni-badges {
          display: flex;
          flex-wrap: wrap;
          align-content: flex-start;
          gap: 8px;
          min-width: 0;
        }
        .alumni-badge {
          display: inline-flex;
          align-items: flex-start;
          gap: 5px;
          max-width: 100%;
          border-radius: 20px;
          padding: 4px 11px;
          line-height: 1.35;
          box-sizing: border-box;
        }
        .alumni-badge i { flex: 0 0 auto; margin-top: 2px; font-size: 10px; }
        .alumni-badge span { font-size: 0.65rem; font-weight: 800; }
        .alumni-badge-gold { background: rgba(253,184,19,0.12); border: 1px solid rgba(253,184,19,0.3); color: #92590e; }
        .alumni-badge-gold i { color: #fdb813; }
        .alumni-badge-navy { background: rgba(29,43,75,0.06); color: #1d2b4b; }
        .alumni-badge-navy i { color: #1d2b4b; }
        .alumni-badge-slate { background: #f8fafc; border: 1px solid #e2e8f0; color: #475569; }
        .alumni-badge-slate i { color: #64748b; }
        .alumni-badge-field { align-self: flex-start; background: rgba(63,81,181,0.08); color: #3f51b5; }
        .alumni-badge-field i { color: #3f51b5; font-size: 9px; }
        .alumni-career {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 10px;
          flex: 1 1 auto;
          min-width: 0;
          min-height: 72px;
        }
        .alumni-career-icon {
          width: 28px;
          height: 28px;
          border-radius: 8px;
          background: rgba(29,43,75,0.06);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex: 0 0 auto;
          color: #1d2b4b;
          font-size: 11px;
        }
        .alumni-card-line { font-size: 0.72rem; font-weight: 600; line-height: 1.35; color: #64748b; }
        .alumni-card-line-strong {
          font-weight: 700;
          color: #1d2b4b;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .alumni-actions {
          display: flex;
          flex-wrap: wrap;
          align-items: stretch;
          gap: 8px;
          margin-top: auto;
          padding: 14px 20px 18px;
          border-top: 1px solid #f1f5f9;
        }
        .alumni-action {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          min-width: 0;
          min-height: 38px;
          border-radius: 12px;
          padding: 9px 14px;
          font-size: 0.72rem;
          font-weight: 700;
          line-height: 1.2;
          text-decoration: none;
          box-sizing: border-box;
        }
        .alumni-action-primary {
          flex: 1 1 140px;
          background: #1d2b4b;
          color: #fff;
        }
        .alumni-action-primary i { color: #fdb813; font-size: 10px; }
        .alumni-action-primary:hover { background: #3f51b5; }
        .alumni-action-yearbook {
          flex: 1 1 120px;
          background: rgba(253,184,19,0.12);
          border: 1.5px solid rgba(253,184,19,0.3);
          color: #92590e;
        }
        .alumni-action-yearbook:hover { background: #fdb813; color: #1d2b4b; }
        .alumni-action-muted {
          flex: 0 0 auto;
          color: #cbd5e1;
          padding-inline: 10px;
        }
        @media (max-width: 640px) {
          .alumni-page-main { padding: 24px 16px 56px !important; }
          .alumni-grid { gap: 16px; }
        }
      `}</style>

      <Navbar />

      {/* Hero */}
      <header style={{
        background: `linear-gradient(135deg, ${NAVY} 0%, #2a3d66 100%)`,
        minHeight: 140,
        padding: '32px 8%', textAlign: 'center', color: '#fff',
        borderRadius: '0 0 28px 28px', position: 'relative', overflow: 'hidden',
      }}>
        {[180, 120].map((size, i) => (
          <div key={i} aria-hidden="true" style={{
            position: 'absolute', top: i === 0 ? -80 : -36,
            right: i === 0 ? '8%' : '20%',
            width: size, height: size, borderRadius: '50%',
            border: `1px solid rgba(253,184,19,${i === 0 ? 0.07 : 0.04})`,
            pointerEvents: 'none',
          }} />
        ))}

        <p style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(253,184,19,0.6)', marginBottom: 8 }}>
          National University Lipa
        </p>

        <div style={{ width: 42, height: 42, border: `1.5px solid ${GOLD}`, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: GOLD, margin: '0 auto 10px' }}>
          <i className="fas fa-users-line" style={{ fontSize: 16 }} />
        </div>

        <h1 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.5px', margin: '0 0 8px' }}>
          Alumni <span style={{ color: GOLD }}>Tracker</span>
        </h1>

        <p style={{ fontSize: '0.84rem', fontWeight: 300, color: 'rgba(255,255,255,0.65)', maxWidth: 520, margin: '0 auto 14px', lineHeight: 1.55 }}>
          See where your batchmates are now — careers, locations, and their
          chapter in the <strong style={{ fontWeight: 700, color: 'rgba(255,255,255,0.85)' }}>NU Lipa Yearbook</strong>.
        </p>

        {/* Stats */}
        <div style={{
          display: 'inline-flex', gap: 20,
          background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 14, padding: '9px 18px',
        }}>
          {[
            { icon: 'fa-user-graduate', label: 'Alumni',         value: meta.total || '—' },
            { icon: 'fa-link',          label: 'Yearbook Links', value: 'Connected'       },
          ].map(({ icon, label, value }) => (
            <div key={label} style={{ textAlign: 'center' }}>
              <i className={`fas ${icon}`} style={{ color: GOLD, fontSize: 12, display: 'block', marginBottom: 3 }} />
              <div style={{ fontSize: '1rem', fontWeight: 800 }}>{value}</div>
              <div style={{ fontSize: '0.58rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.5)', marginTop: 1 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Back to Yearbook deep-link */}
        {batchFromYearbook && (
          <div style={{ marginTop: 12 }}>
            <Link
              to={`/yearbook/${batchFromYearbook}/view`}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                background: 'rgba(253,184,19,0.15)', border: '1.5px solid rgba(253,184,19,0.4)',
                borderRadius: 50, padding: '9px 22px',
                fontSize: '0.78rem', fontWeight: 700, color: GOLD, textDecoration: 'none',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = GOLD; e.currentTarget.style.color = NAVY; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(253,184,19,0.15)'; e.currentTarget.style.color = GOLD; }}
            >
              <i className="fas fa-arrow-left" />
              Back to Batch {batchFromYearbook} Yearbook
            </Link>
          </div>
        )}
      </header>

      {/* Content */}
      <main className="alumni-page-main" style={{ flex: 1, padding: '32px 6% 72px' }}>

        <div style={{ marginBottom: 32 }}>
          <FilterBar
            filters={filters}
            onFilter={handleFilter}
            batches={batches}
            onFaceFile={handleFaceFile}
            faceSearching={faceSearching}
          />
        </div>

        {faceMatches.length > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: 12, flexWrap: 'wrap', marginBottom: 18,
            background: 'rgba(253,184,19,0.1)', border: '1px solid rgba(253,184,19,0.32)',
            borderRadius: 16, padding: '12px 16px', color: '#92590e',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13, fontWeight: 800 }}>
              <i className="fas fa-camera" style={{ color: GOLD }} />
              {faceMatches.length} face match{faceMatches.length > 1 ? 'es' : ''} found - showing matched alumni only
            </div>
            <button
              type="button"
              onClick={clearFace}
              style={{ border: '1px solid rgba(253,184,19,0.45)', background: 'transparent', borderRadius: 9, color: '#92590e', fontSize: 12, fontWeight: 800, padding: '6px 10px', cursor: 'pointer' }}
            >
              <i className="fas fa-times" /> Clear Face
            </button>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: NAVY }}>
            {loading ? 'Loading…' : `${visibleAlumni.length} Alumni`}
          </h2>
          {(Object.values(filters).some(Boolean) || faceMatches.length > 0) && (
            <button
              onClick={handleClearFilters}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '7px 14px', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', cursor: 'pointer' }}
            >
              <i className="fas fa-times" /> Clear Filters
            </button>
          )}
        </div>

        {loading && (
          <LoadingSkeleton variant="card" count={6} />
        )}

        {!loading && error && (
          <div style={{ textAlign: 'center', padding: '60px 20px', background: '#fff', borderRadius: 24, boxShadow: '0 2px 16px rgba(29,43,75,0.06)' }}>
            <i className="fas fa-circle-exclamation" style={{ fontSize: 40, color: '#ef4444', display: 'block', marginBottom: 12 }} />
            <p style={{ color: '#64748b', fontWeight: 600 }}>{error}</p>
          </div>
        )}

        {!loading && !error && visibleAlumni.length === 0 && (
          <div style={{ textAlign: 'center', padding: '80px 20px', background: '#fff', borderRadius: 24, boxShadow: '0 2px 16px rgba(29,43,75,0.06)' }}>
            <i className="fas fa-users-slash" style={{ fontSize: 48, color: '#e2e8f0', display: 'block', marginBottom: 16 }} />
            <h3 style={{ fontSize: 18, fontWeight: 800, color: NAVY, margin: '0 0 8px' }}>No Alumni Found</h3>
            <p style={{ fontSize: 13, color: '#94a3b8', margin: '0 0 20px' }}>{faceMatches.length ? 'No alumni matched this face in the current list.' : 'Try adjusting your filters.'}</p>
            <button onClick={handleClearFilters} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: NAVY, color: '#fff', border: 'none', padding: '10px 22px', borderRadius: 14, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              <i className="fas fa-rotate-left" /> Clear Filters
            </button>
          </div>
        )}

        {!loading && visibleAlumni.length > 0 && (
          <div className="alumni-grid">
            {visibleAlumni.map((alumni, i) => (
              <div
                key={alumni.id}
                className="alumni-grid-item alumni-card-anim"
                style={{ animationDelay: `${i * 40}ms` }}
                id={alumni.id === Number(highlightAlumniId) ? 'highlighted-alumni' : undefined}
              >
                <AlumniCard alumni={alumni} />
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {!loading && meta.last_page > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 40 }}>
            {Array.from({ length: meta.last_page }, (_, i) => i + 1).map(page => (
              <button
                key={page}
                onClick={() => handleFilter('page', page)}
                style={{
                  width: 38, height: 38, borderRadius: 10,
                  border: 'none', cursor: 'pointer',
                  fontSize: '0.8rem', fontWeight: 700,
                  background: page === meta.current_page ? NAVY : '#fff',
                  color:      page === meta.current_page ? '#fff' : '#64748b',
                  boxShadow: '0 2px 8px rgba(29,43,75,0.07)',
                  transition: 'all 0.15s',
                }}
              >
                {page}
              </button>
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

