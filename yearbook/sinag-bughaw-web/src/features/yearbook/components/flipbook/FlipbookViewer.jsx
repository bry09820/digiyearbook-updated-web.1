/**
 * FlipbookViewer.jsx
 * src/features/yearbook/components/flipbook/FlipbookViewer.jsx
 */
import {
  useRef, useState, useEffect, useCallback, useMemo,
} from 'react';
import HTMLFlipBook           from 'react-pageflip';
import { useNavigate }        from 'react-router-dom';
import YearbookPageRenderer   from './YearbookPageRenderer';
import ControlBar             from '../controls/ControlBar';
import ThumbnailSidebar       from '../sidebar/ThumbnailSidebar';
import SearchPanel            from '../sidebar/SearchPanel';
import BookmarkPanel          from '../sidebar/BookmarkPanel';
import { PAGE_W, PAGE_H }      from '../pages/pageStyles';
import { useFlipbookAlumniLink } from '../../../../hooks/useFlipbookAlumniLink';
import { discoveryRecordPath } from '@/utils/studentProfilePath';

const GOLD       = '#fdb813';
const NAVY       = '#1d2b4b';
const ZOOM_STEPS = [0.8, 1, 1.15, 1.3];

export default function FlipbookViewer({
  pages         = [],
  toc           = [],
  bookmarks     = [],
  searchResults = null,
  batchId,
  onSearch,
  onAddBookmark,
  onRemoveBookmark,
  onDownload,
  currentUser,
  pdfReady,
  isPremium,
  yearbookScope,
}) {
  const navigate = useNavigate();
  const bookRef  = useRef(null);
  const wrapRef  = useRef(null);

  const [currentPage,  setCurrentPage]  = useState(0);
  const [zoomIndex,    setZoomIndex]    = useState(1);
  const [fullscreen,   setFullscreen]   = useState(false);
  const [sidebarTab,   setSidebarTab]   = useState(null);
  const [isAnimating,  setIsAnimating]  = useState(false);

  const { alumniData, loading: alumniLoading, clear } =
    useFlipbookAlumniLink();

  const currentSpread = Math.floor(currentPage / 2);
  const totalSpreads  = Math.ceil(pages.length / 2);
  const zoom          = ZOOM_STEPS[zoomIndex];
  const renderedPages = useMemo(() => {
    const keep = new Set([0, 1, 2, 3, pages.length - 2, pages.length - 1]);
    const buffer = 8;

    for (let i = currentPage - buffer; i <= currentPage + buffer; i += 1) {
      if (i >= 0 && i < pages.length) keep.add(i);
    }

    return pages.map((page, idx) => (
      keep.has(idx) ? page : { type: 'blank', side: page?.side, virtualized: true }
    ));
  }, [pages, currentPage]);

  const handleFlip = useCallback((e) => {
    setCurrentPage(e.data);
    clear();
  }, [clear]);

  const handleInit      = useCallback(() => {}, []);
  const handleFlipStart = useCallback(() => setIsAnimating(true),  []);
  const handleFlipEnd   = useCallback(() => setIsAnimating(false), []);

  const flipNext = useCallback(() => {
    if (!isAnimating) bookRef.current?.pageFlip().flipNext();
  }, [isAnimating]);

  const flipPrev = useCallback(() => {
    if (!isAnimating) bookRef.current?.pageFlip().flipPrev();
  }, [isAnimating]);

  const goToPage = useCallback((pageIndex) => {
    const target = Math.max(0, Math.min(Number(pageIndex) || 0, pages.length - 1));
    const spreadStart = target > 0 && target % 2 !== 0 ? target - 1 : target;
    const pageFlip = bookRef.current?.pageFlip();

    if (typeof pageFlip?.turnToPage === 'function') {
      pageFlip.turnToPage(spreadStart);
    } else {
      pageFlip?.flip(spreadStart);
    }

    setCurrentPage(spreadStart);
    setSidebarTab(null);
  }, [pages.length]);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      wrapRef.current?.requestFullscreen?.()
        .then(() => setFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen?.()
        .then(() => setFullscreen(false)).catch(() => {});
    }
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT') return;
      switch (e.key) {
        case 'ArrowRight': case 'ArrowDown':  flipNext();         break;
        case 'ArrowLeft':  case 'ArrowUp':    flipPrev();         break;
        case 'Home':  goToPage(0);                                break;
        case 'End':   goToPage(pages.length - 1);                 break;
        case 'f': case 'F': toggleFullscreen();                   break;
        case 'Escape': clear();                                   break;
        default: break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [flipNext, flipPrev, goToPage, pages.length, clear, toggleFullscreen]);

  useEffect(() => {
    const handler = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const zoomIn    = () => setZoomIndex((i) => Math.min(i + 1, ZOOM_STEPS.length - 1));
  const zoomOut   = () => setZoomIndex((i) => Math.max(i - 1, 0));
  const zoomReset = () => setZoomIndex(1);

  const handleSearchJump = useCallback((pageIndex) => {
    goToPage(pageIndex);
  }, [goToPage]);

  const handleBookmarkCurrent = useCallback(() => {
    const page  = pages[currentPage];
    const label = pageLabel(page, currentPage);
    onAddBookmark?.(currentPage, label);
  }, [currentPage, pages, onAddBookmark]);

  const isCurrentBookmarked = bookmarks.some((b) => b.pageIndex === currentPage);

  const toggleSidebar = (tab) =>
    setSidebarTab((cur) => (cur === tab ? null : tab));

  // Portrait click -> discovery student profile page.
  const handlePortraitClick = useCallback((studentId) => {
    navigate(discoveryRecordPath(studentId));
  }, [navigate]);

  const handleViewInTracker = useCallback(() => {
    if (alumniData?.tracker_url) navigate(alumniData.tracker_url);
  }, [alumniData, navigate]);

  if (!pages.length) return null;

  return (
    <div
      ref={wrapRef}
      className={`
        flex flex-col items-center
        ${fullscreen ? 'fixed inset-0 z-50 bg-[#0a0a14] overflow-auto' : 'relative'}
      `}
      style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
    >
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .alumni-popup { animation: fadeInUp 0.25s ease both; }
      `}</style>

      <div className="flex w-full justify-center items-start gap-6 px-6 pt-5 pb-8 overflow-x-auto">

        {sidebarTab && (
          <aside className="w-72 flex-shrink-0 sticky top-5 max-h-[78vh] overflow-y-auto rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
            {sidebarTab === 'toc' && (
              <ThumbnailSidebar
                toc={toc}
                currentSpread={currentSpread}
                onNavigate={goToPage}
              />
            )}
            {sidebarTab === 'search' && (
              <SearchPanel
                results={searchResults}
                onSearch={onSearch}
                onJump={handleSearchJump}
              />
            )}
            {sidebarTab === 'bookmarks' && (
              <BookmarkPanel
                bookmarks={bookmarks}
                onJump={goToPage}
                onRemove={onRemoveBookmark}
              />
            )}
          </aside>
        )}

        <div
          className="flex-shrink-0 relative"
          style={{
            transform:       `scale(${zoom})`,
            transformOrigin: 'top center',
            transition:      'transform 0.3s ease',
            marginBottom:    zoom > 1 ? `${(zoom - 1) * PAGE_H + 24}px` : 24,
          }}
        >
          <button
            onClick={flipPrev}
            disabled={currentPage === 0}
            aria-label="Previous page"
            className="absolute left-0 bottom-0 w-14 h-14 z-10 cursor-pointer opacity-0 hover:opacity-100 transition-opacity"
            style={{
              clipPath:   'polygon(0 100%, 100% 100%, 0 0)',
              background: 'linear-gradient(135deg, rgba(201,168,76,.25) 0%, transparent 70%)',
            }}
          />
          <button
            onClick={flipNext}
            disabled={currentPage >= pages.length - 1}
            aria-label="Next page"
            className="absolute right-0 bottom-0 w-14 h-14 z-10 cursor-pointer opacity-0 hover:opacity-100 transition-opacity"
            style={{
              clipPath:   'polygon(100% 100%, 0 100%, 100% 0)',
              background: 'linear-gradient(225deg, rgba(201,168,76,.25) 0%, transparent 70%)',
            }}
          />

          <HTMLFlipBook
            ref={bookRef}
            width={PAGE_W}
            height={PAGE_H}
            size="fixed"
            minWidth={PAGE_W}
            maxWidth={PAGE_W}
            minHeight={PAGE_H}
            maxHeight={PAGE_H}
            showCover={true}
            flippingTime={700}
            useMouseEvents={true}
            swipeDistance={40}
            showPageCorners={true}
            clickEventForward={false}
            usePortrait={false}
            startZIndex={0}
            onFlip={handleFlip}
            onInit={handleInit}
            onFlipStart={handleFlipStart}
            onFlipEnd={handleFlipEnd}
            className="yearbook-flipbook"
          >
            {renderedPages.map((page, idx) => (
              <YearbookPageRenderer
                key={idx}
                page={page}
                pageIndex={idx}
                onNavigate={goToPage}
                onPortraitClick={
                  page.type === 'student-grid' || page.type === 'student-profile'
                    ? handlePortraitClick
                    : undefined
                }
              />
            ))}
          </HTMLFlipBook>
        </div>
      </div>

      <div className="sticky bottom-0 z-20 flex justify-center bg-[#0a0a14]/92 px-4 py-3 backdrop-blur-md border-t border-white/5">
        <ControlBar
          currentPage={currentPage}
          totalPages={pages.length}
          currentSpread={currentSpread}
          totalSpreads={totalSpreads}
          zoom={zoom}
          zoomMin={zoomIndex === 0}
          zoomMax={zoomIndex === ZOOM_STEPS.length - 1}
          fullscreen={fullscreen}
          sidebarTab={sidebarTab}
          isBookmarked={isCurrentBookmarked}
          batchId={batchId}
          pdfReady={pdfReady}
          isPremium={isPremium}
          yearbookScope={yearbookScope}
          onPrev={flipPrev}
          onNext={flipNext}
          onZoomIn={zoomIn}
          onZoomOut={zoomOut}
          onZoomReset={zoomReset}
          onToggleFullscreen={toggleFullscreen}
          onToggleTOC={() => toggleSidebar('toc')}
          onToggleSearch={() => toggleSidebar('search')}
          onToggleBookmarks={() => toggleSidebar('bookmarks')}
          onBookmark={handleBookmarkCurrent}
          onDownload={() => onDownload?.(currentUser?.id)}
        />
      </div>

      {(alumniLoading || alumniData) && (
        <div
          className="alumni-popup"
          style={{
            position: 'fixed', bottom: 32, right: 32, zIndex: 9999,
            width: 290, background: '#fff', borderRadius: 20,
            boxShadow: '0 8px 40px rgba(29,43,75,0.18)',
            border: '1px solid #f1f5f9', overflow: 'hidden',
            fontFamily: "'Plus Jakarta Sans', sans-serif",
          }}
        >
          <div style={{ height: 4, background: `linear-gradient(90deg, ${NAVY}, ${GOLD})` }} />
          <div style={{ padding: '16px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <i className="fas fa-users-line" style={{ color: GOLD, fontSize: 12 }} />
                <span style={{ fontSize: '0.62rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#94a3b8' }}>
                  Alumni Profile
                </span>
              </div>
              <button onClick={clear} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#cbd5e1', fontSize: 14, lineHeight: 1, padding: '2px 4px', borderRadius: 6 }}>
                <i className="fas fa-times" />
              </button>
            </div>

            {alumniLoading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0' }}>
                <i className="fas fa-spinner fa-spin" style={{ color: NAVY, fontSize: 16, flexShrink: 0 }} />
                <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Looking up alumni…</span>
              </div>
            )}

            {!alumniLoading && alumniData && (
              <>
                <p style={{ margin: '0 0 6px', fontWeight: 800, fontSize: '1rem', color: NAVY }}>
                  {alumniData.name}
                </p>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(253,184,19,0.1)', border: '1px solid rgba(253,184,19,0.25)', borderRadius: 20, padding: '3px 9px', marginBottom: 12 }}>
                  <i className="fas fa-graduation-cap" style={{ color: GOLD, fontSize: 9 }} />
                  <span style={{ fontSize: '0.62rem', fontWeight: 800, color: '#92590e' }}>
                    Batch {alumniData.batch_year}
                  </span>
                </div>
                {alumniData.career?.job_title ? (
                  <div style={{ background: '#f8fafc', borderRadius: 10, padding: '10px 12px', marginBottom: 14, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <i className="fas fa-briefcase" style={{ color: NAVY, fontSize: 11, marginTop: 3, flexShrink: 0 }} />
                    <div>
                      <p style={{ margin: 0, fontSize: '0.78rem', fontWeight: 700, color: NAVY }}>{alumniData.career.job_title}</p>
                      {alumniData.career.company && <p style={{ margin: '2px 0 0', fontSize: '0.68rem', color: '#64748b' }}>{alumniData.career.company}</p>}
                      {alumniData.career.location && <p style={{ margin: '3px 0 0', fontSize: '0.65rem', color: '#94a3b8' }}><i className="fas fa-location-dot" style={{ marginRight: 4 }} />{alumniData.career.location}</p>}
                      {alumniData.career.field && (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(63,81,181,0.08)', borderRadius: 6, padding: '2px 7px', marginTop: 5 }}>
                          <i className="fas fa-tag" style={{ color: '#3f51b5', fontSize: 8 }} />
                          <span style={{ fontSize: '0.6rem', fontWeight: 700, color: '#3f51b5' }}>{alumniData.career.field}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <p style={{ fontSize: '0.72rem', color: '#94a3b8', marginBottom: 14, fontStyle: 'italic' }}>No career info on file yet.</p>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={handleViewInTracker}
                    style={{ flex: 1, height: 38, borderRadius: 12, border: 'none', background: NAVY, color: '#fff', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'background 0.2s' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#3f51b5'}
                    onMouseLeave={e => e.currentTarget.style.background = NAVY}
                  >
                    <i className="fas fa-users-line" style={{ color: GOLD, fontSize: 10 }} />
                    Alumni Tracker
                  </button>
                  <button
                    onClick={clear}
                    style={{ height: 38, padding: '0 14px', borderRadius: 12, border: '1.5px solid #e2e8f0', background: '#fff', color: '#94a3b8', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = '#cbd5e1'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = '#e2e8f0'}
                  >
                    Dismiss
                  </button>
                </div>
              </>
            )}

            {!alumniLoading && !alumniData && (
              <div style={{ textAlign: 'center', padding: '8px 0 4px', color: '#94a3b8', fontSize: '0.75rem' }}>
                <i className="fas fa-user-slash" style={{ fontSize: 20, display: 'block', marginBottom: 8 }} />
                No alumni profile linked to this page.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function pageLabel(page, idx) {
  if (!page) return `Page ${idx + 1}`;
  const labels = {
    cover:            'Cover',
    dedication:       'Dedication',
    toc:              'Table of Contents',
    'course-header': page.course?.name ?? 'Course',
    'section-header': page.section?.name ?? 'Section',
    'student-grid':   `${page.section?.name ?? 'Students'} — portraits`,
    'student-profile': `${page.student?.name ?? page.section?.name ?? 'Student'} — profile`,
    gallery:          page.gallery?.name ?? 'Gallery',
    faculty:          'Faculty',
    stats:            'Batch at a Glance',
    closing:          'Closing',
  };
  return labels[page.type] ?? `Page ${idx + 1}`;
}
