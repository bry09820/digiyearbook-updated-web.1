<?php

namespace App\Services\Student;

use App\Models\Batch;
use App\Models\Section;
use App\Models\Student;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Pagination\LengthAwarePaginator as Paginator;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class BatchService
{
    // NU Lipa Department & Course Maps 

    public const DEPARTMENT_MAP = [
        'Bachelor of Science in Architecture'           => 'SACE',
        'Bachelor of Multimedia Arts'                   => 'SACE',
        'Bachelor of Science in Civil Engineering'      => 'SACE',
        'Bachelor of Science in Computer Science'       => 'SACE',
        'Bachelor of Science in Information Technology' => 'SACE',
        'Bachelor of Science in Nursing'                => 'SAHS',
        'Bachelor of Science in Medical Technology'     => 'SAHS',
        'Bachelor of Science in Psychology'             => 'SAHS',
        'Bachelor of Science in Accountancy' => 'SABM',
        'Bachelor of Science in Business Administration - Financial Management' => 'SABM',
        'Bachelor of Science in Business Administration - Marketing Management' => 'SABM',
        'Bachelor of Science in Tourism Management' => 'SABM',
        'Master in Management' => 'SABM',
        'ABM'                       => 'SHS',
        'STEM'                      => 'SHS',
        'HUMSS'                     => 'SHS',
    ];

    public const COURSE_CODE_MAP = [
        'Bachelor of Science in Architecture' => 'BSArch',
        'Bachelor of Multimedia Arts' => 'BMA',
        'Bachelor of Science in Civil Engineering' => 'BSCE',
        'Bachelor of Science in Computer Science' => 'BSCS',
        'Bachelor of Science in Information Technology' => 'BSIT',
        'Bachelor of Science in Nursing' => 'BSN',
        'Bachelor of Science in Medical Technology' => 'BSMT',
        'Bachelor of Science in Psychology' => 'BSPsych',
        'Bachelor of Science in Accountancy' => 'BSA',
        'Bachelor of Science in Business Administration - Financial Management' => 'BSBA-FM',
        'Bachelor of Science in Business Administration - Marketing Management' => 'BSBA-MM',
        'Bachelor of Science in Tourism Management' => 'BSTM',
        'Master in Management' => 'MM',
        'ABM'                       => 'ABM',
        'STEM'                      => 'STEM',
        'HUMSS'                     => 'HUMSS',
    ];

    public const COURSE_ALIASES = [
        'Bachelor of Science in Architecture' => [
            'Bachelor of Science in Architecture',
            'BS Architecture',
            'BSArch',
        ],
        'Bachelor of Multimedia Arts' => [
            'Bachelor of Multimedia Arts',
            'Bachelor of Multimedia Arts (BMMA)',
            'BMA',
            'BMMA',
        ],
        'Bachelor of Science in Civil Engineering' => [
            'Bachelor of Science in Civil Engineering',
            'BS Civil Engineering',
            'BSCE',
        ],
        'Bachelor of Science in Computer Science' => [
            'Bachelor of Science in Computer Science',
            'BS Computer Science',
            'BSCS',
        ],
        'Bachelor of Science in Information Technology' => [
            'Bachelor of Science in Information Technology',
            'BS Information Technology',
            'BSIT',
        ],
        'Bachelor of Science in Nursing' => [
            'Bachelor of Science in Nursing',
            'BS Nursing',
            'BSN',
        ],
        'Bachelor of Science in Medical Technology' => [
            'Bachelor of Science in Medical Technology',
            'BS Medical Technology',
            'BSMT',
        ],
        'Bachelor of Science in Psychology' => [
            'Bachelor of Science in Psychology',
            'BS Psychology',
            'BSPsych',
            'BSP',
        ],
        'Bachelor of Science in Accountancy' => [
            'Bachelor of Science in Accountancy',
            'BS Accountancy',
            'BSA',
        ],
        'Bachelor of Science in Business Administration - Financial Management' => [
            'Bachelor of Science in Business Administration - Financial Management',
            'BSBA Financial Management',
            'BSBA-FM',
            'BSBAFM',
        ],
        'Bachelor of Science in Business Administration - Marketing Management' => [
            'Bachelor of Science in Business Administration - Marketing Management',
            'BSBA Marketing Management',
            'BSBA-MM',
            'BSBAMM',
        ],
        'Bachelor of Science in Tourism Management' => [
            'Bachelor of Science in Tourism Management',
            'BS Tourism Management',
            'BSTM',
            'BBSTM',
        ],
        'Master in Management' => [
            'Master in Management',
            'MM',
        ],
        'ABM' => ['ABM'],
        'STEM' => ['STEM'],
        'HUMSS' => ['HUMSS', 'HUMMS'],
    ];

    private const DEPARTMENT_ORDER = ['SACE', 'SAHS', 'SABM', 'SHS', 'SGS', 'Unassigned'];

    // Columns 

    private const PUBLIC_COLS = [
        'id',
        'first_name',
        'last_name',
        'photo',
        'student_no',
        'course',
        'graduation_year',
        'section_id',
        'batch_id',
    ];

    private const PREMIUM_COLS = [
        'id',
        'first_name',
        'last_name',
        'middle_name',
        'nickname',
        'photo',
        'student_no',
        'email',
        'birthday',
        'hometown',
        'course',
        'graduation_year',
        'section_id',
        'batch_id',
        'honors',
        'organizations',
        'achievements',
        'motto',
        'student_quote',
        'ambition',
        'future_plans',
        'most_likely_to',
        'message_to_batchmates',
        'facebook_url',
        'instagram_url',
        'linkedin_url',
        'github_url',
    ];

    private function cols(bool $isPremium): array
    {
        return $isPremium ? self::PREMIUM_COLS : self::PUBLIC_COLS;
    }

    // Base query 
    public function baseQuery(bool $isPremium)
    {
        return Student::select($this->cols($isPremium))
            ->with([
                'section:id,name',
                'batch:id,name,graduation_year,department',
                'userAccount:id,student_record_id',
            ]);
    }

    // Helpers 
    private function coursesForDepartment(string $department): array
    {
        return collect(self::DEPARTMENT_MAP)
            ->filter(fn ($dept) => $dept === $department)
            ->keys()
            ->flatMap(fn ($course) => $this->courseVariants($course))
            ->unique()
            ->toArray();
    }

    private function normalizeFilter(?string $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $value = trim($value);
        $lower = strtolower($value);
        $openFilters = [
            'all',
            'all programs',
            'all courses',
            'all schools',
            'all departments',
            'all years',
            'all sections',
            'null',
            'undefined',
        ];

        return $value === '' || in_array($lower, $openFilters, true)
            ? null
            : $value;
    }

    private function canonicalCourse(?string $course): ?string
    {
        $course = $this->normalizeFilter($course);

        if ($course === null) {
            return null;
        }

        foreach (self::COURSE_ALIASES as $canonical => $aliases) {
            if (in_array(strtolower($course), array_map('strtolower', $aliases), true)) {
                return $canonical;
            }
        }

        return $course;
    }

    private function courseVariants(?string $course): array
    {
        $canonical = $this->canonicalCourse($course);

        if ($canonical === null) {
            return [];
        }

        return array_values(array_unique(self::COURSE_ALIASES[$canonical] ?? [$canonical]));
    }

    public static function courseVariantsFor(?string $course): array
    {
        if ($course === null) {
            return [];
        }

        $course = trim($course);

        if ($course === '' || strtolower($course) === 'null' || strtolower($course) === 'undefined') {
            return [];
        }

        foreach (self::COURSE_ALIASES as $canonical => $aliases) {
            if (in_array(strtolower($course), array_map('strtolower', $aliases), true)) {
                return array_values(array_unique($aliases));
            }
        }

        return [$course];
    }

    private function whereCourseMatches($query, ?string $course)
    {
        $variants = $this->courseVariants($course);

        return empty($variants) ? $query : $query->whereIn('students.course', $variants);
    }

    // Discovery: Batchmates
    public function getBatchmates(User $viewer, ?string $course = null, ?int $year = null, ?string $department = null): Collection
    {
        $course     = $this->normalizeFilter($course);
        $department = $this->normalizeFilter($department);

        if ($year !== null && $year <= 0) {
            $year = null;
        }

        if ($year !== null && ! Batch::yearAllowed($year)) {
            return collect();
        }

        return $this->registeredAccounts()
            ->when($department, fn (Collection $people) => $people->filter(
                fn (array $person) => strcasecmp((string) $person['department'], $department) === 0
            ))
            ->when($course, fn (Collection $people) => $people->filter(
                fn (array $person) => $this->sameCourse($person['course'] ?? null, $course)
            ))
            ->when($year, fn (Collection $people) => $people->filter(
                fn (array $person) => (int) ($person['graduation_year'] ?? 0) === $year
            ))
            ->sortBy([
                ['department', 'asc'],
                ['course', 'asc'],
                ['name', 'asc'],
            ])
            ->values();
    }

    /**
     * Section rows created in admin, limited to the campus year range.
     */
    public function catalogSections(?string $course = null, ?int $year = null, ?string $department = null): Collection
    {
        $course = $this->normalizeFilter($course);
        $department = $this->normalizeFilter($department);

        if ($year !== null && ! Batch::yearAllowed($year)) {
            return collect();
        }

        return Section::query()
            ->campusYears()
            ->with('batch:id,name,graduation_year')
            ->when($department, fn ($query) => $query->where('department', $department))
            ->when($year, function ($query) use ($year) {
                $query->where(function ($query) use ($year) {
                    $query->where('batch_year', $year)
                        ->orWhereHas('batch', fn ($batch) => $batch->where('graduation_year', $year));
                });
            })
            ->orderBy('name')
            ->get()
            ->filter(function (Section $section) use ($course) {
                $name = trim((string) $section->name);

                return $name !== ''
                    && strcasecmp($name, 'No Section') !== 0
                    && ($course === null || $this->sameCourse($section->course, $course));
            })
            ->map(fn (Section $section) => [
                'id' => $section->id,
                'name' => $section->name,
                'course' => $section->course,
                'department' => $section->department,
                'batch_year' => $section->batch?->graduation_year ?? $section->batch_year,
                'batch_id' => $section->batch_id,
            ])
            ->values();
    }

    // Discovery: Sectionmates 
    public function getSectionmates(User $viewer): Collection
    {
        $sectionId = $viewer->studentRecord?->section_id ?? $viewer->section_id;

        if (! $sectionId) {
            return collect();
        }

        return $this->registeredAccounts()
            ->filter(fn (array $person) => (int) ($person['section_id'] ?? 0) === (int) $sectionId)
            ->sortBy([
                ['last_name', 'asc'],
                ['first_name', 'asc'],
            ])
            ->values();
    }

    // Discovery: Whole School 

    public function getWholeSchool(User $viewer, array $filters = [], int $perPage = 40): LengthAwarePaginator
    {
        $people = $this->filterRegistered($this->registeredAccounts(), $filters)
            ->sortBy([
                ['last_name', 'asc'],
                ['first_name', 'asc'],
            ])
            ->values();

        return $this->paginateRegistered($people, $perPage);
    }

    // Discovery: Cross-Program 

    public function getCrossProgram(User $viewer, array $filters = [], int $perPage = 40): LengthAwarePaginator
    {
        $people = $this->crossProgramAccounts($viewer, $filters)
            ->sortBy([
                ['course', 'asc'],
                ['graduation_year', 'desc'],
                ['last_name', 'asc'],
                ['first_name', 'asc'],
            ])
            ->values();

        return $this->paginateRegistered($people, $perPage);
    }

    // Discovery: Cross-Program Stats 

    public function getCrossProgramStats(User $viewer, array $filters = []): array
    {
        return $this->summarizeRegistered($this->crossProgramAccounts($viewer, $filters));
    }

    public function discoveryStats(array $filters = []): array
    {
        return $this->summarizeRegistered(
            $this->filterRegistered($this->registeredAccounts(), $filters)
        );
    }

    // Discovery: By Department 

    public function getByDepartment(User $viewer, string $department): Collection
    {
        return $this->registeredAccounts()
            ->filter(fn (array $person) => strcasecmp((string) $person['department'], $department) === 0)
            ->sortBy([
                ['course', 'asc'],
                ['name', 'asc'],
            ])
            ->groupBy(fn (array $person) => $person['course'] ?: 'Unassigned course');
    }

    // Batch Helpers 
    public function getBatchesByDepartment(): Collection
    {
        $people = $this->registeredAccounts();
        $batches = Batch::with([
            'sections:id,batch_id,name,course,department,batch_year',
        ])
            ->campusYears()
            ->orderBy('graduation_year', 'desc')
            ->get();

        $grouped = collect();

        foreach ($batches as $batch) {
            $departments = $batch->sections
                ->pluck('department')
                ->filter(fn ($department) => is_string($department) && trim($department) !== '')
                ->unique()
                ->values();

            if ($departments->isEmpty()) {
                $departments = collect(['Unassigned']);
            }

            foreach ($departments as $department) {
                $sections = $batch->sections
                    ->filter(fn ($section) => (string) $section->department === (string) $department)
                    ->values();

                $count = $people->filter(function (array $person) use ($batch, $department) {
                    return (int) ($person['graduation_year'] ?? 0) === (int) $batch->graduation_year
                        && strcasecmp((string) $person['department'], (string) $department) === 0;
                })->count();

                $grouped->push([
                    'id' => $batch->id,
                    'name' => $batch->name,
                    'course' => $batch->course,
                    'course_code' => $batch->course_code,
                    'graduation_year' => $batch->graduation_year,
                    'department' => $department,
                    'students_count' => $count,
                    'sections' => $sections->map(fn ($section) => [
                        'id' => $section->id,
                        'batch_id' => $section->batch_id,
                        'name' => $section->name,
                        'course' => $section->course,
                        'department' => $section->department,
                        'batch_year' => $section->batch_year,
                        'students_count' => $people->filter(function (array $person) use ($batch, $department, $section) {
                        return (int) ($person['graduation_year'] ?? 0) === (int) $batch->graduation_year
                            && strcasecmp((string) $person['department'], (string) $department) === 0
                            && $this->sameCourse($person['course'] ?? null, $section->course);
                    })->count(),
                    'students' => $people
                            ->filter(fn (array $person) => (int) ($person['section_id'] ?? 0) === (int) $section->id)
                            ->values()
                            ->all(),
                    ])->values()->all(),
                ]);
            }
        }

        return $grouped
            ->sortBy(fn (array $batch) => $this->departmentSortIndex($batch['department']))
            ->groupBy('department');
    }

    /**
     * Registered student and alumni accounts, using the same population as the admin dashboard.
     * Department comes from the assigned section, then from the account or linked student course.
     */
    public function registeredAccounts(): Collection
    {
        $rows = DB::table('users')
            ->leftJoin('students', 'users.student_record_id', '=', 'students.id')
            ->leftJoin('sections as student_sections', 'students.section_id', '=', 'student_sections.id')
            ->leftJoin('sections as user_sections', 'users.section_id', '=', 'user_sections.id')
            ->whereIn('users.role', [User::ROLE_STUDENT, User::ROLE_ALUMNI])
            ->whereNull('users.deleted_at')
            ->select([
                'users.id',
                'users.first_name',
                'users.last_name',
                'users.name',
                'users.role',
                'users.is_alumni',
                'users.course as user_course',
                'users.graduation_year as user_year',
                'users.profile_picture',
                'users.avatar',
                'users.student_id',
                'users.section_id as user_section_id',
                'students.id as student_record_id',
                'students.course as student_course',
                'students.graduation_year as student_year',
                'students.photo',
                'students.student_no',
                'students.section_id as student_section_id',
                'student_sections.name as student_section_name',
                'student_sections.department as student_section_department',
                'student_sections.course as student_section_course',
                'user_sections.name as user_section_name',
                'user_sections.department as user_section_department',
                'user_sections.course as user_section_course',
            ])
            ->get();

        return $rows->map(function ($row) {
            $course = $this->firstFilled($row->user_course, $row->student_course, $row->student_section_course, $row->user_section_course);
            $sectionDepartment = $this->knownDepartment($row->student_section_department)
                ?? $this->knownDepartment($row->user_section_department);
            $department = $sectionDepartment ?? $this->departmentForCourse($course) ?? 'Unassigned';
            $graduationYear = $row->user_year ?: $row->student_year;
            $year = (int) $graduationYear;
            $isAlumni = (bool) $row->is_alumni
                || $row->role === User::ROLE_ALUMNI
                || ($year > 0 && $year <= (int) now()->year);
            $firstName = trim((string) $row->first_name);
            $lastName = trim((string) $row->last_name);
            $name = trim($firstName.' '.$lastName);
            if ($name === '') {
                $name = trim((string) $row->name);
            }
            if ($firstName === '' && $lastName === '' && $name !== '') {
                $parts = preg_split('/\s+/', $name, 2) ?: [];
                $firstName = $parts[0] ?? $name;
                $lastName = $parts[1] ?? '';
            }

            return [
                'id' => (int) $row->id,
                'account_user_id' => (int) $row->id,
                'user_id' => (int) $row->id,
                'student_record_id' => $row->student_record_id ? (int) $row->student_record_id : null,
                'name' => $name !== '' ? $name : 'Student',
                'first_name' => $firstName !== '' ? $firstName : null,
                'last_name' => $lastName !== '' ? $lastName : null,
                'course' => $course,
                'department' => $department,
                'graduation_year' => $graduationYear,
                'role' => $row->role,
                'is_alumni' => $isAlumni,
                'academic_status' => $isAlumni ? 'Alumni' : 'Current Student',
                'section_id' => $row->student_section_id ?: $row->user_section_id,
                'section_name' => $row->student_section_name ?: $row->user_section_name,
                'student_no' => $row->student_no ?: $row->student_id,
                'student_id' => $row->student_id ?: $row->student_no,
                'profile_picture' => $row->profile_picture ?: $row->avatar ?: $row->photo,
            ];
        })->values();
    }

    public function directoryTotals(): array
    {
        $people = $this->registeredAccounts();
        $summary = $this->summarizeRegistered($people);

        return [
            'batches' => $this->visibleBatchCount(),
            // Section rows in the catalog, not the count of accounts that already have one assigned.
            'sections' => Section::query()->count(),
            'students' => $summary['total_students'],
            'departments' => $summary['departments'],
        ];
    }

    /**
     * Registered student and alumni accounts that match the current discovery filters.
     */
    public function filterRegistered(Collection $people, array $filters = []): Collection
    {
        $search = $this->normalizeFilter($filters['search'] ?? null);
        $course = $this->normalizeFilter($filters['course'] ?? null);
        $department = $this->normalizeFilter($filters['department'] ?? null);
        $year = is_numeric($filters['year'] ?? null) ? (int) $filters['year'] : null;
        if ($year !== null && $year <= 0) {
            $year = null;
        }
        $sectionId = ! empty($filters['section_id']) ? (int) $filters['section_id'] : null;

        if ($year !== null && ! Batch::yearAllowed($year)) {
            return collect();
        }

        return $people
            ->when($search, function (Collection $people) use ($search) {
                $needle = strtolower($search);

                return $people->filter(function (array $person) use ($needle) {
                    $haystack = strtolower(implode(' ', array_filter([
                        $person['name'] ?? null,
                        $person['first_name'] ?? null,
                        $person['last_name'] ?? null,
                        $person['student_no'] ?? null,
                        $person['course'] ?? null,
                        $person['section_name'] ?? null,
                    ])));

                    return str_contains($haystack, $needle);
                });
            })
            ->when($course, fn (Collection $people) => $people->filter(
                fn (array $person) => $this->sameCourse($person['course'] ?? null, $course)
            ))
            ->when($year, fn (Collection $people) => $people->filter(
                fn (array $person) => (int) ($person['graduation_year'] ?? 0) === $year
            ))
            ->when($sectionId, fn (Collection $people) => $people->filter(
                fn (array $person) => (int) ($person['section_id'] ?? 0) === $sectionId
            ))
            ->when($department, fn (Collection $people) => $people->filter(
                fn (array $person) => strcasecmp((string) ($person['department'] ?? ''), $department) === 0
            ))
            ->values();
    }

    public function summarizeRegistered(Collection $people): array
    {
        $departments = $people
            ->countBy('department')
            ->map(fn ($count, $department) => [
                'department' => (string) $department,
                'students_count' => (int) $count,
            ])
            ->sortBy(fn (array $row) => $this->departmentSortIndex($row['department']))
            ->values();

        $programs = $people
            ->countBy(fn (array $person) => trim((string) ($person['course'] ?? '')) ?: 'Unassigned')
            ->map(fn ($count, $course) => [
                'course' => (string) $course,
                'students_count' => (int) $count,
            ])
            ->sortBy('course')
            ->values();

        return [
            'total_students' => $people->count(),
            'total_sections' => $people
                ->pluck('section_id')
                ->map(fn ($id) => (int) $id)
                ->filter(fn (int $id) => $id > 0)
                ->unique()
                ->count(),
            'total_programs' => $programs->count(),
            'programs' => $programs->all(),
            'departments' => $departments->all(),
        ];
    }

    private function crossProgramAccounts(User $viewer, array $filters = []): Collection
    {
        $viewerCourse = $viewer->studentRecord?->course ?? $viewer->course;
        $people = $this->registeredAccounts();

        if ($viewerCourse) {
            $people = $people->reject(
                fn (array $person) => $this->sameCourse($person['course'] ?? null, $viewerCourse)
            );
        }

        return $this->filterRegistered($people, $filters);
    }

    private function paginateRegistered(Collection $people, int $perPage): LengthAwarePaginator
    {
        $page = max(1, (int) request()->query('page', 1));
        $total = $people->count();
        $items = $people->forPage($page, $perPage)->values();

        return new Paginator(
            $items,
            $total,
            $perPage,
            $page,
            ['path' => request()->url(), 'query' => request()->query()]
        );
    }

    /**
     * One record per batch and school, matching the cards on the public batches page.
     */
    public function visibleBatchCount(): int
    {
        return (int) Batch::query()
            ->campusYears()
            ->with('sections:id,batch_id,department')
            ->get()
            ->sum(function (Batch $batch) {
                $departments = $batch->sections
                    ->pluck('department')
                    ->map(fn ($department) => trim((string) $department))
                    ->filter()
                    ->unique();

                return max(1, $departments->count());
            });
    }

    public function departmentStats(): array
    {
        return $this->departmentStatsFrom($this->registeredAccounts());
    }

    private function departmentStatsFrom(Collection $people): array
    {
        $counts = $people->countBy('department');

        $departments = DB::table('sections')
            ->whereNotNull('department')
            ->where('department', '!=', '')
            ->distinct()
            ->pluck('department')
            ->merge($counts->keys())
            ->map(fn ($department) => trim((string) $department))
            ->filter()
            ->unique()
            ->sortBy(fn (string $department) => $this->departmentSortIndex($department))
            ->values()
            ->map(fn (string $department) => [
                'department' => $department,
                'students_count' => (int) ($counts[$department] ?? 0),
            ])
            ->values();

        return [
            'total_students' => $people->count(),
            'departments' => $departments->all(),
        ];
    }

    private function sameCourse(?string $left, ?string $right): bool
    {
        $left = trim((string) $left);
        $right = trim((string) $right);
        if ($left === '' || $right === '') {
            return false;
        }

        $variants = array_map('strtolower', $this->courseVariants($left));

        return in_array(strtolower($right), $variants, true)
            || in_array(strtolower($left), array_map('strtolower', $this->courseVariants($right)), true);
    }

    private function departmentForCourse(?string $course): ?string
    {
        if ($course === null || trim($course) === '') {
            return null;
        }

        $department = self::getDepartment($course);

        return $department === 'General' ? null : $department;
    }

    private function knownDepartment(mixed $department): ?string
    {
        $department = trim((string) $department);

        if ($department === '') {
            return null;
        }

        foreach (self::DEPARTMENT_ORDER as $known) {
            if (strcasecmp($known, $department) === 0) {
                return $known;
            }
        }

        return $department;
    }

    private function firstFilled(mixed ...$values): ?string
    {
        foreach ($values as $value) {
            $value = trim((string) $value);
            if ($value !== '') {
                return $value;
            }
        }

        return null;
    }

    private function departmentSortIndex(string $department): int
    {
        $index = array_search($department, self::DEPARTMENT_ORDER, true);

        return $index === false ? count(self::DEPARTMENT_ORDER) : $index;
    }

    /**
     * Create missing batch records for registered accounts in the campus year range.
     */
    public function generateBatches(): int
    {
        $created = 0;
        $groups = User::query()
            ->whereIn('role', [User::ROLE_STUDENT, User::ROLE_ALUMNI])
            ->whereNull('deleted_at')
            ->whereNotNull('course')
            ->where('course', '!=', '')
            ->whereBetween('graduation_year', [Batch::MIN_YEAR, Batch::maxYear()])
            ->select('course', 'graduation_year')
            ->distinct()
            ->get();

        foreach ($groups as $group) {
            $year = (int) $group->graduation_year;
            if (! Batch::yearAllowed($year)) {
                continue;
            }

            $exists = Batch::query()
                ->where('course', $group->course)
                ->where('graduation_year', $year)
                ->exists();

            if ($exists) {
                continue;
            }

            Batch::create([
                'name' => self::getCourseCode((string) $group->course).' Batch '.$year,
                'course' => $group->course,
                'course_code' => self::getCourseCode((string) $group->course),
                'graduation_year' => $year,
                'department' => self::getDepartment((string) $group->course),
            ]);
            $created++;
        }

        return $created;
    }

    public function assignUsersToBatches(): int
    {
        $updated = 0;
        $users = User::query()
            ->whereIn('role', [User::ROLE_STUDENT, User::ROLE_ALUMNI])
            ->whereNull('deleted_at')
            ->whereBetween('graduation_year', [Batch::MIN_YEAR, Batch::maxYear()])
            ->whereNotNull('course')
            ->get();

        foreach ($users as $user) {
            $year = (int) $user->graduation_year;
            if (! Batch::yearAllowed($year)) {
                continue;
            }

            $batchId = Batch::query()
                ->campusYears()
                ->where('graduation_year', $year)
                ->where(function ($query) use ($user) {
                    $query->where('course', $user->course)->orWhereNull('course');
                })
                ->value('id');

            if ($batchId && (int) $user->batch_id !== (int) $batchId) {
                $user->forceFill(['batch_id' => $batchId])->save();
                $updated++;
            }
        }

        return $updated;
    }

    public function generateSections(int $perSection = 40): int
    {
        $perSection = max(1, $perSection);
        $created = 0;

        $batches = Batch::query()->campusYears()->get();

        foreach ($batches as $batch) {
            $students = Student::query()
                ->where(function ($query) use ($batch) {
                    $query->where('batch_id', $batch->id)
                        ->orWhere(function ($query) use ($batch) {
                            $query->where('graduation_year', $batch->graduation_year)
                                ->where('course', $batch->course);
                        });
                })
                ->whereNull('section_id')
                ->orderBy('last_name')
                ->orderBy('first_name')
                ->get();

            foreach ($students->chunk($perSection) as $index => $chunk) {
                $section = Section::create([
                    'name' => trim(($batch->course_code ?: 'Section').' '.($index + 1)),
                    'course' => $batch->course,
                    'department' => $batch->department,
                    'batch_year' => $batch->graduation_year,
                    'batch_id' => $batch->id,
                ]);
                Student::query()->whereIn('id', $chunk->pluck('id'))->update([
                    'section_id' => $section->id,
                    'batch_id' => $batch->id,
                ]);
                $created++;
            }
        }

        return $created;
    }

    public function getBatchStats(Batch $batch): array
    {
        $sectionIds = $batch->sections()->pluck('id')->map(fn ($id) => (int) $id);
        $people = $this->registeredAccounts()
            ->filter(fn (array $person) => $sectionIds->contains((int) ($person['section_id'] ?? 0)))
            ->values();

        return [
            'total_students' => $people->count(),
            'total_sections' => $people
                ->pluck('section_id')
                ->map(fn ($id) => (int) $id)
                ->filter(fn (int $id) => $sectionIds->contains($id))
                ->unique()
                ->count(),
            'sections' => $batch->sections()->get(['id', 'name'])->map(fn ($section) => [
                'id' => $section->id,
                'name' => $section->name,
                'students_count' => $people->filter(
                    fn (array $person) => (int) ($person['section_id'] ?? 0) === (int) $section->id
                )->count(),
            ])->values(),
            'by_course' => $people->countBy(fn (array $person) => $person['course'] ?: 'Unassigned'),
        ];
    }

    public function getBatchStudents(Batch $batch, bool $isPremium): Collection
    {
        return $this->baseQuery($isPremium)
            ->where('batch_id', $batch->id)
            ->orderBy('last_name')
            ->orderBy('first_name')
            ->get()
            ->map(fn ($s) => $this->formatStudent($s));
    }

    // Static Helpers

    public static function getDepartment(string $course): string
    {
        foreach (self::COURSE_ALIASES as $canonical => $aliases) {
            if (in_array(strtolower($course), array_map('strtolower', $aliases), true)) {
                return self::DEPARTMENT_MAP[$canonical] ?? 'General';
            }
        }

        return self::DEPARTMENT_MAP[$course] ?? 'General';
    }

    public static function getCourseCode(string $course): string
    {
        return self::COURSE_CODE_MAP[$course] ?? strtoupper(substr($course, 0, 4));
    }

    public static function getAllDepartments(): array
    {
        return collect(self::DEPARTMENT_MAP)->unique()->values()->sort()->values()->toArray();
    }

    public static function getAllCourses(): array
    {
        return array_keys(self::DEPARTMENT_MAP);
    }

    // Formatter

    private function formatStudent(Student $student): array
    {
        $data = $student->toArray();

        $data['name']            = trim("{$student->first_name} {$student->last_name}");
        $data['student_record_id'] = $student->id;
        $data['account_user_id'] = $student->userAccount?->id;
        $data['user_id']         = $student->userAccount?->id;
        $data['profile_picture'] = $student->photo_url ?? $student->photo;
        $data['department']      = $student->batch?->department
            ?: self::getDepartment((string) $student->course);
        $data['section_name']    = $student->section?->name;
        $data['batch_year']      = $student->batch?->graduation_year ?? $student->graduation_year;

        return $data;
    }
}
