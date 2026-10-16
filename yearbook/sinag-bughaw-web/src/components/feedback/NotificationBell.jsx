import { useEffect, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { notificationsApi } from '@/api/yearbook.api';
import { imageUrl } from '@/utils/imageUrl';
import LoadingSkeleton from '@/components/ui/LoadingSkeleton';

function timeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function getInitials(name = '') {
  return name.trim().split(/\s+/).map((w) => w[0]?.toUpperCase() || '').slice(0, 2).join('');
}

function typeStyle(type) {
  switch (type) {
    case 'message':
    case 'chat':
    case 'new_message':
      return { icon: 'fa-comment-dots', bubble: 'bg-indigo-50 text-[#3f51b5]' };
    case 'like': return { icon: 'fa-heart', bubble: 'bg-red-50 text-red-500' };
    case 'tag':
    case 'photo_tagged':
      return { icon: 'fa-tag', bubble: 'bg-emerald-50 text-emerald-500' };
    case 'media_approved':
      return { icon: 'fa-circle-check', bubble: 'bg-emerald-50 text-emerald-500' };
    case 'announcement': return { icon: 'fa-bell', bubble: 'bg-amber-50 text-amber-600' };
    case 'profile_update': return { icon: 'fa-user-check', bubble: 'bg-emerald-50 text-emerald-500' };
    default: return { icon: 'fa-bell', bubble: 'bg-slate-100 text-slate-500' };
  }
}

function notificationTarget(notification) {
  const data = notification.data ?? {};
  const type = String(data.type ?? notification.type ?? '').toLowerCase();
  const actionUrl = data.action_url ?? data.url ?? notification.action_url ?? notification.url;
  const photoId = data.photo_id ?? data.post_id ?? notification.photo_id ?? notification.post_id;
  const photoOwnerId = data.photo_owner_id ?? data.owner_id ?? data.uploader_id ?? data.tagger_id;
  const receiverId = data.receiver_id ?? notification.receiver_id;

  if (actionUrl) {
    try {
      const parsed = new URL(actionUrl, window.location.origin);
      if (type === 'photo_tagged' || type === 'tag') {
        const studentMatch = parsed.pathname.match(/^\/students\/([^/]+)/);
        if (studentMatch) return `/profile/${studentMatch[1]}${parsed.search}${parsed.hash}`;
      }
      if (parsed.pathname.includes('voice-notes') || parsed.search.includes('voicenotes')) return '/profile';
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    } catch {
      return actionUrl;
    }
  }

  if (type.includes('announcement')) return '/announcements';
  if (type === 'photo_tagged' || type === 'tag') {
    if (photoOwnerId && photoId) return `/profile/${photoOwnerId}?post=${photoId}`;
    if (receiverId) return `/profile/${receiverId}?tab=tagged`;
    return '/profile?tab=tagged';
  }
  if (type === 'profile_update') return '/profile';
  const messageUserId =
    data.conversation_user_id ??
    data.sender_id ??
    notification.sender_id ??
    data.receiver_id ??
    notification.receiver_id ??
    data.message_id ??
    notification.message_id;
  return messageUserId ? `/messages/${messageUserId}` : '/messages';
}

function messageSenderFromTitle(title) {
  if (!title) return null;
  const value = String(title).trim();
  const match = value.match(/(?:new message from|message from|from)\s+(.+)$/i);
  return (match?.[1] || value).trim() || null;
}

const notificationData = (item) => item?.data ?? {};
const notificationType = (item) => String(notificationData(item)?.type || item?.type || '').toLowerCase();
const notificationBody = (item) => item?.body || item?.message || notificationData(item)?.body || notificationData(item)?.message || '';
const notificationTitle = (item) => item?.title || notificationData(item)?.title || item?.type || 'Notification';
const notificationDate = (item) => item?.created_at || item?.time || item?.date;
const notificationAvatar = (item) => {
  const data = notificationData(item);
  return imageUrl(
    data.sender_avatar ??
    data.sender?.profile_picture ??
    data.sender?.avatar ??
    data.sender?.photo ??
    data.tagger_avatar ??
    data.tagger?.profile_picture ??
    data.actor_avatar ??
    data.actor?.profile_picture ??
    data.user?.profile_picture ??
    data.profile_picture ??
    data.avatar ??
    item?.sender_avatar ??
    item?.sender?.profile_picture ??
    item?.profile_picture ??
    null
  );
};
const dedupeSubscriptionNotifications = (items = []) => {
  const dayMs = 24 * 60 * 60 * 1000;
  const grouped = new Map();
  items
    .slice()
    .sort((a, b) => new Date(notificationDate(b) || 0).getTime() - new Date(notificationDate(a) || 0).getTime())
    .forEach((item, index) => {
      const type = notificationType(item);
      const body = notificationBody(item).trim().toLowerCase();
      const created = new Date(notificationDate(item) || 0).getTime();
      const isSubscription = type.includes('subscription') || notificationTitle(item).toLowerCase().includes('subscription activated');
      if (!isSubscription || !body || !created) {
        grouped.set(String(item?.id || `${type}-${created}-${index}`), item);
        return;
      }
      const key = `${type}:${body}`;
      const existing = grouped.get(key);
      const existingDate = existing ? new Date(notificationDate(existing) || 0).getTime() : 0;
      if (existing && Math.abs(existingDate - created) <= dayMs) {
        grouped.set(key, { ...existing, _duplicateCount: Number(existing._duplicateCount || 1) + 1 });
        return;
      }
      grouped.set(key, { ...item, _duplicateCount: 1 });
    });
  return Array.from(grouped.values());
};

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);
  const pollRef = useRef(null);

  const fetchNotifications = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const { data } = await notificationsApi.list();
      const list = dedupeSubscriptionNotifications(data.data ?? data ?? []);
      setNotifications(list);
      setUnread(list.filter((n) => n.is_read !== true && !n.read_at).length);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialTimer = window.setTimeout(() => fetchNotifications(), 0);
    pollRef.current = setInterval(() => fetchNotifications(true), 8000);
    return () => {
      window.clearTimeout(initialTimer);
      clearInterval(pollRef.current);
    };
  }, [fetchNotifications]);

  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    const handler = () => fetchNotifications(true);
    window.addEventListener('notifications:refresh', handler);
    return () => window.removeEventListener('notifications:refresh', handler);
  }, [fetchNotifications]);

  const handleOpen = async () => {
    setOpen((value) => !value);
    if (!open && unread > 0) {
      setUnread(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
      try {
        const unreadIds = notifications.filter((n) => !n.read_at).map((n) => n.id);
        await Promise.all(unreadIds.map((id) => notificationsApi.markRead(id)));
      } catch {
        fetchNotifications(true);
      }
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={handleOpen}
        className={`relative flex h-[38px] w-[38px] items-center justify-center rounded-full border-0 transition ${open ? 'bg-[#1d2b4b] text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
        title="Notifications"
      >
        <i className="fas fa-bell text-sm" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex min-w-[18px] items-center justify-center rounded-full border-2 border-white bg-red-500 px-1 text-[0.6rem] font-black leading-[14px] text-white animate-[fadeIn_0.2s_ease]">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+12px)] z-[9999] w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-3xl border border-black/5 bg-white shadow-2xl shadow-black/10 animate-[fadeIn_0.18s_ease]">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <h4 className="m-0 text-sm font-black text-[#1d2b4b]">Notifications</h4>
              <p className="m-0 text-xs text-slate-400">{unread === 0 ? 'All caught up!' : `${unread} unread`}</p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                to="/announcements"
                onClick={() => setOpen(false)}
                className="rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-black text-amber-600 no-underline transition hover:bg-amber-100"
              >
                Announcements
              </Link>
              <Link
                to="/messages"
                onClick={() => setOpen(false)}
                className="rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-black text-[#3f51b5] no-underline transition hover:bg-indigo-100"
              >
                Messages
              </Link>
            </div>
          </div>

          <div className="max-h-[380px] overflow-y-auto">
            {loading ? (
              <div className="p-3">
                <LoadingSkeleton variant="row" count={3} gridClassName="space-y-3" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
                  <i className="fas fa-bell-slash text-2xl text-slate-300" />
                </div>
                <p className="m-0 text-sm font-semibold text-slate-400">No notifications yet</p>
                <p className="m-0 text-xs text-slate-300">You'll see messages and updates here</p>
              </div>
            ) : (
              notifications.map((n) => {
                const data = n.data ?? {};
                const type = data.type ?? n.type ?? 'default';
                const st = typeStyle(type);
                const isUnread = n.is_read !== true && !n.read_at;
                const titleSender = ['message', 'chat', 'new_message'].includes(type)
                  ? messageSenderFromTitle(n.title)
                  : null;
                const sender = type === 'announcement'
                  ? (n.title || data.title || 'Announcement')
                  : (
                    data.sender_name ??
                    data.tagger_name ??
                    data.actor_name ??
                    n.sender_name ??
                    titleSender ??
                    'Someone'
                  );
                const preview = type === 'announcement'
                  ? (n.body || data.body || 'New announcement')
                  : (data.message ?? n.body ?? n.message ?? n.title ?? 'Sent you a notification');
                const avatar = notificationAvatar(n);
                const target = notificationTarget(n);
                const itemClasses = `flex items-start gap-3 border-b border-slate-50 px-5 py-3.5 text-inherit no-underline transition hover:bg-slate-50 ${isUnread ? 'bg-[#fafbff]' : 'bg-white'}`;
                const content = (
                  <>
                    <div className="relative shrink-0">
                      {avatar ? (
                        <img src={avatar} alt={sender} className="h-10 w-10 rounded-xl object-cover" />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1d2b4b] text-xs font-black text-[#fdb813]">
                          {getInitials(sender)}
                        </div>
                      )}
                      <div className={`absolute -bottom-1 -right-1 flex h-[18px] w-[18px] items-center justify-center rounded-full border-2 border-white ${st.bubble}`}>
                        <i className={`fas ${st.icon} text-[0.45rem]`} />
                      </div>
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="m-0 truncate text-sm font-black text-[#1d2b4b]">{sender}</p>
                      <p className="m-0 truncate text-xs text-slate-500">{preview}</p>
                      <p className="m-0 mt-1 text-xs text-slate-400">
                        <i className="fas fa-clock mr-1 text-[0.6rem]" />
                        {timeAgo(n.created_at)}
                        {n._duplicateCount > 1 ? ` · ${n._duplicateCount}` : ''}
                      </p>
                    </div>

                    {isUnread && <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#3f51b5]" />}
                  </>
                );

                if (!target) {
                  return (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => setOpen(false)}
                      className={`${itemClasses} w-full border-x-0 border-t-0 text-left`}
                    >
                      {content}
                    </button>
                  );
                }

                return (
                  <Link
                    key={n.id}
                    to={target}
                    onClick={() => setOpen(false)}
                    className={itemClasses}
                  >
                    {content}
                  </Link>
                );
              })
            )}
          </div>

          {notifications.length > 0 && (
            <div className="border-t border-slate-100 px-5 py-3 text-center">
              <button
                type="button"
                onClick={() => { setNotifications([]); setUnread(0); setOpen(false); }}
                className="border-0 bg-transparent text-xs font-semibold text-slate-400 transition hover:text-red-500"
              >
                <i className="fas fa-trash-alt mr-1" /> Clear all
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
