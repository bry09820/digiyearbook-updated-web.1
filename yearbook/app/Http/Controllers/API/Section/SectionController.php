<?php

namespace App\Http\Controllers\API\Section;

use App\Http\Controllers\Controller;
use App\Models\Section;
use App\Services\Student\BatchService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SectionController extends Controller
{
    public function __construct(private readonly BatchService $batches) {}

    // GET /api/sections 
    // All sections with the count of active registered accounts.

    public function index(Request $request): JsonResponse
    {
        $people = $this->batches->registeredAccounts();
        $counts = $people->countBy(fn (array $person) => (int) ($person['section_id'] ?? 0));

        $query = Section::query()
            ->campusYears()
            ->with('batch:id,name,graduation_year,department');

        if ($request->filled('batch_id')) {
            $query->where('batch_id', $request->batch_id);
        }

        if ($request->filled('course')) {
            $courses = BatchService::courseVariantsFor($request->course);

            if ($courses) {
                $query->whereIn('course', $courses);
            }
        }

        $sections = $query->orderBy('name')->get()->map(function (Section $section) use ($counts, $people) {
            $registered = (int) ($counts[(int) $section->id] ?? 0);
            $preview = $people
                ->filter(fn (array $person) => (int) ($person['section_id'] ?? 0) === (int) $section->id)
                ->take(5)
                ->map(fn (array $person) => [
                    'id' => $person['student_record_id'] ?? $person['id'],
                    'first_name' => $person['first_name'],
                    'last_name' => $person['last_name'],
                    'photo' => $person['profile_picture'],
                    'section_id' => $person['section_id'],
                ])
                ->values();

            $section->setAttribute('students_count', $registered);
            $section->setAttribute('registered_count', $registered);
            $section->setRelation('students', $preview);

            return $section;
        });

        return response()->json($sections);
    }

    // GET /api/sections/{id} 
    // Single section + paginated students espects premium & visibility rules.

    public function show(Request $request, int $id): JsonResponse
    {
        $viewer    = $request->user();
        $isPremium = $viewer->is_premium;

        $section = Section::with('batch:id,name,graduation_year,department')
            ->findOrFail($id);

        $people = $this->batches->registeredAccounts()
            ->filter(fn (array $person) => (int) ($person['section_id'] ?? 0) === $id)
            ->sortBy([
                ['last_name', 'asc'],
                ['first_name', 'asc'],
            ])
            ->values()
            ->map(fn (array $person) => [
                'id' => $person['student_record_id'] ?? $person['id'],
                'user_id' => $person['id'],
                'student_record_id' => $person['student_record_id'],
                'first_name' => $person['first_name'],
                'last_name' => $person['last_name'],
                'photo' => $person['profile_picture'],
                'student_no' => $person['student_no'],
                'course' => $person['course'],
                'graduation_year' => $person['graduation_year'],
                'section_id' => $person['section_id'],
            ]);

        $page = max(1, (int) $request->query('page', 1));
        $perPage = 30;
        $students = new \Illuminate\Pagination\LengthAwarePaginator(
            $people->forPage($page, $perPage)->values(),
            $people->count(),
            $perPage,
            $page,
            ['path' => $request->url(), 'query' => $request->query()]
        );

        return response()->json([
            'section'    => $section,
            'students'   => $students,
            'is_premium' => $isPremium,
            'total'      => $people->count(),
            'visible'    => $people->count(),
        ]);
    }
}
