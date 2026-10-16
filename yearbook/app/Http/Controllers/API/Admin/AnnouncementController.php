<?php

namespace App\Http\Controllers\API\Admin;

use App\Http\Controllers\Controller;
use App\Models\Announcement;
use App\Models\User;
use App\Services\Notification\BrevoMailService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Notifications\DatabaseNotification;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class AnnouncementController extends Controller
{
    //  GET /api/announcements 

    public function index(): JsonResponse
    {
        $announcements = Announcement::with('creator:id,name')
            ->latest()
            ->paginate(20);

        return response()->json($announcements);
    }

    // GET /api/announcements/recipients/count 

    public function recipientCount(): JsonResponse
    {
        return response()->json([
            'count' => $this->registeredStudents()->count(),
        ]);
    }

    // POST /api/admin/announcements

    public function store(Request $request): JsonResponse
    {
        $validated = $this->validateAnnouncement($request);

        $announcement = Announcement::create([
            'title'      => $validated['title'],
            'body'       => $validated['body'],
            'type'       => $validated['type'] ?? $this->fallbackType($validated['title'], $validated['body']),
            'send_push'  => $request->boolean('send_push', true),
            'created_by' => $request->user() instanceof User ? $request->user()->id : null,
        ]);

        $sendEmail = $request->boolean('send_email', true);
        $emailSent = $sendEmail ? $this->emailRegisteredStudents($announcement, $validated) : 0;
        $pushNotificationCount = $announcement->send_push
            ? $this->createInAppAnnouncementNotifications($announcement, $validated)
            : 0;

        return response()->json([
            'message' => $this->publishMessage($sendEmail, $emailSent, $pushNotificationCount),
            'announcement' => $announcement->load('creator:id,name'),
            'email_sent_count' => $emailSent,
            'push_notification_count' => $pushNotificationCount,
            'registered_students' => $this->registeredStudents()->count(),
        ], 201);
    }

    public function update(Request $request, Announcement $announcement): JsonResponse
    {
        $validated = $request->validate([
            'title'        => 'required|string|max:255',
            'body'         => 'required|string',
            'type'         => 'nullable|in:graduation,event,reminder,urgent,information',
            'send_push'    => 'boolean',
        ]);

        $announcement->update([
            'title'     => $validated['title'],
            'body'      => $validated['body'],
            'type'      => $validated['type'] ?? $this->fallbackType($validated['title'], $validated['body'], $announcement->type),
            'send_push' => $request->boolean('send_push', (bool) $announcement->send_push),
        ]);

        $pushNotificationCount = $announcement->send_push
            ? $this->createInAppAnnouncementNotifications($announcement->fresh(), $validated)
            : 0;

        return response()->json([
            'message'      => $pushNotificationCount > 0
                ? 'Announcement updated. Missing push notifications were created.'
                : 'Announcement updated.',
            'announcement' => $announcement->fresh()->load('creator:id,name'),
            'push_notification_count' => $pushNotificationCount,
        ]);
    }

    private function fallbackType(string $title, string $body, string $fallback = 'information'): string
    {
        return preg_match('/\b(graduation|commencement|baccalaureate)\b/i', "{$title} {$body}")
            ? 'graduation'
            : $fallback;
    }

    // DELETE /api/announcements/{id} 

    public function destroy(Announcement $announcement): JsonResponse
    {
        $announcement->delete();

        return response()->json(['message' => 'Announcement deleted.']);
    }

    private function validateAnnouncement(Request $request): array
    {
        $validated = $request->validate([
            'title'        => 'required|string|max:255',
            'body'         => 'required|string',
            'type'         => 'nullable|in:graduation,event,reminder,urgent,information',
            'send_push'    => 'sometimes|boolean',
            'send_email'   => 'sometimes|boolean',
            'action_url'   => 'nullable|string|max:2048',
            'action_label' => 'nullable|string|max:80',
        ]);

        $validated['title'] = trim($validated['title']);
        $validated['body'] = trim($validated['body']);
        $validated['action_url'] = $this->actionUrl($validated['action_url'] ?? null);
        $validated['action_label'] = trim((string) ($validated['action_label'] ?? '')) ?: 'View Announcement';

        return $validated;
    }

    private function actionUrl(?string $url): string
    {
        $url = trim((string) $url);
        if ($url === '') {
            return '/announcements';
        }

        if (str_starts_with($url, '/')) {
            return $url;
        }

        if (filter_var($url, FILTER_VALIDATE_URL)) {
            return $url;
        }

        abort(response()->json([
            'message' => 'Action URL must be a site path or a full web address.',
            'errors' => ['action_url' => ['Action URL must be a site path or a full web address.']],
        ], 422));
    }

    /**
     * Student and alumni accounts that can sign in to the web app.
     */
    private function registeredStudents(): Builder
    {
        return User::query()->whereIn('role', [User::ROLE_STUDENT, User::ROLE_ALUMNI]);
    }

    private function emailRegisteredStudents(Announcement $announcement, array $payload): int
    {
        $sent = 0;
        $mailer = app(BrevoMailService::class);

        $this->registeredStudents()
            ->whereNotNull('email')
            ->where('email', '!=', '')
            ->orderBy('id')
            ->select(['id', 'name', 'first_name', 'last_name', 'email'])
            ->chunkById(50, function ($users) use ($announcement, $payload, $mailer, &$sent) {
                foreach ($users as $user) {
                    $email = strtolower(trim((string) $user->email));
                    if (! filter_var($email, FILTER_VALIDATE_EMAIL)) {
                        continue;
                    }

                    $name = trim((string) ($user->name ?: trim($user->first_name.' '.$user->last_name))) ?: $email;

                    try {
                        if ($mailer->sendAnnouncement(
                            $email,
                            $name,
                            $announcement->title,
                            $announcement->body,
                            $payload['action_url'] ?? '/announcements',
                            $payload['action_label'] ?? 'View Announcement',
                        )) {
                            $sent++;
                        }
                    } catch (\Throwable $exception) {
                        Log::warning('Announcement email failed.', [
                            'announcement_id' => $announcement->id,
                            'recipient' => $email,
                            'error' => $exception->getMessage(),
                        ]);
                    }
                }
            });

        return $sent;
    }

    private function createInAppAnnouncementNotifications(Announcement $announcement, array $payload = []): int
    {
        $created = 0;
        $existingIds = DatabaseNotification::query()
            ->where('notifiable_type', User::class)
            ->where('type', 'announcement')
            ->where('data->id', (string) $announcement->id)
            ->pluck('notifiable_id')
            ->map(fn ($id) => (int) $id)
            ->all();

        $this->registeredStudents()
            ->select('id')
            ->orderBy('id')
            ->chunkById(100, function ($users) use ($announcement, $payload, $existingIds, &$created) {
                foreach ($users as $user) {
                    if (in_array((int) $user->id, $existingIds, true)) {
                        continue;
                    }

                    DatabaseNotification::create([
                        'id' => (string) Str::uuid(),
                        'type' => 'announcement',
                        'notifiable_type' => User::class,
                        'notifiable_id' => $user->id,
                        'data' => [
                            'type' => 'announcement',
                            'id' => (string) $announcement->id,
                            'title' => $announcement->title,
                            'body' => $announcement->body,
                            'action_url' => $payload['action_url'] ?? '/announcements',
                            'action_label' => $payload['action_label'] ?? 'View Announcement',
                        ],
                        'read_at' => null,
                    ]);

                    $created++;
                }
            });

        return $created;
    }

    private function publishMessage(bool $sendEmail, int $emailSent, int $pushCount): string
    {
        $parts = ['Announcement published.'];
        if ($pushCount > 0) {
            $parts[] = $pushCount.' in-app notification'.($pushCount === 1 ? '' : 's').' sent.';
        }
        if ($sendEmail) {
            $parts[] = $emailSent.' email'.($emailSent === 1 ? '' : 's').' sent.';
        }

        return implode(' ', $parts);
    }
}
