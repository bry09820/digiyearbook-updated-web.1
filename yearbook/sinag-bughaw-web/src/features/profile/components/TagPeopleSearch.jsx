import { useState, useEffect, useRef } from 'react';
import { profileApi } from '@/api/gallery.api';

export default function TagPeopleSearch({ tagged = [], onTag, onUntag, excludeId }) {
  const [query,   setQuery]   = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open,    setOpen]    = useState(false);
  const [searchError, setSearchError] = useState('');
  const debounceRef = useRef(null);
  const wrapperRef  = useRef(null);

  useEffect(() => {
    if (!query.trim()) { setResults([]); setOpen(false); return; }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const { data } = await profileApi.searchClassmates({ q: query, limit: 8 });
        const list = data.data ?? data ?? [];
        setResults(list.filter(u => String(u.id) !== String(excludeId)));
        setSearchError('');
        setOpen(true);
      } catch (err) {
        const status = err.response?.status;
        setResults([]);
        setSearchError(err.response?.data?.message || (status ? `Classmate search failed (HTTP ${status}).` : 'Classmate search did not reach the server.'));
      }
      finally { setLoading(false); }
    }, 350);
    return () => clearTimeout(debounceRef.current);
  }, [query, excludeId]);

  useEffect(() => {
    const h = e => { if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const uniqueTagged = Array.from(new Map(tagged.filter(Boolean).map(user => [String(user.id), user])).values());
  const isTagged = id => uniqueTagged.some(u => String(u.id) === String(id));

  const getAvatar = user =>
    user.profile_picture ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=1d2b4b&color=fff&size=80`;

  return (
    <div ref={wrapperRef} className="relative mt-3">

      {/* Tagged chips */}
      {uniqueTagged.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {uniqueTagged.map(user => (
            <div key={user.id}
              className="flex h-9 items-center gap-2 bg-indigo-50 border border-indigo-100 rounded-full pl-1 pr-3">
              <img src={getAvatar(user)} alt={user.name}
                className="w-7 h-7 rounded-full object-cover" />
              <span className="text-sm font-medium text-[#1d2b4b]">{user.name}</span>
              <button onClick={() => onUntag(user.id)}
                className="text-slate-400 hover:text-red-500 text-sm transition bg-transparent border-none cursor-pointer p-0 leading-none ml-0.5">
                <i className="fas fa-times" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Search input */}
      <div className="flex h-11 items-center gap-2 border border-[#e0e0e0] focus-within:border-[#3f51b5] rounded-lg px-4 bg-white transition-colors">
        <i className="fas fa-user-tag text-slate-400 text-xs" aria-hidden="true" />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => results.length && setOpen(true)}
          placeholder="Search classmates to tag..."
          className="flex-1 border-none bg-transparent text-sm text-[#1d2b4b] outline-none placeholder-slate-400"
          style={{ fontFamily: 'inherit' }}
        />
        {loading && <i className="fas fa-spinner animate-spin text-slate-400 text-xs" />}
      </div>
      {searchError && (
        <p className="mt-2 text-[12px] text-red-600">{searchError}</p>
      )}
      {open && !loading && !searchError && query.trim() && results.length === 0 && (
        <p className="mt-4 text-center text-[13px] text-slate-400">No classmates found</p>
      )}

      {/* Dropdown */}
      {open && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-xl z-[9000] overflow-hidden max-h-56 overflow-y-auto">
          {results.map(user => (
            <div key={user.id}
              onClick={() => { isTagged(user.id) ? onUntag(user.id) : onTag(user); setQuery(''); setOpen(false); }}
              className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors border-b border-slate-50 last:border-0
                ${isTagged(user.id) ? 'bg-indigo-50' : 'bg-white hover:bg-slate-50'}`}>
              <img src={getAvatar(user)} alt={user.name} className="w-8 h-8 rounded-full object-cover shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#1d2b4b] m-0 truncate">{user.name}</p>
                <p className="text-xs text-slate-400 m-0">{user.course ?? user.student_id ?? ''}</p>
              </div>
              {isTagged(user.id) && (
                <i className="fas fa-check-circle text-[#3f51b5] text-base shrink-0" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
