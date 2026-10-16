<?php

namespace App\Http\Controllers\API\Admin;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Concerns\AuditsAdminActions;
use App\Models\AuditLog;
use App\Models\Batch;
use App\Models\Section;
use App\Services\Student\BatchService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class BatchSectionController extends Controller
{
    use AuditsAdminActions;

    public function __construct(private readonly BatchService $batches) {}

    // GET /api/admin/academics/directory
    public function directory(): JsonResponse
    {
        $grouped = $this->batches->getBatchesByDepartment(false);
        $stats = $this->batches->departmentStats();
        $totals = $this->batches->directoryTotals();

        return response()->json([
            'data' => $grouped,
            'departments' => collect($stats['departments'])->pluck('department')->values(),
            'stats' => array_merge($stats, [
                'batches' => $totals['batches'],
                'sections' => $totals['sections'],
            ]),
            'totals' => $totals,
            'registered' => $this->batches->registeredAccounts()->values(),
        ]);
    }

    // GET /api/admin/academics/summary
    public function summary(): JsonResponse
    {
        return response()->json(['data' => $this->batches->directoryTotals()]);
    }

    // GET /api/admin/academics/students
    public function registeredStudents(Request $request): JsonResponse
    {
        $search = trim((string) $request->get('search', ''));
        $year = $request->filled('graduation_year') ? (int) $request->get('graduation_year') : null;
        if ($year !== null && ! Batch::yearAllowed($year)) {
            $year = -1;
        }
        $sectionId = $request->filled('section_id') ? (int) $request->get('section_id') : null;
        $department = trim((string) $request->get('department', ''));

        $people = $this->batches->registeredAccounts()
            ->when($year, fn (Collection $rows) => $rows->filter(
                fn (array $person) => (int) ($person['graduation_year'] ?? 0) === $year
            ))
            ->when($sectionId, fn (Collection $rows) => $rows->filter(
                fn (array $person) => (int) ($person['section_id'] ?? 0) === $sectionId
            ))
            ->when($department !== '', fn (Collection $rows) => $rows->filter(
                fn (array $person) => strcasecmp((string) $person['department'], $department) === 0
            ))
            ->when($search !== '', function (Collection $rows) use ($search) {
                $term = mb_strtolower($search);

                return $rows->filter(function (array $person) use ($term) {
                    $haystack = mb_strtolower(implode(' ', array_filter([
                        $person['name'] ?? null,
                        $person['first_name'] ?? null,
                        $person['last_name'] ?? null,
                        $person['course'] ?? null,
                        $person['department'] ?? null,
                        $person['section_name'] ?? null,
                        $person['student_no'] ?? null,
                    ])));

                    return str_contains($haystack, $term);
                });
            })
            ->values();

        $emails = DB::table('users')
            ->whereIn('id', $people->pluck('id'))
            ->pluck('email', 'id');

        $data = $people->map(function (array $person) use ($emails) {
            return [
                ...$person,
                'email' => $emails[$person['id']] ?? null,
                'photo_url' => $person['profile_picture'] ?? null,
            ];
        })->values();

        return response()->json([
            'data' => $data,
            'total' => $data->count(),
            'totals' => $this->batches->directoryTotals(),
        ]);
    }

    // GET /api/admin/batches
    public function batchIndex(Request $request): JsonResponse
    {
        $people = $this->batches->registeredAccounts();
        $query = Batch::query()->campusYears()->withCount('sections');

        if ($search = $request->get('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('name',          'like', "%{$search}%")
                  ->orWhere('course',      'like', "%{$search}%")
                  ->orWhere('course_code', 'like', "%{$search}%")
                  ->orWhere('department',  'like', "%{$search}%");
            });
        }

        if ($year = $request->get('graduation_year')) {
            $query->where('graduation_year', $year);
        }

        if ($dept = $request->get('department')) {
            $query->where('department', $dept);
        }

        $batches = $query
            ->orderByDesc('graduation_year')
            ->orderBy('name')
            ->get()
            ->each(function (Batch $batch) use ($people) {
                $batch->students_count = $this->batches->countRegisteredForBatch($people, $batch);
            });

        return response()->json([
            'data' => $batches,
            'totals' => $this->batches->directoryTotals(),
        ]);
    }

    // GET /api/admin/batches/{batch}
    public function batchShow(Batch $batch): JsonResponse
    {
        $people = $this->batches->registeredAccounts();
        $batch->load('sections');
        $batch->loadCount('sections');
        $batch->students_count = $this->batches->countRegisteredForBatch($people, $batch);

        return response()->json(['data' => $batch]);
    }

    // GET /api/admin/batches/{batch}/departments
    public function batchDepartments(Batch $batch): JsonResponse
    {
        $departments = Section::query()
            ->where('batch_id', $batch->id)
            ->whereNotNull('department')
            ->selectRaw('department, COUNT(*) as sections_count, SUM(
                (SELECT COUNT(*) FROM students WHERE students.section_id = sections.id)
            ) as students_count')
            ->groupBy('department')
            ->orderBy('department')
            ->get();

        return response()->json(['data' => $departments]);
    }

    // GET /api/admin/batches/{batch}/departments/{department}/courses
    public function batchDepartmentCourses(Batch $batch, string $department): JsonResponse
    {
        $courses = Section::query()
            ->where('batch_id', $batch->id)
            ->where('department', $department)
            ->whereNotNull('course')
            ->selectRaw('course, COUNT(*) as sections_count, SUM(
                (SELECT COUNT(*) FROM students WHERE students.section_id = sections.id)
            ) as students_count')
            ->groupBy('course')
            ->orderBy('course')
            ->get();

        return response()->json(['data' => $courses]);
    }

    // POST /api/admin/batches
    public function batchStore(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name'            => 'required|string|max:255',
            'course'          => 'nullable|string|max:255',
            'course_code'     => 'nullable|string|max:20',
            'graduation_year' => Batch::yearRules(),
            'department'      => 'nullable|string|max:255',
            'description'     => 'nullable|string|max:500',
        ], [
            'graduation_year.min' => 'Graduation year must be from '.Batch::MIN_YEAR.' through '.Batch::maxYear().'.',
            'graduation_year.max' => 'Graduation year must be from '.Batch::MIN_YEAR.' through '.Batch::maxYear().'.',
        ]);

        $validated['graduation_year'] = (int) $validated['graduation_year'];
        $validated['name'] = trim($validated['name']);

        $duplicate = Batch::query()
            ->where('graduation_year', $validated['graduation_year'])
            ->when(
                filled($validated['course'] ?? null),
                fn ($query) => $query->where('course', $validated['course']),
                fn ($query) => $query->whereNull('course')
            )
            ->exists();

        if ($duplicate) {
            return response()->json([
                'message' => 'A batch for '.$validated['graduation_year'].' already exists.',
                'errors' => [
                    'graduation_year' => ['A batch for '.$validated['graduation_year'].' already exists.'],
                ],
            ], 422);
        }

        $batch = Batch::create($validated);

        $this->audit(
            AuditLog::ACTION_BATCH_CREATED,
            "Created batch '{$batch->name}' ({$batch->graduation_year}) ID #{$batch->id}.",
            AuditLog::STATUS_SUCCESS,
            null,
            $batch->id,
            "batch#{$batch->id}",
        );

        return response()->json([
            'message' => 'Batch created successfully.',
            'data'    => $batch,
        ], 201);
    }

    // PUT /api/admin/batches/{batch}
    public function batchUpdate(Request $request, Batch $batch): JsonResponse
    {
        $validated = $request->validate([
            'name'            => 'sometimes|string|max:255',
            'course'          => 'nullable|string|max:255',
            'course_code'     => 'nullable|string|max:20',
            'graduation_year' => 'sometimes|'.Batch::yearRules(),
            'department'      => 'nullable|string|max:255',
            'description'     => 'nullable|string|max:500',
        ]);

        $batch->update($validated);

        $this->audit(
            AuditLog::ACTION_BATCH_UPDATED,
            "Updated batch '{$batch->name}' ID #{$batch->id}. Fields: " . implode(', ', array_keys($validated)),
            AuditLog::STATUS_SUCCESS,
            null,
            $batch->id,
            "batch#{$batch->id}",
        );

        return response()->json([
            'message' => 'Batch updated successfully.',
            'data'    => $batch->fresh(),
        ]);
    }

    // DELETE /api/admin/batches/{batch}
    public function batchDestroy(Batch $batch): JsonResponse
    {
        $snapshot = "{$batch->name} ({$batch->graduation_year}) ID #{$batch->id}";

        $batch->delete();

        $this->audit(
            AuditLog::ACTION_BATCH_DELETED,
            "Moved batch '{$snapshot}' to trash.",
            AuditLog::STATUS_WARNING,
            null,
            $batch->id,
            "batch#{$batch->id}",
        );

        return response()->json(['message' => 'Batch moved to trash.']);
    }

    // SECTIONS
    // GET /api/admin/sections
    public function sectionIndex(Request $request): JsonResponse
    {
        $people = $this->batches->registeredAccounts();
        $query = Section::query()
            ->campusYears()
            ->with(['batch:id,name,graduation_year', 'adviser:id,first_name,last_name']);

        if ($search = $request->get('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('name',        'like', "%{$search}%")
                  ->orWhere('course',    'like', "%{$search}%")
                  ->orWhere('department','like', "%{$search}%");
            });
        }

        if ($batchId = $request->get('batch_id')) {
            $query->where('batch_id', $batchId);
        }

        if ($department = $request->get('department')) {
            $query->where('department', $department);
        }

        if ($course = $request->get('course')) {
            $query->where('course', $course);
        }

        if ($year = $request->get('batch_year')) {
            $query->where('batch_year', $year);
        }

        $sections = $query
            ->orderBy('department')
            ->orderBy('course')
            ->orderBy('name')
            ->get()
            ->each(function (Section $section) use ($people) {
                $section->students_count = $people->filter(
                    fn (array $person) => (int) ($person['section_id'] ?? 0) === (int) $section->id
                )->count();
            });

        return response()->json([
            'data' => $sections,
            'totals' => $this->batches->directoryTotals(),
        ]);
    }

    // GET /api/admin/sections/{section}
    public function sectionShow(Section $section): JsonResponse
    {
        $section->load(['batch', 'adviser', 'students']);
        $section->loadCount('students');

        return response()->json(['data' => $section]);
    }

    // POST /api/admin/sections
    public function sectionStore(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name'        => 'required|string|max:255',
            'course'      => 'nullable|string|max:255',
            'department'  => 'nullable|string|max:255',
            'batch_year'  => Batch::yearRules(false),
            'batch_id'    => 'nullable|exists:batches,id',
            'adviser_id'  => 'nullable|exists:faculty,id',
            'description' => 'nullable|string|max:500',
        ]);

        $section = Section::create($validated);

        $this->audit(
            AuditLog::ACTION_SECTION_CREATED,
            "Created section '{$section->name}' (batch ID #{$section->batch_id}) ID #{$section->id}.",
            AuditLog::STATUS_SUCCESS,
            null,
            $section->id,
            "section#{$section->id}",
        );

        return response()->json([
            'message' => 'Section created successfully.',
            'data'    => $section,
        ], 201);
    }

    // PUT /api/admin/sections/{section}
    public function sectionUpdate(Request $request, Section $section): JsonResponse
    {
        $validated = $request->validate([
            'name'        => 'sometimes|string|max:255',
            'course'      => 'nullable|string|max:255',
            'department'  => 'nullable|string|max:255',
            'batch_year'  => 'sometimes|'.Batch::yearRules(false),
            'batch_id'    => 'nullable|exists:batches,id',
            'adviser_id'  => 'nullable|exists:faculty,id',
            'description' => 'nullable|string|max:500',
        ]);

        $section->update($validated);

        $this->audit(
            AuditLog::ACTION_SECTION_UPDATED,
            "Updated section '{$section->name}' ID #{$section->id}. Fields: " . implode(', ', array_keys($validated)),
            AuditLog::STATUS_SUCCESS,
            null,
            $section->id,
            "section#{$section->id}",
        );

        return response()->json([
            'message' => 'Section updated successfully.',
            'data'    => $section->fresh(['batch', 'adviser']),
        ]);
    }

    // DELETE /api/admin/sections/{section}
    public function sectionDestroy(Section $section): JsonResponse
    {
        $snapshot = "{$section->name} ID #{$section->id}";

        $section->delete();

        $this->audit(
            AuditLog::ACTION_SECTION_DELETED,
            "Moved section '{$snapshot}' to trash.",
            AuditLog::STATUS_WARNING,
            null,
            $section->id,
            "section#{$section->id}",
        );

        return response()->json(['message' => 'Section moved to trash.']);
    }
}