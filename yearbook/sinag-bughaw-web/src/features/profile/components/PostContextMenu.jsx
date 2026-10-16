import { useState, useEffect, useRef } from 'react';
import { profileApi } from '@/api/gallery.api';
import TagPeopleSearch from './TagPeopleSearch';
import { useAuth } from '@/features/auth/hooks/useAuth';

const VIS_OPTS = [
  { value: 'public',  icon: 'fa-globe',        label: 'Public'  },
  { value: 'batchmates', icon: 'fa-users',     label: 'Batchmates' },
  { value: 'private', icon: 'fa-lock',          label: 'Only Me' },
];

const MENU_ITEMS = [
  { icon: 'fa-pen',      iconCls: 'text-indigo-500', bg: 'bg-indigo-50', label: 'Edit Caption & Visibility', sub: 'Change caption or audience',   view: 'edit'           },
  { icon: 'fa-user-tag', iconCls: 'text-emerald-500', bg: 'bg-emerald-50', label: 'Tag People',              sub: 'Tag classmates in this post',  view: 'tag'            },
  { icon: 'fa-trash',    iconCls: 'text-red-500',     bg: 'bg-red-50',     label: 'Delete Post',             sub: 'Permanently remove this post', view: 'confirm_delete' },
];

const uniqueById = (users = []) => Array.from(
  new Map(users.filter(Boolean).map(user => [String(user.id), user])).values()
);

