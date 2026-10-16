<?php

namespace App\Http\Controllers\API\Feed;

use App\Http\Controllers\Controller;
use App\Models\Photo;
use App\Models\User;
use App\Services\Analytics\EngagementAnalyticsService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class FeedController extends Controller
{
    /**
     * GET /api/feed
     *
     * filter = all | public | batchmates | mine
     */
    public function index(Request $request): JsonResponse
    {
        $user    = $request->user();
        $filter  = $request->query('filter', 'all');
        $search  = trim((string) $request->query('q', ''));
        $perPage = (int) $request->query('per_page', 10);

        $user->loadMissing('studentRecord');

        $query = Photo::query()
            ->with([
                'user' => function ($q) {
                    $q->select('id', 'name', 'first_name', 'last_name', 'profile_picture', 'profile_visibility', 'graduation_year', 'batch', 'course', 'section_id', 'role', 'is_alumni', 'batch_id', 'student_record_id')
                        ->withCount([
                            'photos as feed_posts_count' => fn ($photo) => $photo->where('status', 'approved'),
                            'taggedPhotos as feed_tagged_count' => fn ($tag) => $tag->where('status', 'approved'),
                        ]);
                },
                'user.studentRecord:id,course,photo',
                'taggedStudents:id,name,first_name,last_name,student_record_id',
                'taggedStudents.studentRecord:id,course,photo',
                'media',
            ])
            ->where('status', 'approved')
            ->with('taggedUsers:id,name,first_name,last_name,student_record_id')
            ->withCount('postViews as unique_views_count');

        if ($search !== '') {
            $query->where(function ($q) use ($search) {
                $q->where('caption', 'like', "%{$search}%")
                    ->orWhereHas('user', function ($userQuery) use ($search) {
                        $userQuery->where('name', 'like', "%{$search}%")
                            ->orWhere('email', 'like', "%{$search}%")
                            ->orWhereHas('studentRecord', function ($studentQuery) use ($search) {
                                $studentQuery->where('student_no', 'like', "%{$search}%")
                                    ->orWhere('course', 'like', "%{$search}%")
                                    ->orWhere('first_name', 'like', "%{$search}%")
                                    ->orWhere('last_name', 'like', "%{$search}%");
                            });
                    })
                    ->orWhereHas('taggedStudents', function ($studentQuery) use ($search) {
                        $studentQuery->where('name', 'like', "%{$search}%")
                            ->orWhereHas('studentRecord', function ($recordQuery) use ($search) {
                                $recordQuery->where('student_no', 'like', "%{$search}%")
                                    ->orWhere('course', 'like', "%{$search}%")
                                    ->orWhere('first_name', 'like', "%{$search}%")
                                    ->orWhere('last_name', 'like', "%{$search}%");
                            });
                    });
            });
        }

        $this->applyAudience($query, $user, $filter);

        $paginator = $query
            ->orderByDesc('created_at')
            ->paginate($perPage);

        return response()->json([
            'data' => $paginator->map(fn (Photo $photo) =>
                $this->formatPost($photo, $user)
            ),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page'    => $paginator->lastPage(),
                'per_page'     => $paginator->perPage(),
                'total'        => $paginator->total(),
            ],
        ]);
    }

    public function recordView(Request $request, Photo $photo, EngagementAnalyticsService $analytics): JsonResponse
    {
        $user = $request->user();

        if (! $this->canViewPost($photo, $user)) {
            abort(404);
        }

        $viewsCount = $analytics->recordUniquePostView(
            photoId: $photo->id,
            viewerUserId: $user->id,
            ipAddress: (string) $request->ip(),
            title: $photo->caption ?: 'Feed post',
            category: $photo->visibility,
            url: "/students/{$photo->user_id}?post={$photo->id}",
        );

        return response()->json([
            'recorded'    => true,
            'views_count' => $viewsCount,
        ]);
    }

    private function formatPost(Photo $photo, User $authUser): array
    {
        if (! array_key_exists('unique_views_count', $photo->getAttributes())) {
            $photo->loadCount('postViews as unique_views_count');
        }

        // Media handling 
        $media = $photo->media->isNotEmpty()
            ? $photo->media->map(fn ($m) => [
                'id'            => $m->id,
                'file_path'     => $m->file_path,
                'resource_type' => $m->resource_type,
                'width'         => $m->width,
                'height'        => $m->height,
                'is_reported'   => (bool) $m->is_reported,
            ])->values()->toArray()
            : ($photo->file_path ? [[
                'id'            => null,
                'file_path'     => $photo->file_path,
                'resource_type' => $photo->ai_metadata['resource_type'] ?? 'image',
                'width'         => null,
                'height'        => null,
                'is_reported'   => false,
            ]] : []);

        // User data 
        $userData = $photo->user
            ? [
                'id'              => $photo->user->id,
                'name'            => $this->displayName($photo->user),
                'course'          => $photo->user->course,
                'profile_picture' => $photo->user->profile_picture,
                'posts_count'     => (int) ($photo->user->feed_posts_count ?? 0),
                'tagged_count'    => (int) ($photo->user->feed_tagged_count ?? 0),
            ]
            : null;

        // Tagged students 
        $taggedStudents = $photo->taggedStudents
            ->concat($photo->taggedUsers)
            ->unique('id')
            ->map(fn ($s) => [
            'id'              => $s->id,
            'name'            => $this->displayName($s),
            'course'          => $s->course,
            'profile_picture' => $s->profile_picture,
        ])->values()->toArray();

        return [
            'id'              => $photo->id,
            'caption'         => $photo->caption,
            'visibility'      => $photo->visibility === 'friends' ? 'batchmates' : $photo->visibility,
            'is_profile_post' => $photo->is_profile_post,
            'views_count'     => (int) ($photo->unique_views_count ?? $photo->views_count ?? 0),
            'time_ago'        => $photo->created_at?->diffForHumans() ?? '',
            'created_at'      => $photo->created_at?->toIso8601String(),

            'user_id' => $photo->user_id,
            'user'   => $userData,

            'media'           => $media,
            'is_reported'     => collect($media)->contains(fn ($m) => (bool) ($m['is_reported'] ?? false)),

            'tagged_students' => $taggedStudents,
        ];
    }

    private function displayName(User $user): string
    {
        return trim((string) $user->name)
            ?: trim(($user->first_name ?? '') . ' ' . ($user->last_name ?? ''))
            ?: 'Student';
    }

    private function applyAudience($query, User $viewer, string $filter): void
    {
        $viewer->loadMissing('studentRecord');
        $year = $viewer->resolvedGraduationYear();

        $query->where(function ($visible) use ($viewer, $filter, $year) {
            if ($filter === 'mine') {
                $visible->where('user_id', $viewer->id);
                return;
            }

            if ($filter === 'public') {
                $visible->where(fn ($public) => $this->wherePublicVisibility($public))
                    ->orWhere('user_id', $viewer->id);
                return;
            }

            if ($filter === 'batchmates') {
                $visible->where('user_id', $viewer->id)
                    ->orWhere(fn ($friends) => $this->whereBatchmateVisibility($friends, $year));
                return;
            }

            $visible->where('user_id', $viewer->id)
                ->orWhere(fn ($public) => $this->wherePublicVisibility($public))
                ->orWhere(fn ($friends) => $this->whereBatchmateVisibility($friends, $year))
                ->orWhere(fn ($tagged) => $this->whereViewerIsTagged($tagged, $viewer));
        });
    }

    private function wherePublicVisibility($query): void
    {
        $query->where('visibility', 'public')
            ->orWhereNull('visibility')
            ->orWhere('visibility', '');
    }

    private function whereBatchmateVisibility($query, ?int $year): void
    {
        $query->whereIn('visibility', ['friends', 'batchmates']);

        if (! $year) {
            $query->whereRaw('1 = 0');
            return;
        }

        $query->whereHas('user', fn ($author) => $author->whereGraduationYear($year));
    }

    private function whereViewerIsTagged($query, User $viewer): void
    {
        $query->where(function ($tagged) use ($viewer) {
            $tagged->whereHas('taggedUsers', fn ($users) => $users->where('users.id', $viewer->id))
                ->orWhereHas('taggedPhotos', function ($legacy) use ($viewer) {
                    $legacy->where('user_id', $viewer->id)
                        ->where(function ($status) {
                            $status->whereNull('status')
                                ->orWhereNotIn('status', ['rejected', 'declined']);
                        });
                });
        });
    }

    private function canViewPost(Photo $photo, User $viewer): bool
    {
        if ((int) $photo->user_id === (int) $viewer->id || $this->viewerIsTagged($photo, $viewer)) {
            return true;
        }

        $visibility = $photo->visibility === 'batchmates' ? 'friends' : ($photo->visibility ?: 'public');

        if ($visibility === 'public') {
            return true;
        }

        if ($visibility !== 'friends') {
            return false;
        }

        $photo->loadMissing('user.studentRecord');
        $viewer->loadMissing('studentRecord');

        return $photo->user instanceof User && $photo->user->sharesBatchYearWith($viewer);
    }

    private function viewerIsTagged(Photo $photo, User $viewer): bool
    {
        if ($photo->relationLoaded('taggedUsers') && $photo->taggedUsers->contains('id', $viewer->id)) {
            return true;
        }

        if ($photo->relationLoaded('taggedStudents') && $photo->taggedStudents->contains('id', $viewer->id)) {
            return true;
        }

        return $photo->taggedUsers()->where('users.id', $viewer->id)->exists()
            || $photo->taggedPhotos()
                ->where('user_id', $viewer->id)
                ->where(function ($status) {
                    $status->whereNull('status')
                        ->orWhereNotIn('status', ['rejected', 'declined']);
                })
                ->exists();
    }
}
