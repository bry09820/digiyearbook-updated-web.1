import { useState } from 'react';

export default function PostCard({ post, onClick, isOwn, onMenuClick, onReportClick }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const viewsCount = Number(post.views_count ?? post.views ?? 0);

  const media      = post.media ?? [];
  const mediaCount = media.length || 1;
  const current    = media[activeIdx] ?? {
    file_path:     post.file_path,
    resource_type: post.ai_metadata?.resource_type ?? 'image',
  };
  const isVideo = current.resource_type === 'video'
    || current.file_path?.match(/\.(mp4|mov|webm)(\?|$)/i);
  const isMulti = mediaCount > 1;
  const isReported = Boolean(post.is_reported || media.some(item => item?.is_reported));

  return (
    <div
      className="post-cell relative aspect-square overflow-hidden bg-[#1d2b4b] cursor-pointer"
      onClick={() => onClick?.(post, activeIdx)}
    >
      {/* Media */}
      {isVideo ? (
        <video src={current.file_path} className="w-full h-full object-cover block" muted />
      ) : (
        <img src={current.file_path} alt={post.caption ?? ''} className="w-full h-full object-cover block" />
      )}

      {/* Multi badge */}
      {isMulti && (
        <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm rounded-md px-1.5 py-0.5 flex items-center gap-1 z-[3]">
          <i className="fas fa-images text-white text-[9px]" />
          <span className="text-white text-[10px] font-bold">{activeIdx + 1}/{mediaCount}</span>
        </div>
      )}

      {/* Dot nav */}
      {isMulti && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-1 z-[3]">
          {media.map((_, i) => (
            <div key={i}
              onClick={e => { e.stopPropagation(); setActiveIdx(i); }}
              className={`h-1.5 rounded-full cursor-pointer transition-all duration-200 ${i === activeIdx ? 'w-4 bg-white' : 'w-1.5 bg-white/50'}`}
            />
          ))}
        </div>
      )}

      {/* Video play badge */}
      {isVideo && !isMulti && (
        <i className="fas fa-play-circle absolute top-2 right-2 text-white text-base z-[3]"
          style={{ filter: 'drop-shadow(0 1px 4px rgba(0,0,0,0.6))' }} />
      )}

      {/* Tagged badge */}
      {(post.tagged_users?.length > 0 || post.tagged_students?.length > 0) && (
        <div className="absolute top-2 left-2 max-w-[80%] bg-[#1d2b4b]/75 backdrop-blur-sm rounded-md px-1.5 py-0.5 flex items-center gap-1 z-[3]">
          <i className="fas fa-user-tag text-[#fdb813] text-[9px]" />
          <span className="text-white text-[10px] font-bold truncate">
            {(post.tagged_users ?? post.tagged_students).map(person => person.name).filter(Boolean).join(', ')}
          </span>
        </div>
      )}

      <div className="post-overlay absolute inset-0 bg-[#1d2b4b]/55 opacity-0 transition-opacity duration-200
                      flex items-center justify-center z-[2]">
        <span className="text-white text-sm font-bold">
          <i className="fas fa-eye text-[#fdb813] mr-1" aria-hidden="true" />
          {Number.isFinite(viewsCount) ? viewsCount.toLocaleString() : '0'}
        </span>
      </div>

      {/* Owner menu button */}
      {isOwn && (
        <button
          className="ig-menu-btn absolute bottom-2 right-2 z-20 w-7 h-7 rounded-lg
                     bg-[#1d2b4b]/75 backdrop-blur-sm border border-white/10
                     text-white cursor-pointer flex items-center justify-center
                     text-xs opacity-100 pointer-events-auto"
          onClick={e => { e.stopPropagation(); onMenuClick?.(e, post); }}
        >
          <i className="fas fa-ellipsis-v" />
        </button>
      )}

      {!isOwn && (
        <button
          type="button"
          title={isReported ? 'Reported for review' : 'Report this post'}
          disabled={isReported}
          className={`absolute bottom-2 right-2 z-[4] flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 text-xs text-white opacity-100 backdrop-blur-sm transition ${
            isReported
              ? 'cursor-default bg-emerald-600/85'
              : 'cursor-pointer bg-[#1d2b4b]/75 hover:bg-red-600/85'
          }`}
          onClick={e => {
            e.stopPropagation();
            if (!isReported) onReportClick?.(post);
          }}
        >
          <i className={`fas ${isReported ? 'fa-check' : 'fa-flag'}`} />
        </button>
      )}

      {/* Caption overlay */}
      {post.caption && (
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[#1d2b4b]/85 to-transparent
                        px-2.5 pb-2 pt-6 text-[11px] text-white font-medium leading-tight z-[3]">
          {post.caption.length > 38 ? post.caption.slice(0, 38) + '…' : post.caption}
        </div>
      )}
    </div>
  );
}
