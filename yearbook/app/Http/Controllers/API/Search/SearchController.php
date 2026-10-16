<?php

namespace App\Http\Controllers\API\Search;

use App\Http\Controllers\Controller;
use App\Models\Album;
use App\Models\Faculty;
use App\Models\User;
use App\Services\Student\BatchService;
use App\Support\PlatformSettings;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SearchController extends Controller
{
    private const PER_PAGE = 20;
    private const SUGGEST_LIMIT = 6;

    private function courseVariants(?string $course, ?string $courseShort = null): array
    {
        $values = array_filter([$course, $courseShort], function ($value) {
            $text = strtolower(trim((string) $value));

            return $text !== '' && ! in_array($text, [
                'all',
                'all programs',
                'all courses',
                'all schools',
                'all departments',
                'null',
                'undefined',
            ], true);
        });

        return collect($values)
            ->flatMap(fn ($value) => BatchService::courseVariantsFor($value))
            ->unique()
            ->values()
            ->all();
    }

    // Legacy search 
    public function search(Request $request)
    {
        $query  = $request->get('q', '');
        $type   = $request->get('type', 'all');
        $viewer = $request->user();

        if (strlen($query) < 2) {
            return response()->json(['results' => []]);
        }

        $results = [];

        if (in_array($type, ['students', 'all'])) {
            $results['students'] = User::with(['studentRecord', 'section'])
                ->whereIn('role', PlatformSettings::directoryRoles())
                ->where(function ($q) use ($query) {
                    $q->where('name', 'like', "%{$query}%")
                      ->orWhere('email', 'like', "%{$query}%")
                      ->orWhereHas('studentRecord', function ($student) use ($query) {
                          $student->where('student_no', 'like', "%{$query}%")
                              ->orWhere('course', 'like', "%{$query}%")
                              ->orWhere('first_name', 'like', "%{$query}%")
                              ->orWhere('last_name', 'like', "%{$query}%");
                      });
                })
                ->visibleTo($viewer)
                ->take(10)
                ->get()
                ->map(fn($u) => [
                    'id'              => $u->id,
                    'name'            => $u->name,
                    'student_id'      => $u->student_id,
                    'course'          => $u->course,
                    'profile_picture' => $u->profile_picture,
                ]);
        }

        if (in_array($type, ['faculty', 'all'])) {
            $results['faculty'] = Faculty::where('name', 'like', "%{$query}%")
                ->take(5)->get();
        }

        if (in_array($type, ['albums', 'all'])) {
            $results['albums'] = Album::where('title', 'like', "%{$query}%")
                ->take(5)->get();
        }

        return response()->json(['results' => $results, 'query' => $query]);
    }

    // Student search DB-based with Scout fallback
    public function students(Request $request): JsonResponse
    {
        if ($denied = PlatformSettings::featureDisabled('enable_student_directory_search', 'Student directory search')) {
            return $denied;
        }

        $query       = trim($request->get('q', ''));
        $course      = $request->get('course');
        $courseShort = $request->get('course_short');
        $batchYear   = $request->get('batch_year');
        $section     = $request->get('section');
        $perPage     = min((int) $request->get('per_page', self::PER_PAGE), 100);

        // Use Scout only if it's properly configured and a query is present.
        // Otherwise fall back to Eloquent so the endpoint never 500s.
        if ($query !== '' && empty($this->courseVariants($course, $courseShort)) && $this->scoutAvailable()) {
            return $this->studentsViaScout(
                $query, $course, $courseShort, $batchYear, $section, $perPage
            );
        }

        return $this->studentsViaDatabase(
            $query, $course, $courseShort, $batchYear, $section, $perPage
        );
    }

    //  Scout path (only called when Meilisearch is reachable) 
    private function studentsViaScout(
        string  $query,
        ?string $course,
        ?string $courseShort,
        ?string $batchYear,
        ?string $section,
        int     $perPage
    ): JsonResponse {
        try {
            $builder = User::search($query);

            if ($course)      $builder->where('course',       $course);
            if ($courseShort) $builder->where('course_short', $courseShort);
            if ($batchYear)   $builder->where('batch_year',   (int) $batchYear);
            if ($section)     $builder->where('section',      $section);

            $builder->whereIn('role', PlatformSettings::directoryRoles());

            $paginator = $builder->paginate($perPage);
            $viewer = request()->user();

            return response()->json([
                'data' => collect($paginator->items())
                            ->filter(fn (User $u) => $u->canBeViewedBy($viewer))
                            ->map(fn(User $u) => $this->formatStudent($u))
                            ->values(),
                'meta' => [
                    'total'        => $paginator->total(),
                    'per_page'     => $paginator->perPage(),
                    'current_page' => $paginator->currentPage(),
                    'last_page'    => $paginator->lastPage(),
                    'query'        => $query,
                    'engine'       => 'scout',
                ],
            ]);
        } catch (\Throwable $e) {
            // Meilisearch went down mid-request silently fall back to DB

            return $this->studentsViaDatabase(
                $query, $course, $courseShort, $batchYear, $section, $perPage
            );
        }
    }

    // Eloquent / DB path (always safe) 
    private function studentsViaDatabase(
        string  $query,
        ?string $course,
        ?string $courseShort,
        ?string $batchYear,
        ?string $section,
        int     $perPage
    ): JsonResponse {
        $builder = User::with(['section', 'studentRecord'])
            ->whereIn('role', PlatformSettings::directoryRoles())
            ->visibleTo(request()->user())
            ->when($query !== '', function ($q) use ($query) {
                $q->where(function ($sub) use ($query) {
                    $sub->where('name', 'like', "%{$query}%")
                        ->orWhere('email', 'like', "%{$query}%")
                        ->orWhere('course', 'like', "%{$query}%")
                        ->orWhereHas('studentRecord', function ($student) use ($query) {
                            $student->where('student_no', 'like', "%{$query}%")
                                ->orWhere('course', 'like', "%{$query}%")
                                ->orWhere('first_name', 'like', "%{$query}%")
                                ->orWhere('last_name', 'like', "%{$query}%");
                        });
                });
            })
            ->when($variants = $this->courseVariants($course, $courseShort), fn($q) =>
                $q->where(function ($courseQuery) use ($variants) {
                    $courseQuery
                        ->whereIn('course', $variants)
                        ->orWhereHas('studentRecord', fn($s) => $s->whereIn('course', $variants));
                })
            )
            ->when($batchYear,   fn($q) => $q->whereHas('studentRecord', fn($s) => $s->where('graduation_year', $batchYear)))
            ->when($section,     fn($q) => $q->whereHas('section', fn($s) => $s->where('name', $section)))
            ->orderBy('name');

        $paginator = $builder->paginate($perPage);

        return response()->json([
            'data' => $paginator->through(fn(User $u) => $this->formatStudent($u))->items(),
            'meta' => [
                'total'        => $paginator->total(),
                'per_page'     => $paginator->perPage(),
                'current_page' => $paginator->currentPage(),
                'last_page'    => $paginator->lastPage(),
                'query'        => $query,
                'engine'       => 'database',
            ],
        ]);
    }

    // Suggest 
    public function suggest(Request $request): JsonResponse
    {
        $query = trim($request->get('q', ''));

        if (strlen($query) < 1) {
            return response()->json(['suggestions' => []]);
        }

        try {
            if ($this->scoutAvailable()) {
                $results = User::search($query)
                    ->whereIn('role', PlatformSettings::directoryRoles())
                    ->take(self::SUGGEST_LIMIT)
                    ->get();
            } else {
                throw new \RuntimeException('Scout not available');
            }
        } catch (\Throwable) {
            $results = User::with('studentRecord')
                ->whereIn('role', PlatformSettings::directoryRoles())
                ->visibleTo($request->user())
                ->where(function ($q) use ($query) {
                    $q->where('name', 'like', "%{$query}%")
                      ->orWhere('email', 'like', "%{$query}%")
                      ->orWhereHas('studentRecord', fn($student) => $student->where('student_no', 'like', "%{$query}%"));
                })
                ->orderBy('name')
                ->take(self::SUGGEST_LIMIT)
                ->get();
        }

        $results->loadMissing('studentRecord');
        $viewer = $request->user();

        return response()->json([
            'suggestions' => $results
                ->filter(fn (User $u) => $u->canBeViewedBy($viewer))
                ->map(fn(User $u) => [
                'id'                => $u->id,
                'user_id'           => $u->id,
                'account_user_id'   => $u->id,
                'student_record_id' => $u->student_record_id,
                'name'              => $u->name,
                'student_id'        => $u->student_id,
                'course'            => $u->studentRecord?->course ?? $u->course,
                'course_short'      => $this->shortCourse($u->studentRecord?->course ?? $u->course),
                'graduation_year'   => $u->studentRecord?->graduation_year ?? $u->graduation_year,
                'profile_picture'   => $u->profile_picture,
                'url'               => "/students/{$u->id}",
            ]),
        ]);
    }

    // Filters 
    public function studentFilters(): JsonResponse
    {
        $studentCourses = \App\Models\Student::query()
            ->whereNotNull('course')
            ->distinct()
            ->pluck('course');

        $userCourses = User::query()
            ->whereIn('role', PlatformSettings::directoryRoles())
            ->whereNotNull('course')
            ->distinct()
            ->pluck('course');

        $courses = $studentCourses
            ->merge($userCourses)
            ->filter(fn($course) => trim((string) $course) !== '')
            ->unique()
            ->sort()
            ->values()
            ->map(fn($c) => ['label' => $this->shortCourse($c), 'value' => $c]);

        $batchYears = \App\Models\Student::query()
            ->whereNotNull('graduation_year')
            ->pluck('graduation_year')
            ->filter()
            ->unique()
            ->sort()
            ->values();

        return response()->json([
            'courses'     => $courses,
            'batch_years' => $batchYears,
        ]);
    }

    // Helpers 
    private function formatStudent(User $user): array
    {
        $user->loadMissing('studentRecord');
        $record = $user->studentRecord;
        $course = $record?->course ?? $user->course;
        $graduationYear = $record?->graduation_year ?? $user->graduation_year;

        return [
            'id'                => $user->id,
            'user_id'           => $user->id,
            'account_user_id'   => $user->id,
            'student_record_id' => $user->student_record_id,
            'name'              => $user->name,
            'student_id'        => $record?->student_no ?? $user->student_id,
            'student_no'        => $record?->student_no ?? $user->student_id,
            'email'             => $record?->email ?? $user->email,
            'course'            => $course,
            'program'           => $course,
            'course_short'      => $this->shortCourse($course),
            'section'           => $user->section?->name ?? $record?->section?->name,
            'batch_year'        => $graduationYear,
            'graduation_year'   => $graduationYear,
            'profile_picture'   => $user->profile_picture,
            'photo'             => $record?->photo,
        ];
    }

    private function shortCourse(?string $course): string
    {
        return User::COURSE_SHORT[$course] ?? $course ?? 'Student';
    }

    // Returns true only when Scout/Meilisearch is configured and reachable.
    private function scoutAvailable(): bool
    {
        $driver = config('scout.driver');

        if (!$driver || $driver === 'null') {
            return false;
        }

        if ($driver === 'meilisearch') {
            try {
                /** @var \Meilisearch\Client $client */
                $client = app(\Laravel\Scout\Engines\MeilisearchEngine::class);
                app('meilisearch')->health();
                return true;
            } catch (\Throwable) {
                return false;
            }
        }

        return true; 
    }
}
