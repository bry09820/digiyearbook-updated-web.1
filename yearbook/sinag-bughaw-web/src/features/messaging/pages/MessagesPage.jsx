import { useEffect, useRef, useState, useCallback } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { messagesApi } from '@/api/messaging.api';
import Navbar from '@/components/layout/Navbar';
import { useMessaging } from '@/features/messaging/hooks/useMessaging';
import LoadingSkeleton from '@/components/ui/LoadingSkeleton';
import { imageUrl } from '@/utils/imageUrl';

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now - d) / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function formatDayLabel(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMsg = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((startOfToday - startOfMsg) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

function initials(name = '') {
  return name.trim().split(/\s+/).map((w) => w[0]?.toUpperCase() || '').slice(0, 2).join('');
}

const PALETTES = [
  ['bg-amber-100', 'text-[#1d2b4b]'],
  ['bg-indigo-100', 'text-indigo-800'],
  ['bg-emerald-100', 'text-emerald-800'],
  ['bg-sky-100', 'text-sky-800'],
  ['bg-violet-100', 'text-violet-800'],
];

const QUICK_EMOJIS = ['😀', '😂', '😍', '🥰', '😭', '🙏', '👍', '🔥', '🎉', '💙', '💛', '✨'];

function paletteFor(name = '') {
  const code = [...name].reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return PALETTES[code % PALETTES.length];
}

function Avatar({ src, name, size = 'h-11 w-11', radius = 'rounded-xl' }) {
  const [errored, setErrored] = useState(false);
  const resolved = !errored && src ? imageUrl(src) : null;
  const [bg, fg] = paletteFor(name);

  if (!resolved) {
    return (
      <div className={`${size} ${radius} ${bg} ${fg} grid shrink-0 place-items-center text-sm font-black`}>
        {initials(name)}
      </div>
    );
  }

  return (
    <img
      src={resolved}
      alt={name}
      onError={() => setErrored(true)}
      className={`${size} ${radius} shrink-0 object-cover`}
    />
  );
}

function OnlineDot({ online }) {
  return (
    <span className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white ${online ? 'bg-[#31a24c]' : 'bg-slate-300'}`} />
  );
}

const CHAT_THEMES = {
  messenger: { label: 'Messenger blue', bubble: 'bg-[#0084ff] text-white', swatch: 'bg-[#0084ff]' },
  navy: { label: 'Yearbook navy', bubble: 'bg-[#1d2b4b] text-white', swatch: 'bg-[#1d2b4b]' },
  gold: { label: 'Sinag gold', bubble: 'bg-[#fdb813] text-[#1d2b4b]', swatch: 'bg-[#fdb813]' },
};

function ChatInfoPanel({ recipient, online, thread, theme, muted, onTheme, onMute, onClose }) {
  const [optionsOpen, setOptionsOpen] = useState(false);
  const media = thread.filter((msg) => msg.image_url || msg.image_path);

  return (
    <div className="flex h-full w-[320px] flex-col bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <p className="m-0 text-sm font-black text-[#1d2b4b]">Chat info</p>
        <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full border-0 bg-slate-100 text-slate-500" aria-label="Close chat info">
          <i className="fas fa-times text-xs" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
        <div className="flex flex-col items-center text-center">
          <Avatar src={recipient?.profile_picture} name={recipient?.name} size="h-20 w-20" radius="rounded-full" />
          <p className="mb-0 mt-3 text-lg font-black text-[#1d2b4b]">{recipient?.name || 'Student'}</p>
          <p className="m-0 text-xs font-semibold text-slate-400">
            {online ? 'Active now' : (recipient?.course || 'Offline')}
          </p>
          {recipient?.id && (
            <Link to={`/students/${recipient.id}`} className="mt-3 text-xs font-bold text-[#0084ff] no-underline hover:underline">
              View profile
            </Link>
          )}
        </div>

        <div className="mt-5 flex items-start gap-3 rounded-2xl bg-slate-100 px-3 py-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white text-[#1d2b4b]">
            <i className="fas fa-lock text-xs" />
          </span>
          <div>
            <p className="m-0 text-xs font-black text-[#1d2b4b]">Private conversation</p>
            <p className="m-0 mt-1 text-[11px] leading-relaxed text-slate-500">
              Only you and {recipient?.name?.split(' ')[0] || 'this person'} can open this chat. Yearbook messages are not end-to-end encrypted.
            </p>
          </div>
        </div>

        <div className="relative mt-4">
          <button
            type="button"
            onClick={() => setOptionsOpen((open) => !open)}
            className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-3 py-3 text-left"
          >
            <span className="text-sm font-bold text-[#1d2b4b]">Customize chat</span>
            <i className={`fas fa-chevron-${optionsOpen ? 'up' : 'down'} text-xs text-slate-400`} />
          </button>
          {optionsOpen && (
            <div className="mt-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-lg">
              <p className="m-0 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">Bubble color</p>
              {Object.entries(CHAT_THEMES).map(([id, item]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => onTheme(id)}
                  className="flex w-full items-center gap-2 rounded-xl border-0 bg-white px-2 py-2 text-left text-sm font-semibold text-[#1d2b4b] hover:bg-slate-50"
                >
                  <span className={`h-4 w-4 rounded-full ${item.swatch}`} />
                  {item.label}
                  {theme === id && <i className="fas fa-check ml-auto text-xs text-[#0084ff]" />}
                </button>
              ))}
              <button
                type="button"
                onClick={onMute}
                className="flex w-full items-center gap-2 rounded-xl border-0 bg-white px-2 py-2 text-left text-sm font-semibold text-[#1d2b4b] hover:bg-slate-50"
              >
                <i className={`fas ${muted ? 'fa-bell' : 'fa-bell-slash'} text-xs text-slate-400`} />
                {muted ? 'Unmute conversation' : 'Mute conversation'}
              </button>
            </div>
          )}
        </div>

        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between">
            <p className="m-0 text-sm font-black text-[#1d2b4b]">Media & files</p>
            <span className="text-[11px] font-bold text-slate-400">{media.length}</span>
          </div>
          {media.length === 0 ? (
            <p className="m-0 rounded-2xl bg-slate-50 px-3 py-4 text-center text-xs text-slate-400">No photos shared in this chat yet.</p>
          ) : (
            <div className="grid grid-cols-3 gap-1.5">
              {media.map((msg) => (
                <a key={msg.id} href={imageUrl(msg.image_url || msg.image_path)} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg">
                  <img src={imageUrl(msg.image_url || msg.image_path)} alt="Shared in chat" className="aspect-square w-full object-cover" />
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MessagesPage() {
  const { id: recipientId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const {
    conversations, thread, loading, isTyping,
    onlineUsers, unreadTotal, sendMessage, onKeystroke,
  } = useMessaging(recipientId ? Number(recipientId) : null);

  const [body, setBody] = useState('');
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [recipient, setRecipient] = useState(null);
  const [search, setSearch] = useState('');
  const [findMode, setFindMode] = useState(false);
  const [findQuery, setFindQuery] = useState('');
  const [findResults, setFindResults] = useState([]);
  const [findLoading, setFindLoading] = useState(false);
  const [findError, setFindError] = useState('');
  const [startingId, setStartingId] = useState(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [theme, setTheme] = useState('messenger');
  const [muted, setMuted] = useState(false);
  const bottomRef = useRef();
  const threadRef = useRef(null);
  const stickToBottomRef = useRef(true);
  const fileRef = useRef();
  const findTimerRef = useRef(null);

  useEffect(() => {
    if (!recipientId) {
      queueMicrotask(() => setRecipient(null));
      return;
    }
    const fromConversation = conversations
      .map((conv) => (String(conv.sender_id) === String(user?.id) ? conv.receiver : conv.sender))
      .find((person) => String(person?.id) === String(recipientId));

    if (fromConversation) queueMicrotask(() => setRecipient(fromConversation));

    messagesApi.participant(recipientId)
      .then(({ data }) => setRecipient(data ?? fromConversation ?? null))
      .catch(() => {
        if (!fromConversation) setRecipient(null);
      });
  }, [recipientId, conversations, user?.id]);

  useEffect(() => {
    const list = threadRef.current;
    if (!list || !stickToBottomRef.current) return;
    list.scrollTop = list.scrollHeight;
  }, [thread, isTyping]);

  useEffect(() => () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
  }, [imagePreview]);

  useEffect(() => () => clearTimeout(findTimerRef.current), []);

  useEffect(() => {
    if (!recipientId) {
      setInfoOpen(false);
      return;
    }
    setTheme(localStorage.getItem(`sb-chat-theme-${recipientId}`) || 'messenger');
    setMuted(localStorage.getItem(`sb-chat-muted-${recipientId}`) === '1');
    setInfoOpen(false);
    setAttachOpen(false);
  }, [recipientId]);

  const chooseTheme = (next) => {
    setTheme(next);
    if (recipientId) localStorage.setItem(`sb-chat-theme-${recipientId}`, next);
  };

  const toggleMute = () => {
    setMuted((current) => {
      const next = !current;
      if (recipientId) localStorage.setItem(`sb-chat-muted-${recipientId}`, next ? '1' : '0');
      return next;
    });
  };

  const runFindSearch = useCallback(async (query) => {
    const q = query.trim();
    if (q.length < 1) {
      setFindResults([]);
      setFindError('');
      return;
    }

    setFindLoading(true);
    setFindError('');
    try {
      const { data } = await messagesApi.searchUsers({ q, limit: 25 });
      const rows = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []);
      setFindResults(rows.filter((row) => String(row.id) !== String(user?.id)));
    } catch {
      setFindResults([]);
      setFindError('Could not search students. Try again.');
    } finally {
      setFindLoading(false);
    }
  }, [user?.id]);

  const handleFindQueryChange = (value) => {
    setFindQuery(value);
    clearTimeout(findTimerRef.current);
    findTimerRef.current = setTimeout(() => runFindSearch(value), 280);
  };

  const openConversationWith = async (person) => {
    const userId = person?.user_id || person?.account_user_id || person?.id;
    if (!userId) return;

    setStartingId(userId);
    try {
      await messagesApi.start(userId);
    } catch {
      // Still navigate — thread endpoint resolves empty histories fine.
    } finally {
      setStartingId(null);
      setFindMode(false);
      setFindQuery('');
      setFindResults([]);
      navigate(`/messages/${userId}`);
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if ((!body.trim() && !image) || !recipientId) return;
    const text = body;
    const selectedImage = image;
    setBody('');
    setImage(null);
    setImagePreview(null);
    setShowEmoji(false);
    stickToBottomRef.current = true;
    try { await sendMessage(Number(recipientId), text.trim(), selectedImage); }
    catch {
      setBody(text);
      setImage(selectedImage);
      setImagePreview(selectedImage ? URL.createObjectURL(selectedImage) : null);
    }
  };

  const handleImageChange = (e) => {
    const selected = e.target.files?.[0] ?? null;
    if (selected) {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
      setImage(selected);
      setImagePreview(URL.createObjectURL(selected));
    }
    e.target.value = '';
  };

  const clearImage = () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImage(null);
    setImagePreview(null);
  };

  const handleKeyDown = useCallback(() => {
    if (recipientId) onKeystroke(Number(recipientId));
  }, [recipientId, onKeystroke]);

  const filtered = conversations.filter((conv) => {
    if (!search.trim()) return true;
    const other = String(conv.sender_id) === String(user?.id) ? conv.receiver : conv.sender;
    return other?.name?.toLowerCase().includes(search.toLowerCase());
  });

  let lastDayLabel = null;

  return (
    <div className="flex h-dvh max-w-[100vw] flex-col overflow-hidden bg-[#eef2f8]">
      <Navbar unreadMessageCount={unreadTotal} />

      <main className="mx-auto grid min-h-0 w-full max-w-[1440px] flex-1 grid-cols-1 overflow-hidden bg-white lg:grid-cols-[340px_minmax(0,1fr)]">
        <aside className={`${recipientId ? 'hidden lg:flex' : 'flex'} min-h-0 flex-col border-r border-[#e4e6eb] bg-white`}>
          <div className="px-4 pb-2 pt-4">
            <div className="mb-3 flex items-center justify-between">
              <h1 className="m-0 text-[22px] font-black tracking-tight text-[#050505]">
                Chats
              </h1>
              {unreadTotal > 0 && (
                <span className="rounded-full bg-[#fdb813] px-2 py-0.5 text-[11px] font-black text-[#1d2b4b]">
                  {unreadTotal}
                </span>
              )}
            </div>

            {findMode ? (
              <label className="flex h-10 items-center gap-2 rounded-xl border border-[#fdb813] bg-white px-3 text-slate-400">
                <i className="fas fa-user-plus text-xs text-[#1d2b4b]" />
                <input
                  autoFocus
                  value={findQuery}
                  onChange={(e) => handleFindQueryChange(e.target.value)}
                  placeholder="Search by name, course, or batch..."
                  className="w-full border-0 bg-transparent text-sm text-[#1d2b4b] outline-none placeholder:text-slate-400"
                />
                {findLoading && <i className="fas fa-spinner fa-spin text-xs text-slate-400" />}
              </label>
            ) : (
              <label className="flex h-9 items-center gap-2 rounded-full bg-[#f0f2f5] px-3 text-slate-500">
                <i className="fas fa-search text-xs" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search conversations..."
                  className="w-full border-0 bg-transparent text-sm text-[#1d2b4b] outline-none placeholder:text-slate-400"
                />
              </label>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {findMode ? (
              <>
                {findError && (
                  <p className="m-0 px-4 py-3 text-center text-xs font-semibold text-rose-500">{findError}</p>
                )}
                {!findLoading && findQuery.trim() && findResults.length === 0 && !findError && (
                  <div className="px-5 py-10 text-center text-sm text-slate-400">
                    No students matched “{findQuery.trim()}”.
                  </div>
                )}
                {!findQuery.trim() && (
                  <div className="px-5 py-10 text-center text-sm text-slate-400">
                    Type a name, course, or batch year to find someone to message.
                  </div>
                )}
                {findResults.map((person) => (
                  <button
                    key={person.id}
                    type="button"
                    disabled={startingId === person.id}
                    onClick={() => openConversationWith(person)}
                    className="flex w-full items-center gap-3 border-b border-slate-100 px-4 py-3 text-left transition hover:bg-amber-50 disabled:opacity-60"
                  >
                    <Avatar src={person.profile_picture} name={person.name} />
                    <div className="min-w-0 flex-1">
                      <p className="m-0 truncate text-sm font-black text-[#1d2b4b]">{person.name}</p>
                      <p className="m-0 truncate text-xs text-slate-400">
                        {[person.course, person.batch_year || person.graduation_year].filter(Boolean).join(' · ') || 'Student'}
                      </p>
                    </div>
                    <i className={`fas ${startingId === person.id ? 'fa-spinner fa-spin' : 'fa-comment-dots'} text-[#fdb813]`} />
                  </button>
                ))}
              </>
            ) : (
              <>
                {filtered.length === 0 && (
                  <div className="px-5 py-10 text-center text-sm text-slate-400">
                    {search ? 'No conversations match your search.' : (
                      <div className="space-y-3">
                        <p className="m-0">No conversations yet.</p>
                        <p className="m-0 text-xs">Find a classmate to start chatting.</p>
                      </div>
                    )}
                  </div>
                )}

                {filtered.map((conv) => {
                  const other = String(conv.sender_id) === String(user?.id) ? conv.receiver : conv.sender;
                  if (!other) return null;
                  const active = String(recipientId) === String(other.id);
                  const online = onlineUsers.has(other.id);
                  const unread = Number(conv.unread_count ?? 0) > 0;
                  return (
                    <Link
                      key={conv.id}
                      to={`/messages/${other.id}`}
                      className={`mx-2 flex items-center gap-3 rounded-xl px-2 py-2.5 no-underline transition ${active ? 'bg-[#e7f3ff]' : 'hover:bg-[#f0f2f5]'}`}
                    >
                      <div className="relative">
                        <Avatar src={other.profile_picture} name={other.name} radius="rounded-full" />
                        <OnlineDot online={online} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`m-0 truncate text-[15px] text-[#050505] ${unread ? 'font-black' : 'font-semibold'}`}>{other.name}</p>
                        <p className={`m-0 truncate text-[13px] ${unread ? 'font-bold text-[#050505]' : 'text-[#65676b]'}`}>{conv.body || (conv.image_url ? 'Sent a photo' : '')}</p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className="text-[11px] text-slate-400">{formatTime(conv.created_at)}</span>
                        {unread && <span className="h-2.5 w-2.5 rounded-full bg-blue-500" aria-label={`${conv.unread_count} unread`} />}
                      </div>
                    </Link>
                  );
                })}
              </>
            )}
          </div>

          <div className="border-t border-slate-100 p-3">
            <button
              type="button"
              onClick={() => {
                setFindMode((v) => !v);
                setFindQuery('');
                setFindResults([]);
                setFindError('');
                setSearch('');
              }}
              className={`flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-black transition ${findMode ? 'bg-slate-100 text-[#1d2b4b] hover:bg-slate-200' : 'bg-[#1d2b4b] text-white hover:bg-[#263654]'}`}
            >
              <i className={`fas ${findMode ? 'fa-times' : 'fa-search'} text-xs`} />
              {findMode ? 'Close Find Students' : 'Find Students'}
            </button>
          </div>
        </aside>

        <section className={`${recipientId ? 'flex' : 'hidden lg:flex'} relative min-h-0 bg-white`}>
          {recipientId ? (
            <>
              <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              <div className="flex items-center gap-3 border-b border-[#e4e6eb] bg-white px-3 py-2.5">
                <button
                  type="button"
                  onClick={() => navigate('/messages')}
                  className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 lg:hidden"
                >
                  <i className="fas fa-arrow-left" />
                </button>

                {recipient ? (
                  <>
                    <div className="relative">
                      <Avatar src={recipient.profile_picture} name={recipient.name} size="h-10 w-10" radius="rounded-full" />
                      <OnlineDot online={onlineUsers.has(recipient.id)} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="m-0 truncate text-[15px] font-bold text-[#050505]">{recipient.name}</p>
                      <p className={`m-0 text-xs font-semibold ${onlineUsers.has(recipient.id) ? 'text-[#31a24c]' : 'text-[#65676b]'}`}>
                        {muted ? 'Muted · ' : ''}{isTyping ? 'Typing…' : (onlineUsers.has(recipient.id) ? 'Active now' : 'Offline')}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setInfoOpen((open) => !open)}
                      aria-pressed={infoOpen}
                      aria-label="Chat info"
                      className={`grid h-9 w-9 place-items-center rounded-full border-0 ${infoOpen ? 'bg-[#e7f3ff] text-[#0084ff]' : 'bg-transparent text-[#0084ff] hover:bg-[#f0f2f5]'}`}
                    >
                      <i className="fas fa-info-circle" />
                    </button>
                  </>
                ) : (
                  <div className="min-w-0 flex-1">
                    <p className="m-0 text-sm font-black text-[#1d2b4b]">Loading conversation…</p>
                  </div>
                )}
              </div>

              <div
                ref={threadRef}
                onScroll={() => {
                  const list = threadRef.current;
                  if (!list) return;
                  stickToBottomRef.current = list.scrollHeight - list.scrollTop - list.clientHeight < 64;
                }}
                className="min-h-0 flex-1 overflow-y-auto bg-white px-3 py-4"
              >
                {loading && thread.length === 0 && <LoadingSkeleton variant="row" count={5} gridClassName="space-y-3" />}

                {!loading && thread.length === 0 && (
                  <div className="flex h-full flex-col items-center justify-center px-4 text-center">
                    <div className="mb-3 grid h-14 w-14 place-items-center rounded-full bg-white text-2xl text-slate-300 shadow-sm">
                      <i className="fas fa-comments" />
                    </div>
                    <p className="m-0 text-sm font-black text-[#1d2b4b]">Say hello</p>
                    <p className="m-0 mt-1 text-xs text-slate-400">
                      No messages yet with {recipient?.name || 'this student'}. Send the first one below.
                    </p>
                  </div>
                )}

                <div className="flex flex-col gap-3">
                  {thread.map((msg) => {
                    const mine = String(msg.sender_id) === String(user?.id);
                    const msgImage = msg.image_url || msg.image_path;
                    const dayLabel = formatDayLabel(msg.created_at);
                    const showDay = dayLabel && dayLabel !== lastDayLabel;
                    if (showDay) lastDayLabel = dayLabel;

                    return (
                      <div key={msg.id}>
                        {showDay && (
                          <div className="mb-3 mt-1 flex items-center gap-3 text-center text-[11px] font-bold text-slate-400">
                            <span className="h-px flex-1 bg-slate-200" />
                            {dayLabel}
                            <span className="h-px flex-1 bg-slate-200" />
                          </div>
                        )}
                        <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[min(75%,480px)] px-3 py-2 text-[15px] leading-snug ${mine ? `rounded-[18px] rounded-br-[4px] ${CHAT_THEMES[theme]?.bubble || CHAT_THEMES.messenger.bubble}` : 'rounded-[18px] rounded-bl-[4px] bg-[#f0f2f5] text-[#050505]'}`}>
                            {msgImage && (
                              <img
                                src={imageUrl(msgImage)}
                                alt="Message attachment"
                                className="mb-2 max-h-72 w-full rounded-xl object-cover"
                              />
                            )}
                            {msg.body && <p className="m-0 whitespace-pre-wrap">{msg.body}</p>}
                            <div className={`mt-1 text-[10px] ${mine ? 'text-white/70' : 'text-[#65676b]'}`}>
                              {formatTime(msg.created_at)}
                              {mine && msg.is_read && <span className="ml-1 text-[#fdb813]">Seen</span>}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {isTyping && (
                    <div className="flex justify-start">
                      <div className="flex gap-1 rounded-[18px] rounded-bl-[4px] bg-[#f0f2f5] px-4 py-3">
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-300" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-300 [animation-delay:150ms]" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-300 [animation-delay:300ms]" />
                      </div>
                    </div>
                  )}
                  <div ref={bottomRef} />
                </div>
              </div>

              <form onSubmit={handleSend} className="relative border-t border-[#e4e6eb] bg-white px-3 py-2.5">
                {showEmoji && (
                  <div className="absolute bottom-[76px] left-3 z-10 grid grid-cols-6 gap-1 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                    {QUICK_EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => setBody((current) => `${current}${emoji}`)}
                        className="grid h-9 w-9 place-items-center rounded-lg border-0 bg-white text-lg transition hover:bg-slate-100"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
                {image && (
                  <div className="mb-2 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-2">
                    <img src={imagePreview} alt="Selected attachment" className="h-14 w-14 rounded-lg object-cover" />
                    <div className="min-w-0 flex-1">
                      <p className="m-0 truncate text-xs font-black text-[#1d2b4b]">{image.name}</p>
                      <p className="m-0 text-[11px] text-slate-400">Ready to send</p>
                    </div>
                    <button type="button" onClick={clearImage} className="grid h-8 w-8 place-items-center rounded-lg border-0 bg-white text-slate-500">
                      <i className="fas fa-times" />
                    </button>
                  </div>
                )}
                <div className="flex items-end gap-2">
                  <input ref={fileRef} type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setAttachOpen((open) => !open)}
                      className="grid h-9 w-9 place-items-center rounded-full border-0 bg-transparent text-[#0084ff] hover:bg-[#f0f2f5]"
                      aria-label="Attachment options"
                    >
                      <i className="fas fa-plus-circle text-lg" />
                    </button>
                    {attachOpen && (
                      <div className="absolute bottom-11 left-0 z-10 w-44 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl">
                        <button
                          type="button"
                          onClick={() => { setAttachOpen(false); fileRef.current?.click(); }}
                          className="flex w-full items-center gap-2 rounded-xl border-0 bg-white px-2 py-2 text-left text-sm font-semibold text-[#050505] hover:bg-[#f0f2f5]"
                        >
                          <i className="far fa-image text-[#0084ff]" /> Photo
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="flex min-h-9 flex-1 items-center gap-1 rounded-full bg-[#f0f2f5] px-2">
                    <button
                      type="button"
                      onClick={() => setShowEmoji((value) => !value)}
                      className="grid h-8 w-8 place-items-center rounded-full border-0 bg-transparent text-[#0084ff]"
                      aria-label="Add emoji"
                    >
                      <i className="far fa-smile" />
                    </button>
                    <input
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Aa"
                      className="w-full border-0 bg-transparent py-2 text-sm text-[#050505] outline-none placeholder:text-slate-400"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={!body.trim() && !image}
                    className="grid h-9 w-9 place-items-center rounded-full border-0 bg-transparent text-[#0084ff] disabled:text-slate-300"
                    aria-label="Send"
                  >
                    <i className="fas fa-paper-plane" />
                  </button>
                </div>
              </form>
              </div>
              <aside
                className={`min-w-0 shrink-0 overflow-hidden border-[#e4e6eb] bg-white transition-[width] duration-300 ease-out ${infoOpen ? 'w-[320px] border-l' : 'w-0'} max-lg:absolute max-lg:inset-y-0 max-lg:right-0 max-lg:z-30 max-lg:shadow-2xl ${infoOpen ? 'max-lg:w-[min(100%,320px)]' : 'max-lg:w-0'}`}
              >
                {recipient && (
                  <ChatInfoPanel
                    recipient={recipient}
                    online={onlineUsers.has(recipient.id)}
                    thread={thread}
                    theme={theme}
                    muted={muted}
                    onTheme={chooseTheme}
                    onMute={toggleMute}
                    onClose={() => setInfoOpen(false)}
                  />
                )}
              </aside>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
              <div className="mb-4 grid h-16 w-16 place-items-center rounded-full bg-slate-200 text-3xl text-slate-400">
                <i className="fas fa-comment-dots" />
              </div>
              <p className="m-0 text-base font-black text-[#1d2b4b]">No conversation selected</p>
              <p className="m-0 mt-2 text-sm text-slate-400">Pick one from the list or find someone to chat with.</p>
              <button
                type="button"
                onClick={() => setFindMode(true)}
                className="mt-6 flex h-11 items-center gap-2 rounded-xl bg-[#1d2b4b] px-6 text-sm font-black text-white transition hover:bg-[#263654]"
              >
                <i className="fas fa-search text-xs" />
                Find Students
              </button>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
