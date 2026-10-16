import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { faceApi } from '@/api/gallery.api';
import { imageUrl } from '@/utils/imageUrl';
import PostLightbox from './PostLightbox';
import LoadingSkeleton from '@/components/ui/LoadingSkeleton';

function resolvePhotoUrl(item) {
  const photo = item?.photo ?? item ?? {};
  return imageUrl(
    photo.file_path ??
    photo.photo_url ??
    photo.image_url ??
    photo.url ??
    item?.file_path ??
    item?.photo_url ??
    item?.image_url ??
    item?.url ??
    item?.photo_path
  );
}

function postFromTaggedItem(item) {
  const photo = item?.photo ?? {};
  const media = Array.isArray(photo.media) && photo.media.length
    ? photo.media
    : [{
        file_path: photo.file_path ?? item?.file_path,
        public_id: photo.public_id ?? null,
        resource_type: photo.ai_metadata?.resource_type ?? 'image',
        sort_order: 0,
      }];

  return {
    id: item?.photo_id ?? photo.id ?? item?.id,
    caption: photo.caption ?? item?.caption ?? '',
    file_path: photo.file_path ?? media[0]?.file_path,
    ai_metadata: photo.ai_metadata ?? {},
    created_at: photo.created_at ?? item?.created_at,
    media,
    media_count: media.length,
    user_id: photo.user_id ?? item?.user_id,
    user: photo.user ?? item?.uploaded_by ?? null,
    tagged_students: photo.tagged_students ?? [],
  };
}

function taggedPhotoLink(item) {
  const photo = item?.photo ?? {};
  const albumId = photo.album?.id ?? photo.album_id ?? item?.album?.id ?? item?.album_id;
  const galleryId = photo.gallery_id ?? item?.gallery_id;
  const ownerId = photo.user_id ?? item?.user_id;
  const postId = item?.photo_id ?? photo.id;

  if (ownerId && postId) return `/students/${ownerId}?post=${postId}`;
  if (postId) return `/profile?post=${postId}`;
  if (albumId || galleryId) return '/gallery';
  return '#';
}

