<?php

namespace App\Http\Controllers\API\Analytics;

use App\Http\Controllers\Controller;
use App\Services\Analytics\EngagementAnalyticsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AnalyticsController extends Controller
{
    public function __construct(
        private readonly EngagementAnalyticsService $analytics
    ) {}

    public function summary(): JsonResponse
    {
        return response()->json($this->analytics->summary());
    }

    public function topViewed(Request $request): JsonResponse
    {
        $limit = max(1, min((int) $request->query('limit', 10), 50));
        return response()->json(['data' => $this->analytics->mixedTopViewed($limit)]);
    }

    public function trending(Request $request): JsonResponse
    {
        $limit = max(1, min((int) $request->query('limit', 10), 50));
        return response()->json([
            'data' => $this->analytics->mixedTrending($limit),
            'views_this_week' => $this->analytics->viewsThisWeek(),
        ]);
    }

    public function myStats(Request $request): JsonResponse
    {
        return response()->json($this->analytics->myStats($request->user()));
    }

    public function myStatsTrend(Request $request): JsonResponse
    {
        $days = max(7, min((int) $request->query('days', 30), 90));
        return response()->json(['data' => $this->analytics->weeklyTrend($request->user()->id, $days)]);
    }

    public function batchmates(Request $request): JsonResponse
    {
        return response()->json($this->analytics->batchmateStats($request->user()));
    }

    public function platform(): JsonResponse
    {
        return response()->json($this->analytics->platformEngagement());
    }

    //Called by StudentProfileView on every genuine visit 
    public function recordView(Request $request, int $userId): JsonResponse
    {
        $viewerId = $request->user()?->id ?? auth('sanctum')->id();
        if (! $viewerId) {
            return response()->json([
                'recorded' => false,
                'profile_views' => null,
            ]);
        }

        $profileViews = $this->analytics->recordView(
            viewedUserId: $userId,
            viewerUserId: $viewerId ? (int) $viewerId : null,
            ipAddress:    $request->ip()
        );

        return response()->json([
            'recorded' => true,
            'profile_views' => $profileViews,
        ]);
    }

    public function recordContentView(Request $request): JsonResponse
    {
        $data = $request->validate([
            'content_type' => 'required|string|max:40',
            'content_id'   => 'required|integer|min:1',
            'title'        => 'nullable|string|max:255',
            'category'     => 'nullable|string|max:60',
            'url'          => 'nullable|string|max:255',
        ]);

        $viewsCount = $this->analytics->recordContentView(
            contentType:  $data['content_type'],
            contentId:    (int) $data['content_id'],
            viewerUserId: $request->user()?->id,
            ipAddress:    $request->ip(),
            title:        $data['title'] ?? null,
            category:     $data['category'] ?? null,
            url:          $data['url'] ?? null,
        );

        return response()->json([
            'recorded' => true,
            'views_count' => $viewsCount,
        ]);
    }
}
