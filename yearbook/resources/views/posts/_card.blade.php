@include('components.post-card', [
    'post' => $post,
    'allowReactions' => $allowReactions ?? \App\Support\PlatformSettings::bool('allow_reactions'),
    'allowComments' => $allowComments ?? \App\Support\PlatformSettings::bool('allow_comments'),
])
