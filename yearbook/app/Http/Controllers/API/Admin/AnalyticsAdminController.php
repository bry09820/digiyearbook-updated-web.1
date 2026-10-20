<?php

namespace App\Http\Controllers\API\Admin;

use App\Http\Controllers\Controller;
use App\Models\Message;
use App\Models\Photo;
use App\Models\PostMedia;
use App\Models\VoiceNote;
use App\Models\TaggedPhoto;
use App\Models\ProfileView;
use App\Models\Batch;
use App\Models\Section;
use App\Models\User;
use App\Models\UserPresence;
use App\Services\Analytics\EngagementAnalyticsService;
use App\Services\Student\BatchService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class AnalyticsAdminController extends Controller
{
    public function __construct(
        private readonly EngagementAnalyticsService $analytics,
        private readonly BatchService $batches,
    ) {}

    public function overview(): JsonResponse
    {
        $contentViews = DB::table('content_views');

        $directory = $this->batches->directoryTotals();
        $people = $this->batches->registeredAccounts();
        $accounts = User::accountCensus();

        return response()->json([
            'total_users'    => $accounts['total_users'],
            'total_batches'  => $directory['batches'],
            'total_sections' => $directory['sections'],
            'total_students' => $accounts['total_students'],
            'total_alumni'   => $accounts['total_alumni'],
            'pending_users' => $accounts['pending_users'],
            'approved_users' => $accounts['approved_users'],
            'disapproved_users' => $accounts['disapproved_users'],
            'verified_users' => $accounts['approved_users'],
            'unverified_users' => $accounts['pending_users'],
            'suspended_users' => $accounts['suspended_users'],
            'faculty_members' => $accounts['faculty_members'],
            'admin_accounts' => $accounts['admin_accounts'],
            'enrolled_students' => $people->filter(fn (array $person) => ! empty($person['section_id']))->count(),
            'total_views'    => ProfileView::count() + (clone $contentViews)->count(),
            'views_today'    => ProfileView::whereDate('created_at', today())->count()
                + (clone $contentViews)->whereDate('created_at', today())->count(),
            'total_messages' => Message::count(),
            'online_now'     => UserPresence::where('is_online', true)
                ->where('last_seen_at', '>=', now()->subMinutes(5))
                ->count(),
            'active_users'   => UserPresence::where('last_seen_at', '>=', now()->subDay())->count(),
            'by_section'     => Section::query()
                ->orderBy('name')
                ->get(['id', 'name', 'course', 'batch_id'])
                ->map(fn (Section $section) => [
                    'id'             => $section->id,
                    'name'           => $section->name,
                    'course'         => $section->course,
                    'students_count' => $people->filter(
                        fn (array $person) => (int) ($person['section_id'] ?? 0) === (int) $section->id
                    )->count(),
                ]),
            'by_batch'       => Batch::query()
                ->campusYears()
                ->orderByDesc('graduation_year')
                ->get(['id', 'name', 'graduation_year'])
                ->map(fn (Batch $batch) => [
                    'id'              => $batch->id,
                    'name'            => $batch->name,
                    'graduation_year' => $batch->graduation_year,
                    'students_count'  => $people->filter(
                        fn (array $person) => (int) ($person['graduation_year'] ?? 0) === (int) $batch->graduation_year
                    )->count(),
                ]),
        ])->header('Cache-Control', 'no-store, private, max-age=0')
          ->header('Pragma', 'no-cache');
    }

    public function viewsTrend(Request $request): JsonResponse
    {
        $days = max(7, min((int) $request->get('days', 30), 90));

        $profileData = ProfileView::query()
            ->where('created_at', '>=', now()->subDays($days))
            ->selectRaw('DATE(created_at) as date, COUNT(*) as value')
            ->groupBy('date')
            ->orderBy('date')
            ->pluck('value', 'date');

        $contentData = DB::table('content_views')
            ->where('created_at', '>=', now()->subDays($days))
            ->selectRaw('DATE(created_at) as date, COUNT(*) as value')
            ->groupBy('date')
            ->orderBy('date')
            ->pluck('value', 'date');

        $filled = [];
        for ($i = $days - 1; $i >= 0; $i--) {
            $date  = now()->subDays($i)->format('Y-m-d');
            $label = Carbon::parse($date)->format('M d');
            $filled[] = [
                'label' => $label,
                'value' => (int) ($profileData[$date] ?? 0) + (int) ($contentData[$date] ?? 0),
            ];
        }

        return response()->json(['data' => $filled]);
    }

    public function topProfiles(Request $request): JsonResponse
    {
        $limit = max(1, min((int) $request->get('limit', 10), 50));

        $result = collect($this->analytics->mixedTopViewed($limit))
            ->map(fn ($row) => [
                ...$row,
                'view_count' => (int) ($row['views'] ?? $row['total_views'] ?? 0),
            ]);

        return response()->json(['data' => $result]);
    }

    public function trending(Request $request): JsonResponse
    {
        $limit = max(1, min((int) $request->get('limit', 10), 50));

        $result = collect($this->analytics->mixedTrending($limit))
            ->map(fn ($row) => [
                ...$row,
                'view_count' => (int) ($row['views_this_week'] ?? $row['views'] ?? 0),
            ]);

        return response()->json(['data' => $result]);
    }

    public function engagement(): JsonResponse
    {
        return response()->json([
            'photos'      => Photo::count(),
            'videos'      => PostMedia::where('resource_type', 'video')->count(),
            'voice_notes' => VoiceNote::count(),
            'messages'    => Message::count(),
            'tags'        => TaggedPhoto::count(),
        ]);
    }

    public function presence(Request $request): JsonResponse
    {
        $items = UserPresence::query()
            ->with('user:id,first_name,last_name,profile_picture')
            ->where('is_online', true)
            ->where('last_seen_at', '>=', now()->subMinutes(5))
            ->orderByDesc('last_seen_at')
            ->limit(50)
            ->get()
            ->map(fn($p) => [
                'user_id'            => $p->user_id,
                'name'               => $p->user
                    ? trim("{$p->user->first_name} {$p->user->last_name}")
                    : 'Unknown',
                'profile_picture'    => $p->user?->profile_picture,
                'is_online'          => $p->is_online,
                'last_seen_at'       => $p->last_seen_at,
                'last_seen_at_human' => $p->last_seen_at
                    ? Carbon::parse($p->last_seen_at)->diffForHumans()
                    : null,
            ]);

        return response()->json(['data' => $items]);
    }
}
