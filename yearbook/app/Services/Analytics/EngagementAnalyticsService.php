<?php

namespace App\Services\Analytics;

use App\Models\Message;
use App\Models\Photo;
use App\Models\TaggedPhoto;
use App\Models\User;
use App\Models\ContentView;
use App\Models\ProfileView;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class EngagementAnalyticsService
{
    public function summary(): array
    {
        $census = User::accountCensus();

        return [
            'total_students'  => $census['total_students'],
            'total_alumni'    => $census['total_alumni'],
            'total_users'     => $census['total_users'],
            'faculty_members' => $census['faculty_members'],
            'total_photos'    => Photo::query()->count(),
            'total_messages'  => Message::query()->count(),
            'total_tagged'    => TaggedPhoto::query()->where('status', 'approved')->count(),
        ];
    }

    public function myStats(User $user): array
    {
        $profileViews = ProfileView::query()
            ->where('viewed_user_id', $user->id)
            ->where(function ($view) use ($user) {
                $view->whereNull('viewer_user_id')
                    ->orWhere('viewer_user_id', '!=', $user->id);
            })
            ->count();

        if ((int) $user->profile_views !== $profileViews) {
            $user->forceFill(['profile_views' => $profileViews])->saveQuietly();
        }

        return [
            'profile_views'     => $profileViews,
            'photos_uploaded'   => Photo::query()->where('user_id', $user->id)->count(),
            'times_tagged'      => $this->timesTaggedCount($user),
            'messages_sent'     => Message::query()->where('sender_id', $user->id)->count(),
            'messages_received' => Message::query()->where('receiver_id', $user->id)->count(),
        ];
    }

    public function timesTaggedCount(User $user): int
    {
        $pivotIds = Schema::hasTable('photo_tags')
            ? DB::table('photo_tags')->where('user_id', $user->id)->pluck('photo_id')
            : collect();

        $legacyExtra = TaggedPhoto::query()
            ->where('user_id', $user->id)
            ->where(function ($status) {
                $status->whereNull('status')
                    ->orWhereNotIn('status', ['rejected', 'declined']);
            })
            ->get(['photo_id'])
            ->filter(function ($tag) use ($pivotIds) {
                if (! $tag->photo_id) {
                    return true;
                }

                return ! $pivotIds->contains(fn ($id) => (int) $id === (int) $tag->photo_id);
            })
            ->count();

        return $pivotIds->count() + $legacyExtra;
    }

    public function batchmateStats(User $user): array
    {
        $topProfiles = User::where('batch_id', $user->batch_id)
            ->whereIn('role', ['student', 'alumni'])
            ->where('profile_visibility', 'public')
            ->where('id', '!=', $user->id)
            ->with('studentRecord:id,course,graduation_year,photo')
            ->withCount(['profileViews as live_profile_views' => fn ($view) => $this->excludeSelfViews($view)])
            ->orderByDesc('live_profile_views')
            ->take(5)
            ->get()
            ->map(fn($u) => [
                'id'              => $u->id,
                'name'            => $u->name,
                'profile_picture' => $u->profile_picture,
                'course'          => $u->course,
                'batch'           => $u->batch,
                'graduation_year' => $u->graduation_year,
                'role'            => $u->role,
                'views'           => (int) $u->live_profile_views,
            ]);

        return [
            'batch_id'     => $user->batch_id,
            'top_profiles' => $topProfiles,
        ];
    }

    public function topViewed(int $limit = 10): array
    {
        // Use Eloquent + eager-load studentRecord so accessors work.
        return User::whereIn('role', ['student', 'alumni'])
            ->where('profile_visibility', 'public')
            ->with('studentRecord:id,course,graduation_year,photo')
            ->withCount(['profileViews as live_profile_views' => fn ($view) => $this->excludeSelfViews($view)])
            ->orderByDesc('live_profile_views')
            ->take($limit)
            ->get()
            ->map(fn($u) => [
                'id'              => $u->id,
                'name'            => $u->name,
                'profile_picture' => $u->profile_picture,
                'course'          => $u->course,
                'batch'           => $u->batch,
                'graduation_year' => $u->graduation_year,
                'role'            => $u->role,
                'views'           => (int) $u->live_profile_views,
            ])
            ->toArray();
    }

    public function trending(int $limit = 10): array
    {
        // Join students table (via student_record_id) to get the real columns,
        // and use users.profile_picture which now exists after the migration.
        return DB::table('profile_views')
            ->select(
                'profile_views.viewed_user_id as id',
                DB::raw('COUNT(*) as views_this_week'),
                'users.name',
                'users.profile_picture',
                'users.role',
                'students.course',
                'students.graduation_year as batch',
                'students.graduation_year',
                'users.profile_views as total_views'
            )
            ->join('users', 'users.id', '=', 'profile_views.viewed_user_id')
            ->leftJoin('students', 'students.id', '=', 'users.student_record_id')
            ->where('profile_views.created_at', '>=', now()->subDays(7))
            ->where('users.profile_visibility', 'public')
            ->whereIn('users.role', ['student', 'alumni'])
            ->whereNull('users.deleted_at')
            ->groupBy(
                'profile_views.viewed_user_id',
                'users.name',
                'users.profile_picture',
                'users.role',
                'students.course',
                'students.graduation_year',
                'users.profile_views'
            )
            ->orderByDesc('views_this_week')
            ->limit($limit)
            ->get()
            ->toArray();
    }

    // Core record logic 
    public function recordView(int $viewedUserId, ?int $viewerUserId, string $ipAddress): void
    {
        if ($viewerUserId && $viewerUserId === $viewedUserId) {
            return;
        }

        $alreadyViewed = ProfileView::where('viewed_user_id', $viewedUserId)
            ->where(function ($q) use ($viewerUserId, $ipAddress) {
                if ($viewerUserId) {
                    $q->where('viewer_user_id', $viewerUserId);
                } else {
                    $q->whereNull('viewer_user_id')->where('viewer_ip', $ipAddress);
                }
            })
            ->where('created_at', '>=', now()->subHour())
            ->exists();

        if ($alreadyViewed) {
            return;
        }

        ProfileView::create([
            'viewed_user_id' => $viewedUserId,
            'viewer_user_id' => $viewerUserId,
            'viewer_ip'      => $ipAddress,
        ]);

        User::where('id', $viewedUserId)->increment('profile_views');
    }

    public function weeklyTrend(int $userId, int $days = 30): array
    {
        $rows = ProfileView::where('viewed_user_id', $userId)
            ->where(function ($view) use ($userId) {
                $view->whereNull('viewer_user_id')
                    ->orWhere('viewer_user_id', '!=', $userId);
            })
            ->where('created_at', '>=', now()->subDays($days))
            ->selectRaw('DATE(created_at) as date, COUNT(*) as views')
            ->groupBy('date')
            ->orderBy('date')
            ->pluck('views', 'date')
            ->toArray();

        $filled = [];
        for ($i = $days - 1; $i >= 0; $i--) {
            $date          = now()->subDays($i)->toDateString();
            $filled[$date] = $rows[$date] ?? 0;
        }

        return $filled;
    }

    public function viewsThisWeek(): int
    {
        $profiles = ProfileView::query()
            ->where('created_at', '>=', now()->subDays(7))
            ->where(function ($view) {
                $view->whereNull('viewer_user_id')
                    ->orWhereColumn('viewer_user_id', '!=', 'viewed_user_id');
            })
            ->count();

        $content = ContentView::query()
            ->where('created_at', '>=', now()->subDays(7))
            ->count();

        return $profiles + $content;
    }

    private function excludeSelfViews($query): void
    {
        $query->where(function ($view) {
            $view->whereNull('viewer_user_id')
                ->orWhereColumn('profile_views.viewer_user_id', '!=', 'profile_views.viewed_user_id');
        });
    }

    public function platformEngagement(): array
    {
        return [
            'views_today'          => ProfileView::whereDate('created_at', today())->count(),
            'views_this_week'      => ProfileView::where('created_at', '>=', now()->subDays(7))->count(),
            'views_this_month'     => ProfileView::where('created_at', '>=', now()->subDays(30))->count(),
            'unique_viewers_today' => ProfileView::whereDate('created_at', today())
                                        ->whereNotNull('viewer_user_id')
                                        ->distinct('viewer_user_id')
                                        ->count('viewer_user_id'),
        ];
    }

    public function mixedTopViewed(int $limit = 10): array
    {
        $profiles = collect($this->topViewed($limit))
            ->map(fn ($item) => [
                ...$item,
                'type' => 'profile',
                'url'  => "/students/{$item['id']}",
            ]);

        $content = DB::table('content_views')
            ->select(
                'content_type',
                'content_id',
                DB::raw('MAX(title) as title'),
                DB::raw('MAX(category) as category'),
                DB::raw('MAX(url) as url'),
                DB::raw('COUNT(*) as views')
            )
            ->groupBy('content_type', 'content_id')
            ->orderByDesc('views')
            ->limit($limit)
            ->get()
            ->map(fn ($row) => $this->formatContentViewRow($row, 'views'));

        return $profiles
            ->merge($content)
            ->sortByDesc(fn ($item) => $item['views'] ?? 0)
            ->take($limit)
            ->values()
            ->toArray();
    }

    public function mixedTrending(int $limit = 10): array
    {
        $profiles = collect($this->trending($limit))
            ->map(function ($item) {
                $row = (array) $item;
                $row['type'] = 'profile';
                $row['url'] = "/students/{$row['id']}";
                return $row;
            });

        $content = DB::table('content_views')
            ->select(
                'content_type',
                'content_id',
                DB::raw('MAX(title) as title'),
                DB::raw('MAX(category) as category'),
                DB::raw('MAX(url) as url'),
                DB::raw('COUNT(*) as views_this_week')
            )
            ->where('created_at', '>=', now()->subDays(7))
            ->groupBy('content_type', 'content_id')
            ->orderByDesc('views_this_week')
            ->limit($limit)
            ->get()
            ->map(fn ($row) => $this->formatContentViewRow($row, 'views_this_week'));

        return $profiles
            ->merge($content)
            ->sortByDesc(fn ($item) => $item['views_this_week'] ?? 0)
            ->take($limit)
            ->values()
            ->toArray();
    }

    public function recordContentView(
        string $contentType,
        int $contentId,
        ?int $viewerUserId,
        string $ipAddress,
        ?string $title = null,
        ?string $category = null,
        ?string $url = null
    ): ?int {
        $allowed = [
            'batch',
            'post',
            'gallery_album',
            'gallery_photo',
            'graduation_album',
            'graduation_photo',
            'graduation_video',
            'graduation_program',
            'graduation_invitation',
            'graduation_song',
            'graduation_speech',
            'baccalaureate_mass',
            'yearbook',
        ];

        if (! in_array($contentType, $allowed, true)) {
            return null;
        }

        if ($contentType === 'post') {
            return $this->recordUniquePostView($contentId, $viewerUserId, $ipAddress, $title, $category, $url);
        }

        $alreadyViewed = ContentView::where('content_type', $contentType)
            ->where('content_id', $contentId)
            ->where(function ($q) use ($viewerUserId, $ipAddress) {
                if ($viewerUserId) {
                    $q->where('viewer_user_id', $viewerUserId);
                } else {
                    $q->whereNull('viewer_user_id')->where('viewer_ip', $ipAddress);
                }
            })
            ->where('created_at', '>=', now()->subHour())
            ->exists();

        if ($alreadyViewed) {
            return null;
        }

        ContentView::create([
            'content_type'   => $contentType,
            'content_id'     => $contentId,
            'viewer_user_id' => $viewerUserId,
            'viewer_ip'      => $ipAddress,
            'title'          => $title,
            'category'       => $category,
            'url'            => $url,
        ]);

        return null;
    }

    public function recordUniquePostView(
        int $photoId,
        ?int $viewerUserId,
        string $ipAddress,
        ?string $title = null,
        ?string $category = null,
        ?string $url = null
    ): int {
        $photo = Photo::query()->find($photoId);
        if (! $photo) {
            return 0;
        }

        if ($viewerUserId && (int) $viewerUserId !== (int) $photo->user_id) {
            ContentView::firstOrCreate(
                [
                    'content_type'   => 'post',
                    'content_id'     => $photo->id,
                    'viewer_user_id' => $viewerUserId,
                ],
                [
                    'viewer_ip' => $ipAddress,
                    'title'     => $title ?: ($photo->caption ?: 'Feed post'),
                    'category'  => $category ?: $photo->visibility,
                    'url'       => $url ?: "/students/{$photo->user_id}?post={$photo->id}",
                ]
            );
        }

        $count = (int) ContentView::query()
            ->where('content_type', 'post')
            ->where('content_id', $photo->id)
            ->whereNotNull('viewer_user_id')
            ->distinct()
            ->count('viewer_user_id');

        if ((int) $photo->views_count !== $count) {
            $photo->forceFill(['views_count' => $count])->save();
        }

        return $count;
    }

    private function formatContentViewRow(object $row, string $viewsKey): array
    {
        $views = (int) ($row->{$viewsKey} ?? 0);

        return [
            'id'              => "{$row->content_type}:{$row->content_id}",
            'content_id'      => (int) $row->content_id,
            'type'            => $row->content_type,
            'name'            => $row->title ?: $this->labelForContentType($row->content_type),
            'profile_picture' => null,
            'course'          => $this->labelForContentType($row->content_type),
            'batch'           => $row->category,
            'graduation_year' => null,
            'views'           => $views,
            'views_this_week' => $views,
            'total_views'     => $views,
            'url'             => $row->url ?: '#',
        ];
    }

    private function labelForContentType(string $type): string
    {
        return match ($type) {
            'batch'                 => 'Batch',
            'post'                  => 'Post',
            'gallery_album'         => 'Gallery Album',
            'gallery_photo'         => 'Gallery Photo',
            'graduation_album'      => 'Graduation Album',
            'graduation_photo'      => 'Graduation Photo',
            'graduation_video'      => 'Graduation Video',
            'graduation_program'    => 'Program',
            'graduation_invitation' => 'Invitation',
            'graduation_song'       => 'Grad Song',
            'graduation_speech'     => 'Speech',
            'baccalaureate_mass'    => 'Baccalaureate Mass',
            'yearbook'              => 'Yearbook',
            default                 => ucwords(str_replace('_', ' ', $type)),
        };
    }
}
