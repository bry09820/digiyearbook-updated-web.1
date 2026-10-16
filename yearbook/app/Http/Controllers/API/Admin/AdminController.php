<?php

namespace App\Http\Controllers\API\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use App\Models\Setting;
use App\Models\User;
use App\Services\Student\BatchService;
use Carbon\Carbon;

class AdminController extends Controller
{
    private const ROLE_STUDENT = 'student';
    private const ROLE_FACULTY = 'faculty';
    private const AUDIT_STATUS_FAILED = 'Failed';
    private const UPLOAD_TYPE_IMAGE = 'image';
    private const LIMIT_RECENT_ACTIVITY  = 10;
    private const LIMIT_RECENT_UPLOADS   = 8;
    private const LIMIT_TRENDING_ALUMNI  = 5;
    private const ENGAGEMENT_WINDOW_DAYS = 7;

    public function dashboard(Request $request, BatchService $batches): JsonResponse
    {
        $directory = $batches->directoryTotals();
        $registered = $batches->registeredAccounts();
        $accounts = User::accountCensus();
        $tiers = User::subscriptionTierCensus();
        $galleryPhotos  = DB::table('photos')->count();

        $alertCount = DB::table('audit_logs')
            ->where('status', self::AUDIT_STATUS_FAILED)
            ->whereDate('created_at', today())
            ->count();

        $activeSubscriptions = $tiers['premium_standard'] + $tiers['premium'];

        $metrics = [
            'total_users'          => $accounts['total_users'],
            'total_students'       => $accounts['total_students'],
            'total_batches'        => $directory['batches'],
            'total_sections'       => $directory['sections'],
            'total_alumni'         => $accounts['total_alumni'],
            'verified_users'       => $accounts['verified_users'],
            'unverified_users'     => $accounts['unverified_users'],
            'suspended_users'      => $accounts['suspended_users'],
            'admin_accounts'       => $accounts['admin_accounts'],
            'enrolled_students'    => $registered->filter(fn (array $person) => ! empty($person['section_id']))->count(),
            'active_users'         => DB::table('user_presence')->where('last_seen_at', '>=', now()->subDay())->count(),
            'faculty_members'      => $accounts['faculty_members'],
            'gallery_photos'       => $galleryPhotos,
            'system_alerts'        => $alertCount,
            'active_subscriptions' => $activeSubscriptions,
        ];

        $enrollmentByYear = $registered
            ->filter(fn (array $person) => ! empty($person['graduation_year']))
            ->countBy(fn (array $person) => (int) $person['graduation_year'])
            ->map(fn ($total, $year) => ['year' => (int) $year, 'total' => (int) $total])
            ->sortBy('year')
            ->values();

        // Recent Activity 
        $recentActivity = DB::table('audit_logs')
            ->orderByDesc('logged_at')
            ->limit(self::LIMIT_RECENT_ACTIVITY)
            ->get()
            ->map(fn($log) => [
                'id'      => $log->id,
                'type'    => $this->mapActionToType($log->action),
                'title'   => $log->action,
                'subject' => $log->user_name ?? 'System',
                'time'    => Carbon::parse($log->logged_at)->diffForHumans(),
            ]);

        // Recent Uploads
        $recentUploads = DB::table('photos')
            ->join('users', 'photos.user_id', '=', 'users.id')
            ->selectRaw("
                photos.id,
                photos.file_path,
                CONCAT(users.first_name, ' ', users.last_name) AS uploader,
                ? AS type,
                photos.created_at
            ", [self::UPLOAD_TYPE_IMAGE])
            ->orderByDesc('photos.created_at')
            ->limit(self::LIMIT_RECENT_UPLOADS)
            ->get()
            ->map(fn($u) => [
                'id'       => $u->id,
                'filename' => basename((string) $u->file_path),
                'uploader' => $u->uploader,
                'type'     => $u->type,
                'time'     => Carbon::parse($u->created_at)->diffForHumans(),
            ]);

    //Trending Alumni
    $trendingAlumni = DB::table('profile_views')
        ->join('users', 'profile_views.viewed_user_id', '=', 'users.id')
        ->leftJoin('students', 'users.student_record_id', '=', 'students.id')
        ->where('users.role', self::ROLE_STUDENT)
        ->whereNull('users.deleted_at')
        ->selectRaw("
            users.id,
            CONCAT(users.first_name, ' ', users.last_name) AS name,
            students.course AS program,
            COUNT(profile_views.id) AS views,
            UPPER(CONCAT(LEFT(users.first_name, 1), LEFT(users.last_name, 1))) AS avatar_initials
        ")
        ->groupBy('users.id', 'users.first_name', 'users.last_name', 'students.course')
        ->orderByDesc('views')
        ->limit(self::LIMIT_TRENDING_ALUMNI)
        ->get();

        // Engagement
        $engagementWindowStart = now()->subDays(self::ENGAGEMENT_WINDOW_DAYS);

        $engagement = [
            'weekly_visits' => DB::table('audit_logs')
                ->where('logged_at', '>=', $engagementWindowStart)
                ->count(),

            'returning_alumni' => DB::table('personal_access_tokens')
                ->join('users', 'personal_access_tokens.tokenable_id', '=', 'users.id')
                ->where('users.role', self::ROLE_STUDENT)
                ->whereNull('users.deleted_at')
                ->where('personal_access_tokens.last_used_at', '>=', $engagementWindowStart)
                ->distinct('users.id')
                ->count('users.id'),

            'new_registrations' => DB::table('users')
                ->where('role', self::ROLE_STUDENT)
                ->whereNull('deleted_at')
                ->where('created_at', '>=', $engagementWindowStart)
                ->count(),
        ];

        return response()->json([
            'metrics'            => $metrics,
            'enrollment_by_year' => $enrollmentByYear,
            'recent_activity'    => $recentActivity,
            'recent_uploads'     => $recentUploads,
            'trending_alumni'    => $trendingAlumni,
            'engagement'         => $engagement,
        ])->header('Cache-Control', 'no-store, private, max-age=0')
          ->header('Pragma', 'no-cache');
    }

    public function getSettings(): JsonResponse
    {
        return response()->json(['data' => Setting::pluck('value', 'key')]);
    }

    public function saveSettings(Request $request): JsonResponse
    {
        foreach ($request->all() as $key => $value) {
            Setting::updateOrCreate(['key' => $key], ['value' => $value]);
        }
        return response()->json(['message' => 'Settings saved.']);
    }

    public function deleteStudent(int $id): JsonResponse
    {
        $deleted = DB::table('users')
            ->where('id', $id)
            ->where('role', self::ROLE_STUDENT)
            ->delete();

        return $deleted
            ? response()->json(['message' => 'Student deleted.'])
            : response()->json(['message' => 'Student not found.'], 404);
    }

    private function mapActionToType(string $action): string
    {
        $action = strtolower($action);
        return match(true) {
            str_contains($action, 'register') || str_contains($action, 'created') => 'register',
            str_contains($action, 'upload')                                        => 'upload',
            str_contains($action, 'update')  || str_contains($action, 'edit')     => 'update',
            str_contains($action, 'delete')  || str_contains($action, 'removed')  => 'delete',
            str_contains($action, 'setting')                                       => 'settings',
            str_contains($action, 'login')   || str_contains($action, 'logout')   => 'login',
            default                                                                => 'default',
        };
    }
}