export default function StudentPhotosSection({ userId, compact = false, openInModal = false }) {
  const [photos,  setPhotos]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [page,    setPage]    = useState(1);
  const [meta,    setMeta]    = useState(null);
  const [viewer,  setViewer]  = useState(null);

  const load = async (p = 1) => {
    setLoading(true);
    try {
      const { data } = await faceApi.studentPhotos(userId, p);
      setPhotos(data.data ?? []);
      setMeta(data.meta ?? null);
      setPage(p);
    } catch {
      setPhotos([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (userId) load(1); }, [userId]);

  // Loading
  if (loading) return (
    <LoadingSkeleton variant="card" count={compact ? 3 : 6} gridClassName="grid grid-cols-2 gap-3 sm:grid-cols-3" />
  );

  // Empty
  if (!photos.length) return (
    <div className="text-center py-10">
      {compact ? (
        <>
          <div className="grid grid-cols-3 gap-2 mb-3">
            {[0, 1, 2].map(n => (
              <div key={n}
                className="aspect-square rounded-xl border-2 border-dashed border-slate-200 bg-slate-50
                           flex items-center justify-center text-slate-300">
                <i className="fas fa-image text-lg" />
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-400 m-0">No tagged photos yet.</p>
        </>
      ) : (
        <>
          <i className="fas fa-images text-5xl text-slate-200 mb-3 block" />
          <p className="text-sm font-bold text-[#1d2b4b] mb-1">No tagged photos yet</p>
          <p className="text-xs text-slate-400">This student hasn't been identified in any gallery photos.</p>
        </>
      )}
    </div>
  );

  // Compact mode
  if (compact) {
    return (
      <>
        {openInModal && viewer && (
          <PostLightbox
            post={viewer.post}
            initialIdx={viewer.idx}
            onClose={() => setViewer(null)}
          />
        )}
        <div className="grid grid-cols-3 gap-2">
          {(openInModal ? photos : photos.slice(0, 6)).map((item, index) => {
            const photoUrl = resolvePhotoUrl(item);
            const key      = item.id ?? `tagged-${item.photo_id ?? index}`;

            return (
              openInModal ? (
              <button key={key} type="button" onClick={() => setViewer({ post: postFromTaggedItem(item), idx: 0 })}
                className="block w-full border-none bg-transparent p-0 text-left cursor-pointer">
                <div className="relative aspect-square rounded-xl overflow-hidden bg-[#1d2b4b]
                                hover:scale-[1.03] hover:shadow-md transition-all duration-200">
                  {photoUrl ? (
                    <img
                      src={photoUrl}
                      alt={item.photo?.caption || 'Tagged photo'}
                      className="w-full h-full object-cover block"
                      loading="lazy"
                      onError={e => { e.currentTarget.style.display = 'none'; }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[#fdb813] text-2xl">
                      <i className="fas fa-image" />
                    </div>
                  )}

                  {/* Similarity badge */}
                  {item.similarity != null && parseFloat(item.similarity) > 0 && (
                    <div className="absolute bottom-1.5 right-1.5 bg-[#1d2b4b]/85 text-[#fdb813] text-[9px] font-black px-1.5 py-0.5 rounded-md">
                      {parseFloat(item.similarity).toFixed(0)}%
                    </div>
                  )}

                  {/* AI badge rekognition only */}
                  {item.source === 'rekognition' && (
                    <div className="absolute top-1.5 left-1.5 bg-indigo-600/85 text-white text-[8px] font-black px-1.5 py-0.5 rounded-md flex items-center gap-1">
                      <i className="fas fa-wand-magic-sparkles text-[7px]" /> AI
                    </div>
                  )}
                </div>
              </button>
              ) : (
              <Link key={key} to={taggedPhotoLink(item)} className="no-underline block">
                <div className="relative aspect-square rounded-xl overflow-hidden bg-[#1d2b4b]
                                hover:scale-[1.03] hover:shadow-md transition-all duration-200">
                  {photoUrl ? (
                    <img
                      src={photoUrl}
                      alt={item.photo?.caption || 'Tagged photo'}
                      className="w-full h-full object-cover block"
                      loading="lazy"
                      onError={e => { e.currentTarget.style.display = 'none'; }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[#fdb813] text-2xl">
                      <i className="fas fa-image" />
                    </div>
                  )}

                  {item.similarity != null && parseFloat(item.similarity) > 0 && (
                    <div className="absolute bottom-1.5 right-1.5 bg-[#1d2b4b]/85 text-[#fdb813] text-[9px] font-black px-1.5 py-0.5 rounded-md">
                      {parseFloat(item.similarity).toFixed(0)}%
                    </div>
                  )}

                  {item.source === 'rekognition' && (
                    <div className="absolute top-1.5 left-1.5 bg-indigo-600/85 text-white text-[8px] font-black px-1.5 py-0.5 rounded-md flex items-center gap-1">
                      <i className="fas fa-wand-magic-sparkles text-[7px]" /> AI
                    </div>
                  )}
                </div>
              </Link>
              )
            );
          })}
        </div>

        {!openInModal && meta && meta.total > 6 && (
          <p className="text-center text-xs text-[#3f51b5] font-bold mt-3 m-0">
            +{meta.total - 6} more tagged photos
          </p>
        )}
      </>
    );
  }

  // Full paginated mode
  return (
    <section>
      {openInModal && viewer && (
        <PostLightbox
          post={viewer.post}
          initialIdx={viewer.idx}
          onClose={() => setViewer(null)}
        />
      )}
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="flex items-center gap-2.5 font-black text-xl text-[#1d2b4b] m-0">
          <i className="fas fa-user-tag text-[#fdb813]" />
          Tagged in
          {meta && (
            <span className="text-xs font-bold text-white bg-[#3f51b5] rounded-full px-2.5 py-1">
              {meta.total}
            </span>
          )}
        </h3>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {photos.map((item, index) => {
          const photoUrl = resolvePhotoUrl(item);
          const key      = item.id ?? `tagged-full-${item.photo_id ?? index}`;

          return (
            openInModal ? (
            <button key={key} type="button" onClick={() => setViewer({ post: postFromTaggedItem(item), idx: 0 })}
              className="block w-full border-none bg-transparent p-0 text-left cursor-pointer">
              <div className="relative aspect-square rounded-2xl overflow-hidden bg-[#1d2b4b]
                              shadow-sm hover:scale-[1.03] hover:shadow-lg transition-all duration-300 group">
                {photoUrl ? (
                  <img
                    src={photoUrl}
                    alt={item.photo?.caption || 'Gallery photo'}
                    className="w-full h-full object-cover block"
                    loading="lazy"
                    onError={e => { e.currentTarget.style.display = 'none'; }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[#fdb813] text-3xl">
                    <i className="fas fa-image" />
                  </div>
                )}

                {/* Similarity badge */}
                {item.similarity != null && parseFloat(item.similarity) > 0 && (
                  <div className="absolute top-2 right-2 bg-[#1d2b4b]/82 backdrop-blur-sm text-[#fdb813] text-[10px] font-black px-2 py-1 rounded-lg">
                    {parseFloat(item.similarity).toFixed(1)}%
                  </div>
                )}

                {/* AI badge rekognition only */}
                {item.source === 'rekognition' && (
                  <div className="absolute top-2 left-2 bg-indigo-600/85 backdrop-blur-sm text-white text-[9px] font-black px-2 py-1 rounded-lg flex items-center gap-1">
                    <i className="fas fa-wand-magic-sparkles text-[8px]" /> AI
                  </div>
                )}

                {/* Hover overlay with album info */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#1d2b4b]/85 to-transparent
                                opacity-0 group-hover:opacity-100 transition-opacity duration-300
                                flex flex-col justify-end p-3">
                  {item.photo?.album && (
                    <>
                      <p className="text-white text-xs font-bold truncate m-0">{item.photo.album.title}</p>
                      {item.photo.album.event_date && (
                        <p className="text-white/55 text-[10px] m-0 mt-0.5">
                          {new Date(item.photo.album.event_date).toLocaleDateString('en-PH', {
                            month: 'short', day: 'numeric', year: 'numeric',
                          })}
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>
            </button>
            ) : (
            <Link key={key} to={taggedPhotoLink(item)} className="no-underline block">
              <div className="relative aspect-square rounded-2xl overflow-hidden bg-[#1d2b4b]
                              shadow-sm hover:scale-[1.03] hover:shadow-lg transition-all duration-300 group">
                {photoUrl ? (
                  <img
                    src={photoUrl}
                    alt={item.photo?.caption || 'Gallery photo'}
                    className="w-full h-full object-cover block"
                    loading="lazy"
                    onError={e => { e.currentTarget.style.display = 'none'; }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[#fdb813] text-3xl">
                    <i className="fas fa-image" />
                  </div>
                )}

                {item.similarity != null && parseFloat(item.similarity) > 0 && (
                  <div className="absolute top-2 right-2 bg-[#1d2b4b]/82 backdrop-blur-sm text-[#fdb813] text-[10px] font-black px-2 py-1 rounded-lg">
                    {parseFloat(item.similarity).toFixed(1)}%
                  </div>
                )}

                {item.source === 'rekognition' && (
                  <div className="absolute top-2 left-2 bg-indigo-600/85 backdrop-blur-sm text-white text-[9px] font-black px-2 py-1 rounded-lg flex items-center gap-1">
                    <i className="fas fa-wand-magic-sparkles text-[8px]" /> AI
                  </div>
                )}

                <div className="absolute inset-0 bg-gradient-to-t from-[#1d2b4b]/85 to-transparent
                                opacity-0 group-hover:opacity-100 transition-opacity duration-300
                                flex flex-col justify-end p-3">
                  {item.photo?.album && (
                    <>
                      <p className="text-white text-xs font-bold truncate m-0">{item.photo.album.title}</p>
                      {item.photo.album.event_date && (
                        <p className="text-white/55 text-[10px] m-0 mt-0.5">
                          {new Date(item.photo.album.event_date).toLocaleDateString('en-PH', {
                            month: 'short', day: 'numeric', year: 'numeric',
                          })}
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>
            </Link>
            )
          );
        })}
      </div>

      {/* Pagination */}
      {meta && meta.last_page > 1 && (
        <div className="flex items-center justify-center gap-3 mt-8">
          <button
            onClick={() => load(page - 1)}
            disabled={page <= 1 || loading}
            className="px-4 py-2 rounded-xl border-none bg-[#1d2b4b] text-white font-bold text-sm
                       cursor-pointer disabled:opacity-35 hover:bg-[#162038] transition-colors"
          >
            <i className="fas fa-chevron-left" />
          </button>
          <span className="px-4 py-2 rounded-xl bg-white text-[#1d2b4b] font-bold text-sm shadow-sm border border-slate-100">
            {page} / {meta.last_page}
          </span>
          <button
            onClick={() => load(page + 1)}
            disabled={page >= meta.last_page || loading}
            className="px-4 py-2 rounded-xl border-none bg-[#1d2b4b] text-white font-bold text-sm
                       cursor-pointer disabled:opacity-35 hover:bg-[#162038] transition-colors"
          >
            <i className="fas fa-chevron-right" />
          </button>
        </div>
      )}
    </section>
  );
}
