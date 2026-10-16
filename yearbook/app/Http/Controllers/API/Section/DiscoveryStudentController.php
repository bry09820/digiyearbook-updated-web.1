<?php

namespace App\Http\Controllers\API\Section;

use App\Http\Controllers\Controller;
use App\Models\Student;
use App\Models\User;
use App\Support\PlatformSettings;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DiscoveryStudentController extends Controller
{
    public function show(Request $request, int $id): JsonResponse
    {
        [$student, $account] = $this->resolveSubject($request, $id);

        if (! $student && ! $account) {
            abort(404);
        }

        $viewer = $request->user();

        if ($account && ! $account->canBeViewedBy($viewer)) {
            return response()->json($account->visibilityDenialPayload(), 403);
        }

        $isSubscribed = ! PlatformSettings::bool('enable_premium_subscription')
            || \App\Support\SubscriptionAccess::isSubscribed($viewer);

        $data = $student
            ? $this->recordPayload($student, $account, $isSubscribed)
            : $this->accountPayload($account, $isSubscribed);

        return response()->json(['data' => $data]);
    }

    /**
     * users.id and students.id are separate sequences and often share the same number.
     * `as=user` is an account. `as=record` is a yearbook row.
     * When the parameter is omitted and both rows exist but are not linked, the account wins
     * because Directory and Discovery lists identify registered students by users.id.
     *
     * @return array{0: ?Student, 1: ?User}
     */
    private function resolveSubject(Request $request, int $id): array
    {
        $kind = $request->query('as', $request->query('kind'));
        if (! in_array($kind, ['user', 'record'], true)) {
            $kind = null;
        }

        $account = User::with(['studentRecord.section', 'studentRecord.batch', 'section', 'batchRecord'])
            ->whereIn('role', [User::ROLE_STUDENT, User::ROLE_ALUMNI])
            ->find($id);

        $record = Student::with([
            'section:id,name',
            'batch:id,name,graduation_year,department',
        ])->find($id);

        $linkedAccount = $record
            ? User::with(['studentRecord', 'section', 'batchRecord'])
                ->where('student_record_id', $record->id)
                ->whereIn('role', [User::ROLE_STUDENT, User::ROLE_ALUMNI])
                ->first()
            : null;

        $samePerson = $account && $record && (int) $account->student_record_id === (int) $record->id;

        if ($kind === 'user') {
            return [$account?->studentRecord, $account];
        }

        if ($kind === 'record') {
            return [$record, $linkedAccount];
        }

        if ($account && $record && ! $samePerson) {
            return [$account->studentRecord, $account];
        }

        if ($record) {
            return [$record, $linkedAccount ?? ($samePerson ? $account : null)];
        }

        return [$account?->studentRecord, $account];
    }

    private function recordPayload(Student $student, ?User $account, bool $isSubscribed): array
    {
        $photo = $student->photo ?: ($account?->profile_picture ?: $account?->avatar);
        $data = [
            'id' => $student->id,
            'student_record_id' => $student->id,
            'user_id' => $account?->id,
            'account_user_id' => $account?->id,
            'first_name' => $student->first_name,
            'last_name' => $student->last_name,
            'name' => trim(($student->first_name ?? '').' '.($student->last_name ?? '')),
            'student_no' => $student->student_no,
            'photo' => $photo,
            'photo_url' => $photo,
            'profile_picture' => $account?->profile_picture ?: $photo,
            'course' => $this->plainText($student->course ?: $account?->course),
            'graduation_year' => $student->graduation_year ?: $account?->graduation_year,
            'section' => $this->sectionPayload($student->section ?? $account?->section),
            'batch' => $this->batchPayload($student->batch ?? $account?->batchRecord),
            'is_premium_viewer' => $isSubscribed,
            'is_subscribed_viewer' => $isSubscribed,
            'academic_status' => $account?->academicStatusLabel() ?? $this->recordStatus($student),
            'student_id' => $student->student_no ?: $account?->student_id,
        ];

        if ($isSubscribed) {
            $data = array_merge($data, $this->detailFields($student, $account));
        }

        return $data;
    }

    private function accountPayload(User $account, bool $isSubscribed): array
    {
        $photo = $account->profile_picture ?: $account->avatar;
        $name = trim((string) $account->name);
        if ($name === '') {
            $name = trim(($account->first_name ?? '').' '.($account->last_name ?? ''));
        }

        $data = [
            'id' => $account->id,
            'student_record_id' => $account->student_record_id,
            'user_id' => $account->id,
            'account_user_id' => $account->id,
            'first_name' => $account->first_name ?: $this->firstNameFrom($name),
            'last_name' => $account->last_name ?: $this->lastNameFrom($name),
            'name' => $name,
            'student_no' => $account->student_id,
            'photo' => $photo,
            'photo_url' => $photo,
            'profile_picture' => $photo,
            'course' => $this->plainText($account->course),
            'graduation_year' => $account->graduation_year,
            'section' => $this->sectionPayload($account->section),
            'batch' => $this->batchPayload($account->batchRecord),
            'is_premium_viewer' => $isSubscribed,
            'is_subscribed_viewer' => $isSubscribed,
            'academic_status' => $account->academicStatusLabel(),
            'student_id' => $account->student_id,
        ];

        if (! $isSubscribed) {
            return $data;
        }

        return array_merge($data, $this->detailFields($account->studentRecord, $account));
    }

    /**
     * Honors, organizations, and the yearbook achievements paragraph live on the student row.
     * The Achievements tab on a person's own profile is the achievements relation.
     * Both are returned as plain scalars so the discovery view can render the same records.
     */
    private function detailFields(?Student $student, ?User $account): array
    {
        $email = $student?->email ?: ($account?->getAttributes()['email'] ?? null);

        return [
            'middle_name' => $this->plainText($student?->middle_name),
            'nickname' => $this->plainText($student?->nickname),
            'email' => $this->plainText($email),
            'birthday' => $this->plainText($student?->birthday),
            'hometown' => $this->plainText($student?->hometown),
            'honors' => $this->plainText($student?->honors),
            'organizations' => $this->plainText($student?->organizations),
            'achievements' => $this->plainText($student?->getAttributes()['achievements'] ?? null),
            'achievement_items' => $this->achievementItems($account),
            'motto' => $this->plainText($student?->motto ?: ($account?->getAttributes()['motto'] ?? null)),
            'student_quote' => $this->plainText($student?->student_quote),
            'fondest_memory' => $this->plainText($student?->fondest_memory),
            'ambition' => $this->plainText($student?->ambition),
            'future_plans' => $this->plainText($student?->future_plans),
            'message_to_batchmates' => $this->plainText($student?->message_to_batchmates),
            'message_to_parents' => $this->plainText($student?->message_to_parents),
            'most_likely_to' => $this->plainText($student?->most_likely_to),
            'facebook_url' => $this->plainText($student?->facebook_url),
            'instagram_url' => $this->plainText($student?->instagram_url),
            'linkedin_url' => $this->plainText($student?->linkedin_url),
            'github_url' => $this->plainText($student?->github_url),
        ];
    }

    private function achievementItems(?User $account): array
    {
        if (! $account) {
            return [];
        }

        return $account->achievements()
            ->orderByDesc('date_awarded')
            ->orderByDesc('id')
            ->get()
            ->map(fn ($row) => [
                'id' => $row->id,
                'title' => $this->plainText($row->title),
                'subtitle' => $this->plainText($row->subtitle),
                'type' => $this->plainText($row->type),
                'date_awarded' => $row->date_awarded instanceof \DateTimeInterface
                    ? $row->date_awarded->format('Y-m-d')
                    : $this->plainText($row->date_awarded),
            ])
            ->filter(fn ($row) => $row['title'] !== null)
            ->values()
            ->all();
    }

    private function recordStatus(Student $student): string
    {
        $year = (int) ($student->graduation_year ?? 0);

        return $year > 0 && $year <= (int) now()->year ? 'Alumni' : 'Current Student';
    }

    private function sectionPayload(mixed $section): ?array
    {
        if (! is_object($section) || ! isset($section->name) || trim((string) $section->name) === '') {
            return null;
        }

        return [
            'id' => $section->id ?? null,
            'name' => (string) $section->name,
        ];
    }

    private function batchPayload(mixed $batch): ?array
    {
        if (! is_object($batch)) {
            return null;
        }

        return [
            'id' => $batch->id ?? null,
            'name' => isset($batch->name) ? (string) $batch->name : null,
            'graduation_year' => $batch->graduation_year ?? null,
            'department' => isset($batch->department) ? (string) $batch->department : null,
        ];
    }

    private function plainText(mixed $value): ?string
    {
        if ($value instanceof \DateTimeInterface) {
            return $value->format('Y-m-d');
        }

        if ($value instanceof \Illuminate\Support\Collection) {
            $value = $value->all();
        }

        if (is_array($value)) {
            $parts = [];
            foreach ($value as $item) {
                if (is_array($item)) {
                    $item = $item['title'] ?? $item['name'] ?? $item['label'] ?? null;
                }
                $text = $this->plainText($item);
                if ($text !== null) {
                    $parts[] = $text;
                }
            }

            $joined = trim(implode(', ', $parts));

            return $joined === '' ? null : $joined;
        }

        if ($value === null || is_bool($value) || is_object($value)) {
            return null;
        }

        $text = trim((string) $value);

        return $text === '' ? null : $text;
    }

    private function firstNameFrom(string $name): ?string
    {
        $parts = preg_split('/\s+/', trim($name), 2) ?: [];

        return $parts[0] ?? null;
    }

    private function lastNameFrom(string $name): ?string
    {
        $parts = preg_split('/\s+/', trim($name), 2) ?: [];

        return $parts[1] ?? null;
    }
}