export default function PostContextMenu({ post, onClose, onDelete, onUpdated }) {
  const { user: authUser } = useAuth();
  const sheetRef = useRef(null);

  const [view,        setView]        = useState('menu');
  const [caption,     setCaption]     = useState(post?.caption    ?? '');
  const [visibility,  setVisibility]  = useState(post?.visibility === 'friends' ? 'batchmates' : (post?.visibility ?? 'public'));
  const [taggedUsers, setTaggedUsers] = useState(uniqueById(post?.tagged_users ?? []));
  const [saving,      setSaving]      = useState(false);
  const [deleting,    setDeleting]    = useState(false);
  const [error,       setError]       = useState(null);

  useEffect(() => {
    const h = (e) => { if (sheetRef.current && !sheetRef.current.contains(e.target)) onClose(); };
    const t = setTimeout(() => document.addEventListener('mousedown', h), 50);
    return () => { clearTimeout(t); document.removeEventListener('mousedown', h); };
  }, [onClose]);

  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  const saveEdit = async () => {
    setSaving(true); setError(null);
    try {
      const { data } = await profileApi.updatePost(post.id, {
        caption, visibility, tagged_user_ids: uniqueById(taggedUsers).map(u => u.id),
      });
      onUpdated?.(data.data ?? data);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message ?? 'Failed to save.');
    } finally { setSaving(false); }
  };

  const confirmDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    setError(null);
    try {
      await profileApi.deletePost(post.id);
      onDelete?.(post.id);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message ?? 'Failed to delete post.');
      setDeleting(false);
    }
  };

  const back = () => { setView('menu'); setError(null); };

  return (
    <>
      <style>{`@keyframes sheetUp{from{opacity:0;transform:scale(0.96) translateY(10px)}to{opacity:1;transform:scale(1) translateY(0)}}`}</style>

      {/* Backdrop */}
      <div className="fixed inset-0 z-[8000] bg-[#0f172a]/60 backdrop-blur-[2px]" onClick={onClose} />

      {/* Sheet */}
      <div className="fixed inset-0 z-[8001] flex items-center justify-center pointer-events-none">
        <div ref={sheetRef}
          className="w-[640px] min-w-[560px] max-w-[92vw] bg-white rounded-2xl overflow-visible shadow-2xl border border-slate-100 pointer-events-auto font-sans"
          style={{ animation: 'sheetUp 0.22s cubic-bezier(0.34,1.2,0.64,1)' }}
        >

          {/* MAIN MENU */}
          {view === 'menu' && (
            <>
              {/* Header */}
              <div className="bg-white px-8 py-7 flex items-center gap-3 rounded-t-2xl border-b border-[#f0f0f0]">
                <div className="w-11 h-11 rounded-xl overflow-hidden bg-slate-100 border border-slate-100 shrink-0 flex items-center justify-center">
                  {post.ai_metadata?.resource_type === 'video'
                    ? <i className="fas fa-video text-[#fdb813] text-lg" />
                    : <img src={post.file_path} alt="" className="w-full h-full object-cover" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[#1d2b4b] text-lg font-semibold m-0 leading-none">Post Options</p>
                  <p className="text-slate-400 text-[11px] m-0 mt-1 truncate">
                    {post.caption ? (post.caption.length > 36 ? post.caption.slice(0, 36) + '…' : post.caption) : 'No caption'}
                  </p>
                </div>
                <button onClick={onClose}
                  className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 border-none text-slate-500 hover:text-[#1d2b4b] cursor-pointer flex items-center justify-center text-xs transition">
                  <i className="fas fa-times" />
                </button>
              </div>

              {/* Actions */}
              {MENU_ITEMS.map((item, i, arr) => (
                <button key={item.label}
                  onClick={() => setView(item.view)}
                  className={`w-full min-h-16 flex items-center gap-4 px-8 py-3 bg-white hover:bg-slate-50 transition-colors cursor-pointer border-x-0 border-t-0 text-left
                    ${i < arr.length - 1 ? 'border-b border-[#f0f0f0]' : 'border-b-0'}`}>
                  <div className={`w-10 h-10 rounded-xl ${item.bg} flex items-center justify-center shrink-0`}>
                    <i className={`fas ${item.icon} ${item.iconCls} text-xl`} />
                  </div>
                  <div className="flex-1">
                    <p className="text-[15px] font-medium text-[#1d2b4b] m-0">{item.label}</p>
                    <p className="text-[13px] text-slate-400 m-0 mt-0.5">{item.sub}</p>
                  </div>
                  <i className="fas fa-chevron-right text-slate-400 text-base" />
                </button>
              ))}

              <button onClick={onClose}
                className="mx-8 mb-7 mt-2 h-12 w-[calc(100%-64px)] text-center text-sm font-semibold text-slate-500 bg-transparent hover:bg-slate-50 transition-colors cursor-pointer border border-slate-200 rounded-xl">
                Cancel
              </button>
            </>
          )}

          {/* EDIT VIEW */}
          {view === 'edit' && (
            <>
              <SubHeader title="Edit Post" onBack={back} onAction={saveEdit} actionLabel={saving ? 'Saving…' : 'Save'} saving={saving} />
              <div className="px-8 py-7">
                <FieldLabel>Caption</FieldLabel>
                <textarea value={caption} onChange={e => setCaption(e.target.value)} rows={4}
                  placeholder="Write a caption…"
                  className="w-full min-h-[140px] p-3 border border-[#e0e0e0] focus:border-[#1d2b4b] rounded-lg resize-y text-[15px] text-[#1d2b4b] outline-none bg-white font-sans leading-relaxed transition-colors mb-6 box-border"
                  style={{ fontFamily: 'inherit' }}
                />
                <FieldLabel>Visibility</FieldLabel>
                <div className="flex gap-0">
                  {VIS_OPTS.map((opt, index) => (
                    <button key={opt.value} onClick={() => setVisibility(opt.value)}
                      className={`h-11 flex-1 flex items-center justify-center gap-1.5 text-sm font-medium transition-all cursor-pointer border
                        ${index === 0 ? 'rounded-l-lg' : '-ml-px'}
                        ${index === VIS_OPTS.length - 1 ? 'rounded-r-lg' : ''}
                        ${visibility === opt.value ? 'border-[#1d2b4b] bg-[#1d2b4b] text-white' : 'border-[#1d2b4b] bg-white text-[#1d2b4b] hover:bg-slate-50'}`}>
                      <i className={`fas ${opt.icon} text-[10px]`} /> {opt.label}
                    </button>
                  ))}
                </div>
                {error && <ErrorMsg msg={error} />}
              </div>
            </>
          )}

          {/* TAG VIEW */}
          {view === 'tag' && (
            <>
              <SubHeader title="Tag People" onBack={back} onAction={saveEdit} actionLabel={saving ? 'Saving…' : 'Done'} saving={saving} />
              <div className="px-8 py-7" style={{ minHeight: 260, overflow: 'visible' }}>
                <TagPeopleSearch
                  tagged={taggedUsers}
                  onTag={u   => setTaggedUsers(prev => prev.some(x => String(x.id) === String(u.id)) ? prev : [...prev, u])}
                  onUntag={uid => setTaggedUsers(prev => prev.filter(u => String(u.id) !== String(uid)))}
                  excludeId={authUser?.id}
                />
                {error && <ErrorMsg msg={error} />}
              </div>
            </>
          )}

          {/* CONFIRM DELETE */}
          {view === 'confirm_delete' && (
            <>
              <div className="px-8 py-7 text-center border-b border-[#f0f0f0]">
                <div className="w-16 h-16 rounded-full bg-[#FEF2F2] flex items-center justify-center mx-auto mb-4">
                  <i className="fas fa-trash text-[#DC2626] text-2xl" />
                </div>
                <h3 className="text-lg font-semibold text-[#1d2b4b] mb-2">Are you sure you want to delete this post?</h3>
                <p className="mx-auto max-w-[320px] text-sm text-slate-400 leading-[1.6] m-0">
                  This removes the post and its photos. This action cannot be undone.
                </p>
                {error && <ErrorMsg msg={error} />}
              </div>
              <button onClick={confirmDelete} disabled={deleting}
                className="w-full h-12 text-[#DC2626] text-[15px] font-semibold bg-transparent hover:bg-red-50 transition-colors cursor-pointer border-x-0 border-t border-b border-[#f0f0f0] disabled:opacity-60 disabled:cursor-not-allowed">
                {deleting ? 'Deleting…' : 'Delete Post'}
              </button>
              <button onClick={() => setView('menu')}
                className="w-full h-12 text-[#1d2b4b]/70 text-[15px] font-medium bg-transparent hover:bg-slate-50 transition-colors cursor-pointer border-none rounded-b-2xl">
                Cancel
              </button>
            </>
          )}

        </div>
      </div>
    </>
  );
}

function SubHeader({ title, onBack, onAction, actionLabel, saving }) {
  return (
    <div className="relative flex items-center px-8 py-5 border-b border-slate-100 bg-white rounded-t-2xl">
      <button onClick={onBack}
        className="flex items-center gap-1.5 text-slate-500 hover:text-[#1d2b4b] text-[15px] font-medium transition-colors cursor-pointer border-none bg-transparent p-0">
        <i className="fas fa-arrow-left text-xs" /> Back
      </button>
      <span className="absolute left-1/2 -translate-x-1/2 text-lg font-semibold text-[#1d2b4b]">{title}</span>
      <button onClick={onAction} disabled={saving}
        className="ml-auto text-[#F5A623] text-[15px] font-semibold border-none bg-transparent cursor-pointer p-0 disabled:opacity-50">
        {actionLabel}
      </button>
    </div>
  );
}

function FieldLabel({ children }) {
  return <p className="text-[11px] font-semibold text-[#F5A623] uppercase tracking-[0.8px] mb-2 m-0">{children}</p>;
}

function ErrorMsg({ msg }) {
  return (
    <div className="mt-3 px-3 py-2.5 bg-red-50 border border-red-100 rounded-xl text-xs text-red-500 flex items-center gap-2">
      <i className="fas fa-circle-exclamation shrink-0" /> {msg}
    </div>
  );
}
