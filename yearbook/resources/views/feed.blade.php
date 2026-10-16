@php
    $allowReactions = \App\Support\PlatformSettings::bool('allow_reactions');
    $allowComments = \App\Support\PlatformSettings::bool('allow_comments');
@endphp
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Feed | Sinag-Bughaw</title>
</head>
<body style="margin:0;background:#f4f7fe;font-family:system-ui,sans-serif;">
    <main id="feed" style="max-width:680px;margin:24px auto;padding:0 16px;">
        @forelse ($posts ?? [] as $post)
            @include('posts._card', [
                'post' => $post,
                'allowReactions' => $allowReactions,
                'allowComments' => $allowComments,
            ])
        @empty
            <p style="text-align:center;color:#64748b;">No posts yet.</p>
        @endforelse
    </main>
    <script>
        (function () {
            const token = localStorage.getItem('sb_token') || localStorage.getItem('token') || localStorage.getItem('auth_token') || '';
            const headers = { Accept: 'application/json', 'Content-Type': 'application/json' };
            if (token) headers.Authorization = 'Bearer ' + token;

            document.querySelectorAll('.post-reaction-btn').forEach((button) => {
                button.addEventListener('click', async () => {
                    const postId = button.dataset.postId;
                    const type = button.dataset.type;
                    const response = await fetch('/api/feed/' + postId + '/reactions', {
                        method: 'POST',
                        headers,
                        body: JSON.stringify({ type }),
                    });
                    if (!response.ok) return;
                    const data = await response.json();
                    const card = button.closest('[data-post-id]');
                    ['like', 'heart', 'haha'].forEach((name) => {
                        const count = card.querySelector('[data-count="' + name + '"]');
                        if (count) count.textContent = data.reactions?.[name] ?? 0;
                        const control = card.querySelector('.post-reaction-btn[data-type="' + name + '"]');
                        if (!control) return;
                        const selected = data.reactions?.mine === name;
                        control.setAttribute('aria-pressed', selected ? 'true' : 'false');
                        control.style.borderColor = selected ? '#fcd34d' : '#e2e8f0';
                        control.style.background = selected ? '#fffbeb' : '#fff';
                    });
                });
            });

            document.querySelectorAll('.post-comment-form').forEach((form) => {
                form.addEventListener('submit', async (event) => {
                    event.preventDefault();
                    const postId = form.dataset.postId;
                    const input = form.querySelector('input[name="body"]');
                    const body = (input.value || '').trim();
                    if (!body) return;
                    const response = await fetch('/api/feed/' + postId + '/comments', {
                        method: 'POST',
                        headers,
                        body: JSON.stringify({ body }),
                    });
                    if (!response.ok) return;
                    const data = await response.json();
                    const section = form.closest('.post-comments');
                    const list = section.querySelector('.post-comment-list');
                    section.querySelector('.post-comment-empty')?.remove();
                    const item = document.createElement('div');
                    item.style.cssText = 'background:#f1f5f9;border-radius:14px;padding:8px 12px;';
                    item.innerHTML = '<strong style="display:block;font-size:12px;color:#1d2b4b;"></strong><span style="font-size:13px;color:#334155;"></span>';
                    item.querySelector('strong').textContent = data.data?.user?.name || 'Student';
                    item.querySelector('span').textContent = data.data?.body || body;
                    list.appendChild(item);
                    const count = section.querySelector('.post-comment-count');
                    if (count && data.comments_count != null) count.textContent = data.comments_count;
                    input.value = '';
                });
            });
        })();
    </script>
</body>
</html>
