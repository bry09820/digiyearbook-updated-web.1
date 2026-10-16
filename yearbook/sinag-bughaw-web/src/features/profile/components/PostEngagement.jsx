import { useEffect, useRef, useState } from 'react';
import { storageUrl } from '@/api/client';
import axios from '@/api/client';
import { useAppConfig } from '@/features/platform/AppConfigProvider';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { refreshEchoAuthHeaders } from '@/lib/echo';

const REACTIONS = [
  { type: 'like', label: 'Like', emoji: '👍' },
  { type: 'heart', label: 'Heart', emoji: '❤️' },
  { type: 'haha', label: 'Haha', emoji: '😂' },
];

const emptyReactions = { like: 0, heart: 0, haha: 0, total: 0, mine: null };
const COMMENT_PREVIEW = 3;

function avatarFor(person) {
  const name = person?.name || 'Student';
  return storageUrl(person?.profile_picture)
    || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=1d2b4b&color=fdb813&size=64`;
}

export default function PostEngagement({ post, currentUser, onChange, compact = false, startOpen = true }) {
  const { user: authUser } = useAuth();
  const viewer = currentUser ?? authUser;
  const { isOn, loading: configLoading, config } = useAppConfig();
  const allowReactions = !configLoading && isOn('allow_reactions');
  const [commentsBlocked, setCommentsBlocked] = useState(false);
  const allowComments = !configLoading && isOn('allow_comments') && !commentsBlocked;

  useEffect(() => {
    setCommentsBlocked(false);
  }, [config.features?.allow_comments, config.allow_comments]);
  const [reactions, setReactions] = useState(post?.reactions ?? emptyReactions);
  const [commentsCount, setCommentsCount] = useState(Number(post?.comments_count ?? 0));
  const [comments, setComments] = useState([]);
  const [showAllComments, setShowAllComments] = useState(startOpen && !compact);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [reacting, setReacting] = useState(false);
  const [error, setError] = useState('');
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    setReactions(post?.reactions ?? emptyReactions);
    setCommentsCount(Number(post?.comments_count ?? 0));
  }, [post?.id, post?.reactions, post?.comments_count]);

  useEffect(() => {
    if (!allowComments || !post?.id) return undefined;
    let stopped = false;

    const load = async () => {
      try {
        const { data } = await axios.get(`/feed/${post.id}/comments`);
        if (stopped) return;
        if (data?.allow_comments === false) {
          setCommentsBlocked(true);
          setComments([]);
          setCommentsCount(0);
          return;
        }
        setCommentsBlocked(false);
        setComments(data.data ?? []);
        if (Number.isFinite(Number(data.comments_count))) {
          setCommentsCount(Number(data.comments_count));
          onChangeRef.current?.(post.id, { comments_count: Number(data.comments_count), reactions: data.reactions });
        }
      } catch {
        // Keep the comments already on screen if a refresh fails.
      }
    };

    load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') load();
    }, 15000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [allowComments, post?.id]);

  useEffect(() => {
    if (!post?.id || !window.Echo) return undefined;
    let channel;
    try {
      refreshEchoAuthHeaders();
      channel = window.Echo.private(`post.${post.id}`);
      channel.listen('.engagement.updated', (payload) => {
        if (payload?.reactions) {
          setReactions((current) => ({
            ...payload.reactions,
            mine: current?.mine ?? null,
          }));
        }
        if (Number.isFinite(Number(payload?.comments_count))) setCommentsCount(Number(payload.comments_count));
        if (payload?.comment) {
          setComments((current) => current.some((item) => item.id === payload.comment.id)
            ? current
            : [...current, payload.comment]);
        }
        if (payload?.removed_comment_id) {
          setComments((current) => current.filter((item) => item.id !== payload.removed_comment_id));
        }
        onChangeRef.current?.(post.id, {
          reactions: payload?.reactions,
          comments_count: payload?.comments_count,
        });
      });
    } catch {
      channel = null;
    }
    return () => {
      try {
        window.Echo?.leave(`post.${post.id}`);
      } catch {
        // Echo may not be connected in local development.
      }
    };
  }, [post?.id]);

  if (!allowReactions && !allowComments) return null;

  const applySummary = (data) => {
    if (data?.reactions) setReactions(data.reactions);
    if (Number.isFinite(Number(data?.comments_count))) setCommentsCount(Number(data.comments_count));
    onChangeRef.current?.(post.id, {
      reactions: data?.reactions ?? reactions,
      comments_count: Number.isFinite(Number(data?.comments_count)) ? Number(data.comments_count) : commentsCount,
    });
  };

  const chooseReaction = async (type) => {
    if (!allowReactions || reacting) return;
    setReacting(true);
    setError('');
    try {
      const { data } = await axios.post(`/feed/${post.id}/reactions`, { type });
      applySummary(data);
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not save that reaction.');
    } finally {
      setReacting(false);
    }
  };

  const submitComment = async (event) => {
    event.preventDefault();
    const text = body.trim();
    if (!allowComments || !text || sending) return;
    setSending(true);
    setError('');
    try {
      const { data } = await axios.post(`/feed/${post.id}/comments`, { body: text });
      if (data?.data) {
        setComments((current) => current.some((item) => item.id === data.data.id)
          ? current
          : [...current, data.data]);
      }
      setBody('');
      applySummary(data);
    } catch (err) {
      if (err?.response?.status === 403 || err?.response?.data?.code === 'FEATURE_DISABLED') {
        setCommentsBlocked(true);
        setComments([]);
      }
      setError(err?.response?.data?.message || 'Could not post that comment.');
    } finally {
      setSending(false);
    }
  };

  const removeComment = async (commentId) => {
    try {
      const { data } = await axios.delete(`/feed/${post.id}/comments/${commentId}`);
      setComments((current) => current.filter((item) => item.id !== commentId));
      applySummary(data);
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not delete that comment.');
    }
  };

  const shown = REACTIONS.filter((item) => Number(reactions?.[item.type] ?? 0) > 0);

  return (
    <div className={compact ? 'px-4 pb-3' : ''}>
      {allowReactions && Number(reactions?.total ?? 0) > 0 ? (
        <div className="mb-2 flex items-center text-[12px] text-slate-500">
          <span className="inline-flex items-center gap-1">
            {shown.map((item) => (
              <span key={item.type} title={`${reactions[item.type]} ${item.label}`}>
                {item.emoji}
              </span>
            ))}
            <span>{Number(reactions?.total ?? 0).toLocaleString()}</span>
          </span>
        </div>
      ) : null}

      {allowReactions && (
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2" data-post-reactions={post?.id}>
          {REACTIONS.map((item) => {
            const selected = reactions?.mine === item.type;
            const count = Number(reactions?.[item.type] ?? 0);
            return (
              <button
                key={item.type}
                type="button"
                disabled={reacting}
                aria-pressed={selected}
                onClick={() => chooseReaction(item.type)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold cursor-pointer ${
                  selected
                    ? 'border-amber-300 bg-amber-50 text-[#1d2b4b]'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span aria-hidden="true">{item.emoji}</span>
                {item.label}
                <span className="min-w-[1.25rem] rounded-full bg-slate-100 px-1.5 text-center text-[11px] text-slate-500">
                  {count.toLocaleString()}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {allowComments && (
        <div className="mt-3">
          {commentsCount > COMMENT_PREVIEW && !showAllComments && (
            <button
              type="button"
              onClick={() => setShowAllComments(true)}
              className="mb-2 border-0 bg-transparent p-0 text-[13px] font-semibold text-slate-500 cursor-pointer hover:underline"
            >
              View all comments ({commentsCount.toLocaleString()})
            </button>
          )}
          <div className={`flex flex-col gap-3 overflow-y-auto ${showAllComments ? (compact ? 'max-h-56' : 'max-h-72') : ''}`}>
            {comments.length === 0 ? (
              <p className="m-0 text-[12px] text-slate-400">No comments yet. Be the first to write one.</p>
            ) : (showAllComments ? comments : comments.slice(-COMMENT_PREVIEW)).map((comment) => (
              <div key={comment.id} className="flex gap-2">
                <img
                  src={avatarFor(comment.user)}
                  alt=""
                  className="mt-0.5 h-7 w-7 shrink-0 rounded-full object-cover"
                />
                <div className="min-w-0 flex-1">
                  <div className="rounded-2xl bg-slate-100 px-3 py-2">
                    <p className="m-0 text-[12px] font-bold text-[#1d2b4b]">{comment.user?.name ?? 'Student'}</p>
                    <p className="m-0 whitespace-pre-wrap text-[13px] text-slate-700">{comment.body}</p>
                  </div>
                  <div className="mt-1 flex items-center gap-2 px-1 text-[11px] text-slate-400">
                    <span>{comment.time_ago}</span>
                    {String(comment.user?.id) === String(viewer?.id) && (
                      <button
                        type="button"
                        onClick={() => removeComment(comment.id)}
                        className="border-0 bg-transparent p-0 text-[11px] text-slate-400 cursor-pointer hover:text-red-500"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <form onSubmit={submitComment} className="mt-3 flex items-center gap-2">
            <img src={avatarFor(viewer)} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
            <input
              value={body}
              onChange={(event) => setBody(event.target.value)}
              maxLength={1000}
              placeholder="Write a comment…"
              className="min-w-0 flex-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] text-slate-800 outline-none focus:border-[#3f51b5]"
            />
            <button
              type="submit"
              disabled={sending || !body.trim()}
              className="rounded-full border-0 bg-[#1d2b4b] px-3 py-2 text-[12px] font-bold text-[#fdb813] cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
            >
              {sending ? '…' : 'Post'}
            </button>
          </form>
        </div>
      )}

      {error && <p className="mb-0 mt-2 text-[12px] text-red-500">{error}</p>}
    </div>
  );
}
