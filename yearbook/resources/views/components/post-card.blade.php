{{--
    Feed post card. Reactions and comments follow the admin toggles passed in
    as $allowReactions and $allowComments. Counts update from data-count attributes.
--}}
@php
    $allowReactions = filter_var($allowReactions ?? \App\Support\PlatformSettings::bool('allow_reactions'), FILTER_VALIDATE_BOOLEAN);
    $allowComments = filter_var($allowComments ?? \App\Support\PlatformSettings::bool('allow_comments'), FILTER_VALIDATE_BOOLEAN);
    $reactions = $post['reactions'] ?? ['like' => 0, 'heart' => 0, 'haha' => 0, 'total' => 0, 'mine' => null];
    $comments = $post['comments'] ?? [];
    $poster = $post['user']['name'] ?? 'Student';
@endphp

<article class="feed-post-card" data-post-id="{{ $post['id'] ?? '' }}" style="background:#fff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;margin-bottom:16px;">
    <header style="display:flex;gap:10px;align-items:center;padding:12px 16px;">
        <strong style="color:#1d2b4b;font-size:14px;">{{ $poster }}</strong>
        <span style="margin-left:auto;color:#94a3b8;font-size:12px;">{{ $post['time_ago'] ?? '' }}</span>
    </header>

    @if (!empty($post['caption']))
        <p style="margin:0;padding:0 16px 12px;color:#334155;font-size:14px;">{{ $post['caption'] }}</p>
    @endif

    @if ($allowReactions)
        <div class="post-reactions" data-post-reactions="{{ $post['id'] ?? '' }}" style="display:flex;flex-wrap:wrap;gap:8px;padding:8px 16px 12px;">
            @foreach (['like' => '👍 Like', 'heart' => '❤️ Heart', 'haha' => '😂 Haha'] as $type => $label)
                <button
                    type="button"
                    class="post-reaction-btn"
                    data-type="{{ $type }}"
                    data-post-id="{{ $post['id'] ?? '' }}"
                    aria-pressed="{{ ($reactions['mine'] ?? null) === $type ? 'true' : 'false' }}"
                    style="display:inline-flex;align-items:center;gap:6px;border:1px solid {{ ($reactions['mine'] ?? null) === $type ? '#fcd34d' : '#e2e8f0' }};background:{{ ($reactions['mine'] ?? null) === $type ? '#fffbeb' : '#fff' }};border-radius:999px;padding:6px 12px;font-weight:700;font-size:12px;color:#1d2b4b;cursor:pointer;"
                >
                    {{ $label }}
                    <span class="post-reaction-count" data-count="{{ $type }}" style="min-width:1.25rem;border-radius:999px;background:#f1f5f9;padding:0 6px;text-align:center;color:#64748b;">{{ (int) ($reactions[$type] ?? 0) }}</span>
                </button>
            @endforeach
        </div>
    @endif

    @if ($allowComments)
        <section class="post-comments" data-post-comments="{{ $post['id'] ?? '' }}" style="padding:0 16px 16px;">
            <p style="margin:0 0 8px;font-size:12px;color:#64748b;">
                <span class="post-comment-count">{{ (int) ($post['comments_count'] ?? count($comments)) }}</span> comments
            </p>
            <div class="post-comment-list" style="display:flex;flex-direction:column;gap:8px;max-height:220px;overflow:auto;">
                @forelse ($comments as $comment)
                    <div style="background:#f1f5f9;border-radius:14px;padding:8px 12px;">
                        <strong style="display:block;font-size:12px;color:#1d2b4b;">{{ $comment['user']['name'] ?? 'Student' }}</strong>
                        <span style="font-size:13px;color:#334155;">{{ $comment['body'] ?? '' }}</span>
                    </div>
                @empty
                    <p class="post-comment-empty" style="margin:0;font-size:12px;color:#94a3b8;">No comments yet. Be the first to write one.</p>
                @endforelse
            </div>
            <form class="post-comment-form" data-post-id="{{ $post['id'] ?? '' }}" style="display:flex;gap:8px;margin-top:10px;">
                <input
                    type="text"
                    name="body"
                    maxlength="1000"
                    placeholder="Write a comment…"
                    required
                    style="flex:1;border:1px solid #e2e8f0;border-radius:999px;padding:8px 12px;font-size:13px;"
                >
                <button type="submit" style="border:0;border-radius:999px;background:#1d2b4b;color:#fdb813;font-weight:800;padding:8px 14px;cursor:pointer;">Post</button>
            </form>
        </section>
    @endif
</article>
