<?php

namespace App\Support;

use App\Models\PostComment;
use App\Models\PostReaction;
use Illuminate\Support\Collection;

class PostEngagementSummary
{
    /**
     * @param  list<int>  $photoIds
     * @return array<int, array{reactions: array<string, int|string|null>, comments_count: int}>
     */
    public static function forPhotoIds(array $photoIds, ?int $viewerId): array
    {
        $photoIds = array_values(array_unique(array_map('intval', $photoIds)));
        $empty = [];
        foreach ($photoIds as $photoId) {
            $empty[$photoId] = self::blank();
        }

        if ($photoIds === []) {
            return [];
        }

        $reactions = PostReaction::query()
            ->whereIn('photo_id', $photoIds)
            ->get(['photo_id', 'user_id', 'type']);

        $commentCounts = PostComment::query()
            ->whereIn('photo_id', $photoIds)
            ->selectRaw('photo_id, COUNT(*) as total')
            ->groupBy('photo_id')
            ->pluck('total', 'photo_id');

        foreach ($reactions as $reaction) {
            $photoId = (int) $reaction->photo_id;
            $type = (string) $reaction->type;
            if (! isset($empty[$photoId]['reactions'][$type])) {
                continue;
            }
            $empty[$photoId]['reactions'][$type]++;
            $empty[$photoId]['reactions']['total']++;
            if ($viewerId && (int) $reaction->user_id === $viewerId) {
                $empty[$photoId]['reactions']['mine'] = $type;
            }
        }

        foreach ($commentCounts as $photoId => $total) {
            $empty[(int) $photoId]['comments_count'] = (int) $total;
        }

        return $empty;
    }

    public static function forPhoto(int $photoId, ?int $viewerId): array
    {
        return self::forPhotoIds([$photoId], $viewerId)[$photoId] ?? self::blank();
    }

    /** @return array{reactions: array<string, int|string|null>, comments_count: int} */
    public static function blank(): array
    {
        return [
            'reactions' => [
                'like' => 0,
                'heart' => 0,
                'haha' => 0,
                'total' => 0,
                'mine' => null,
            ],
            'comments_count' => 0,
        ];
    }

    public static function commentPayload(PostComment $comment): array
    {
        $comment->loadMissing('user:id,name,first_name,last_name,profile_picture');
        $user = $comment->user;

        return [
            'id' => $comment->id,
            'body' => $comment->body,
            'created_at' => $comment->created_at?->toIso8601String(),
            'time_ago' => $comment->created_at?->diffForHumans() ?? '',
            'user' => $user ? [
                'id' => $user->id,
                'name' => trim((string) $user->name)
                    ?: trim(($user->first_name ?? '').' '.($user->last_name ?? ''))
                    ?: 'Student',
                'profile_picture' => $user->profile_picture,
            ] : null,
        ];
    }

    /**
     * @param  Collection<int, PostComment>  $comments
     * @return list<array<string, mixed>>
     */
    public static function commentsPayload(Collection $comments): array
    {
        return $comments
            ->map(fn (PostComment $comment) => self::commentPayload($comment))
            ->values()
            ->all();
    }
}
