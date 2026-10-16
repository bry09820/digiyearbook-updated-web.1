<?php

namespace App\Http\Controllers\API\Feed;

use App\Events\PostEngagementUpdated;
use App\Http\Controllers\Controller;
use App\Models\Photo;
use App\Models\PostComment;
use App\Models\PostReaction;
use App\Models\User;
use App\Support\PlatformSettings;
use App\Support\PostEngagementSummary;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PostEngagementController extends Controller
{
    public function summary(Request $request): JsonResponse
    {
        $ids = collect(explode(',', (string) $request->query('ids', '')))
            ->map(fn ($id) => (int) $id)
            ->filter(fn ($id) => $id > 0)
            ->unique()
            ->take(50)
            ->values();

        $photos = Photo::query()->whereIn('id', $ids)->get();
        $visibleIds = $photos
            ->filter(fn (Photo $photo) => $photo->visibleTo($request->user()))
            ->pluck('id')
            ->all();

        return response()->json([
            'data' => PostEngagementSummary::forPhotoIds($visibleIds, $request->user()?->id),
        ]);
    }

    public function react(Request $request, Photo $photo): JsonResponse
    {
        $this->assertVisible($photo, $request->user());
        $this->assertFeature('allow_reactions', 'Reactions');

        $type = $request->validate([
            'type' => ['required', 'in:'.implode(',', PostReaction::TYPES)],
        ])['type'];

        $existing = PostReaction::query()
            ->where('photo_id', $photo->id)
            ->where('user_id', $request->user()->id)
            ->first();

        if ($existing && $existing->type === $type) {
            $existing->delete();
        } elseif ($existing) {
            $existing->update(['type' => $type]);
        } else {
            PostReaction::query()->create([
                'photo_id' => $photo->id,
                'user_id' => $request->user()->id,
                'type' => $type,
            ]);
        }

        return $this->engagementResponse($photo, $request->user());
    }

    public function comments(Request $request, Photo $photo): JsonResponse
    {
        $this->assertVisible($photo, $request->user());

        if (! PlatformSettings::bool('allow_comments')) {
            return response()->json([
                'data' => [],
                'comments_count' => 0,
                'reactions' => PostEngagementSummary::forPhoto($photo->id, $request->user()?->id)['reactions'],
                'allow_comments' => false,
            ]);
        }

        $comments = $photo->comments()
            ->with('user:id,name,first_name,last_name,profile_picture')
            ->orderBy('id')
            ->limit(100)
            ->get();

        $summary = PostEngagementSummary::forPhoto($photo->id, $request->user()?->id);

        return response()->json([
            'data' => PostEngagementSummary::commentsPayload($comments),
            'comments_count' => $summary['comments_count'],
            'reactions' => $summary['reactions'],
            'allow_comments' => PlatformSettings::bool('allow_comments'),
        ]);
    }

    public function storeComment(Request $request, Photo $photo): JsonResponse
    {
        if ($denied = PlatformSettings::featureDisabled('allow_comments', 'Commenting')) {
            return $denied;
        }

        $this->assertVisible($photo, $request->user());

        $validated = $request->validate([
            'body' => ['required', 'string', 'max:1000'],
        ]);
        $body = trim($validated['body']);
        if ($body === '') {
            abort(422, 'Write a comment before posting.');
        }

        $comment = PostComment::query()->create([
            'photo_id' => $photo->id,
            'user_id' => $request->user()->id,
            'body' => $body,
        ]);

        $payload = PostEngagementSummary::commentPayload($comment);
        $summary = PostEngagementSummary::forPhoto($photo->id, $request->user()->id);
        $this->broadcast($photo->id, $summary, $payload);

        return response()->json([
            'data' => $payload,
            'comments_count' => $summary['comments_count'],
            'reactions' => $summary['reactions'],
        ], 201);
    }

    public function destroyComment(Request $request, Photo $photo, PostComment $comment): JsonResponse
    {
        $this->assertVisible($photo, $request->user());

        if ((int) $comment->photo_id !== (int) $photo->id) {
            abort(404);
        }

        if ((int) $comment->user_id !== (int) $request->user()->id) {
            abort(403, 'You can only delete your own comment.');
        }

        $commentId = (int) $comment->id;
        $comment->delete();

        $summary = PostEngagementSummary::forPhoto($photo->id, $request->user()->id);
        $this->broadcast($photo->id, $summary, null, $commentId);

        return response()->json([
            'deleted' => true,
            'comments_count' => $summary['comments_count'],
            'reactions' => $summary['reactions'],
        ]);
    }

    private function engagementResponse(Photo $photo, User $viewer): JsonResponse
    {
        $summary = PostEngagementSummary::forPhoto($photo->id, $viewer->id);
        $this->broadcast($photo->id, $summary);

        return response()->json($summary);
    }

    private function assertVisible(Photo $photo, ?User $viewer): void
    {
        if (! $viewer || ! $photo->visibleTo($viewer) || $photo->status === 'rejected') {
            abort(404);
        }
    }

    private function assertFeature(string $key, string $label): void
    {
        if (! PlatformSettings::bool($key)) {
            abort(403, $label.' are turned off.');
        }
    }

    /**
     * @param  array{reactions: array<string, int|string|null>, comments_count: int}  $summary
     * @param  array<string, mixed>|null  $comment
     */
    private function broadcast(int $photoId, array $summary, ?array $comment = null, ?int $removedCommentId = null): void
    {
        try {
            broadcast(new PostEngagementUpdated($photoId, $summary, $comment, $removedCommentId));
        } catch (\Throwable) {
            // The feed also polls, so a missing broadcast server does not drop the saved comment or reaction.
        }
    }
}
