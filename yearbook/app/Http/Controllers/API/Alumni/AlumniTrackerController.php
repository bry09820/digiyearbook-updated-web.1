<?php

declare(strict_types=1);

namespace App\Http\Controllers\API\Alumni;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\Yearbook\PageResolverService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;

class AlumniTrackerController extends Controller
{
    public function __construct(
        private PageResolverService $pageResolver
    ) {}

    // List 

    public function index(Request $request): JsonResponse
    {
        User::promoteGraduatedAccounts();

        $query = User::query()
            ->with(['section', 'batchRecord', 'careerProfile', 'studentRecord.section', 'studentRecord.batch'])
            ->alumni()
            ->visibleTo($request->user());

        if ($q = $request->string('q')->trim()->value()) {
            $query->where('name', 'like', "%{$q}%");
        }

        if ($batchId = $request->integer('batch_id', 0)) {
            $query->where(function ($batchQuery) use ($batchId) {
                $batchQuery->where('batch_id', $batchId)
                    ->orWhereHas('studentRecord', fn ($student) => $student->where('batch_id', $batchId));
            });
        }

        if ($field = $request->string('field')->trim()->value()) {
            $query->whereHas('careerProfile', fn ($c) => $c->where('field', $field));
        }

        $alumni = $query->orderBy('name')->paginate(24);

        return response()->json([
            'success'      => true,
            'data'         => $alumni->map(fn (User $u) => $this->formatAlumni($u)),
            'total'        => $alumni->total(),
            'current_page' => $alumni->currentPage(),
            'last_page'    => $alumni->lastPage(),
        ]);
    }

    // Single

    public function show(int $id): JsonResponse
    {
        $user = User::with(['section', 'batchRecord', 'careerProfile', 'studentRecord.section', 'studentRecord.batch'])
            ->alumni()
            ->findOrFail($id);

        if (! $user->canBeViewedBy(Auth::user())) {
            return response()->json($user->visibilityDenialPayload(), 403);
        }

        return response()->json([
            'success' => true,
            'data'    => $this->formatAlumni($user, detailed: true),
        ]);
    }

    // Own profile 

    public function me(): JsonResponse
    {
        $user = User::with(['section', 'batchRecord', 'careerProfile', 'studentRecord.section', 'studentRecord.batch'])
            ->findOrFail(Auth::id());

        return response()->json([
            'success' => true,
            'data'    => $this->formatAlumni($user, detailed: true),
        ]);
    }

    // Update career 
    public function updateCareer(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'job_title' => ['nullable', 'string', 'max:120'],
            'company'   => ['nullable', 'string', 'max:120'],
            'location'  => ['nullable', 'string', 'max:120'],
            'field'     => ['nullable', 'string', 'max:80'],
            'bio'       => ['nullable', 'string', 'max:400'],
        ]);

        /** @var User $user */
        $user = Auth::user();

        if (! $user?->isAlumni()) {
            throw ValidationException::withMessages([
                'role' => 'Career profiles are available to alumni. A graduation year in the current year or earlier marks an account as alumni.',
            ]);
        }

        $user->careerProfile()->updateOrCreate(
            ['user_id' => $user->id],
            $validated
        );

        return response()->json([
            'success' => true,
            'message' => 'Career profile updated.',
        ]);
    }

    // By batch

    public function byBatch(int $batchId): JsonResponse
    {
        $users = User::with(['section', 'batchRecord', 'careerProfile', 'studentRecord.section', 'studentRecord.batch'])
            ->alumni()
            ->visibleTo(Auth::user())
            ->where(function ($query) use ($batchId) {
                $query->where('batch_id', $batchId)
                    ->orWhereHas('studentRecord', fn ($student) => $student->where('batch_id', $batchId));
            })
            ->orderBy('name')
            ->get();

        return response()->json([
            'success' => true,
            'data'    => $users->map(fn (User $u) => $this->formatAlumni($u)),
        ]);
    }

    // Search 

    public function search(Request $request): JsonResponse
    {
        $q = $request->string('q')->trim()->value();

        if (strlen($q) < 2) {
            return response()->json(['success' => true, 'data' => []]);
        }

        $results = User::with(['section', 'batchRecord', 'careerProfile', 'studentRecord.section', 'studentRecord.batch'])
            ->alumni()
            ->visibleTo($request->user())
            ->where('name', 'like', "%{$q}%")
            ->orderBy('name')
            ->limit(10)
            ->get()
            ->map(fn (User $u) => $this->formatAlumni($u));

        return response()->json(['success' => true, 'data' => $results]);
    }

    // DEEP LINK: Alumni Tracker Yearbook

    public function yearbookEntry(int $id): JsonResponse
    {
        $user  = User::with('batchRecord')->findOrFail($id);
        $batch = $user->batchRecord;

        if (!$batch) {
            return response()->json([
                'success' => false,
                'message' => 'No yearbook entry found for this alumni.',
            ], 404);
        }

        $pageIndex = $this->pageResolver->getPageIndex($user->id, $batch->id);

        return response()->json([
            'success' => true,
            'data'    => [
                'batch_id'   => $batch->id,
                'batch_year' => $batch->year,
                'page_index' => $pageIndex,
                'user_id'    => $user->id,
                'name'       => $user->name,
                // Frontend builds: /yearbook/{batch_id}/view?page={page_index}
            ],
        ]);
    }

    // DEEP LINK: Yearbook Alumni Tracker

    public function fromYearbookPage(Request $request): JsonResponse
    {
        $request->validate([
            'batch_id'   => ['required', 'integer'],
            'page_index' => ['required', 'integer', 'min:0'],
        ]);

        $batchId   = (int) $request->input('batch_id');
        $pageIndex = (int) $request->input('page_index');

        $user = $this->pageResolver->getUserAtPage($batchId, $pageIndex);

        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'No alumni linked to this page.',
            ], 404);
        }

        $career = $user->careerProfile;

        return response()->json([
            'success' => true,
            'data'    => [
                'alumni_id'   => $user->id,
                'name'        => $user->name,
                'batch_year'  => $user->batchRecord?->year,
                'career'      => $career ? [
                    'job_title' => $career->job_title,
                    'company'   => $career->company,
                    'location'  => $career->location,
                    'field'     => $career->field,
                ] : null,
                'tracker_url' => "/alumni-tracker?batch_id={$batchId}&highlight={$user->id}",
            ],
        ]);
    }

    // Helpers 

    private function formatAlumni(User $user, bool $detailed = false): array
    {
        $career  = $user->careerProfile;
        $batch   = $user->batchRecord ?? $user->studentRecord?->batch;
        $section = $user->section ?? $user->studentRecord?->section;

        return [
            'id'              => $user->id,
            'name'            => $user->name,
            'email'           => $detailed ? $user->email : null,
            'profile_picture' => $user->profile_picture ?? $user->avatar,
            'batch_year'      => $batch?->year,
            'batch_id'        => $batch?->id,
            'section'         => $section?->name,
            'course'          => $user->course,
            'graduation_year' => $user->graduation_year,
            'role'            => $user->role,
            'is_alumni'       => $user->isAlumni(),
            'academic_status' => $user->academicStatusLabel(),
            'is_verified'     => (bool) $user->email_verified_at,
            'career'          => $career ? [
                'job_title' => $career->job_title,
                'company'   => $career->company,
                'location'  => $career->location,
                'field'     => $career->field,
                'bio'       => $detailed ? $career->bio : null,
            ] : null,
        ];
    }
}
