<?php

namespace App\Http\Controllers\API\Admin;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Concerns\AuditsAdminActions;
use App\Models\AuditLog;
use App\Models\Batch;
use App\Models\User;
use App\Notifications\AccountApprovedNotification;
use App\Notifications\AccountDisapprovedNotification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Password;
use Illuminate\Validation\Rule;

class UserManagementController extends Controller
{
    use AuditsAdminActions;

    // GET /api/admin/users
    public function index(Request $request): JsonResponse
    {
        User::promoteGraduatedAccounts();

        $query = User::query()->with(['section', 'batchRecord', 'studentRecord']);

        if ($search = $request->get('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('first_name', 'like', "%{$search}%")
                  ->orWhere('last_name',  'like', "%{$search}%")
                  ->orWhere('email',      'like', "%{$search}%")
                  ->orWhere('student_id', 'like', "%{$search}%");
            });
        }

        if ($role = $request->get('role')) {
            if ($role === User::ROLE_ALUMNI) {
                $query->alumni();
            } elseif ($role === User::ROLE_STUDENT) {
                $query->currentStudents();
            } else {
                $query->where('role', $role);
            }
        }

        if ($status = $request->get('status')) {
            match ($status) {
                'pending'      => $query->where('status', User::STATUS_PENDING)->whereNull('suspended_at'),
                'approved'     => $query->where('status', User::STATUS_APPROVED)->whereNull('suspended_at'),
                'disapproved'  => $query->where('status', User::STATUS_DISAPPROVED)->whereNull('suspended_at'),
                'verified'     => $query->where('status', User::STATUS_APPROVED)->whereNull('suspended_at'),
                'unverified'   => $query->where('status', User::STATUS_PENDING)->whereNull('suspended_at'),
                'suspended'    => $query->whereNotNull('suspended_at'),
                default        => null,
            };
        }

        $users = $query
            ->orderByDesc('created_at')
            ->paginate($request->get('per_page', 15));

        $payload = $users->toArray();
        $payload['summary'] = User::accountCensus();

        return response()->json($payload);
    }

    // GET /api/admin/users/{id}
    public function show(User $user): JsonResponse
    {
        $user->load(['section', 'batchRecord', 'consents', 'subscriptions', 'achievements']);

        return response()->json([
            'data' => array_merge($user->toArray(), [
                'is_premium' => $user->is_premium,
                'is_sso'     => $user->isSsoUser(),
                'active_sub' => $user->activeSubscription(),
            ]),
        ]);
    }

    // PATCH /api/admin/users/{id}
    public function update(Request $request, User $user): JsonResponse
    {
        $validated = $request->validate([
            'role'               => ['sometimes', Rule::in([User::ROLE_STUDENT, User::ROLE_ALUMNI, User::ROLE_FACULTY, User::ROLE_ADMIN])],
            'profile_visibility' => ['sometimes', Rule::in(['public', 'batchmates', 'private'])],
            'first_name'         => 'sometimes|string|max:100',
            'last_name'          => 'sometimes|string|max:100',
            'bio'                => 'sometimes|nullable|string|max:500',
            'motto'              => 'sometimes|nullable|string|max:255',
            'course'             => 'sometimes|nullable|string|max:255',
            'batch'              => 'sometimes|nullable|string|max:50',
            'graduation_year'    => 'sometimes|'.Batch::yearRules(false),
        ]);

        $user->update($validated);
        $user->refresh()->loadMissing('studentRecord');
        if (array_key_exists('graduation_year', $validated)) {
            $user->syncIdentityFromGraduationYear();
        }
        if (($validated['role'] ?? null) === User::ROLE_ALUMNI) {
            $user->forceFill([
                'role' => User::ROLE_ALUMNI,
                'is_alumni' => true,
            ])->saveQuietly();
        } elseif (array_key_exists('role', $validated)) {
            $user->applyAlumniIdentity();
        }

        $this->audit(
            AuditLog::ACTION_USER_UPDATED,
            "Updated user #{$user->id} ({$user->email}). Fields changed: " . implode(', ', array_keys($validated)),
            AuditLog::STATUS_SUCCESS,
            null,
            $user->id,
            "user#{$user->id}",
        );

        return response()->json([
            'message' => 'User updated successfully.',
            'data'    => $user->fresh(),
        ]);
    }

    // PATCH /api/admin/users/{id}/suspend
    public function suspend(User $user): JsonResponse
    {
        if ($user->role === 'admin') {
            return response()->json(['message' => 'Cannot suspend an admin account.'], 403);
        }

        $user->forceFill(['suspended_at' => now()])->save();
        $user->tokens()->delete();

        $this->audit(
            AuditLog::ACTION_USER_UPDATED,
            "Suspended user #{$user->id} ({$user->email}). All active sessions revoked.",
            AuditLog::STATUS_WARNING,
            null,
            $user->id,
            "user#{$user->id}",
        );

        return response()->json([
            'message' => 'User suspended and sessions revoked.',
            'data'    => $user->fresh(),
        ]);
    }

    // PATCH /api/admin/users/{id}/unsuspend
    public function unsuspend(User $user): JsonResponse
    {
        $user->forceFill(['suspended_at' => null])->save();

        $this->audit(
            AuditLog::ACTION_USER_UPDATED,
            "Unsuspended user #{$user->id} ({$user->email}).",
            AuditLog::STATUS_SUCCESS,
            null,
            $user->id,
            "user#{$user->id}",
        );

        return response()->json([
            'message' => 'User unsuspended.',
            'data'    => $user->fresh(),
        ]);
    }

    // PATCH /api/admin/users/{id}/approve
    public function approve(User $user): JsonResponse
    {
        $user->forceFill([
            'status'            => User::STATUS_APPROVED,
            'email_verified'    => true,
            'email_verified_at' => $user->email_verified_at ?? now(),
        ])->save();

        $emailSent = $this->sendAccountDecisionEmail($user, User::STATUS_APPROVED);

        $this->audit(
            AuditLog::ACTION_USER_UPDATED,
            "Approved user #{$user->id} ({$user->email}).".($emailSent ? ' Approval email sent.' : ' Approval email could not be sent.'),
            $emailSent ? AuditLog::STATUS_SUCCESS : AuditLog::STATUS_WARNING,
            null,
            $user->id,
            "user#{$user->id}",
        );

        return response()->json([
            'message' => $emailSent
                ? 'User approved. A confirmation email was sent to '.$user->email.'.'
                : 'User approved, but the confirmation email could not be sent.',
            'email_sent' => $emailSent,
            'data'    => $user->fresh(),
        ]);
    }

    // PATCH /api/admin/users/{id}/disapprove
    public function disapprove(User $user): JsonResponse
    {
        if ($user->role === 'admin') {
            return response()->json(['message' => 'Cannot disapprove an admin account.'], 403);
        }

        $user->forceFill([
            'status'         => User::STATUS_DISAPPROVED,
            'email_verified' => false,
        ])->save();
        $user->tokens()->delete();

        $emailSent = $this->sendAccountDecisionEmail($user, User::STATUS_DISAPPROVED);

        $this->audit(
            AuditLog::ACTION_USER_UPDATED,
            "Disapproved user #{$user->id} ({$user->email}). All active sessions revoked.".($emailSent ? ' Disapproval email sent.' : ' Disapproval email could not be sent.'),
            AuditLog::STATUS_WARNING,
            null,
            $user->id,
            "user#{$user->id}",
        );

        return response()->json([
            'message' => $emailSent
                ? 'User disapproved. A notification email was sent to '.$user->email.'.'
                : 'User disapproved, but the notification email could not be sent.',
            'email_sent' => $emailSent,
            'data'    => $user->fresh(),
        ]);
    }

    private function sendAccountDecisionEmail(User $user, string $decision): bool
    {
        $email = strtolower(trim((string) $user->email));
        if (! filter_var($email, FILTER_VALIDATE_EMAIL)) {
            Log::warning("Account {$decision} email skipped for user #{$user->id}: invalid email.");

            return false;
        }

        try {
            $user->notify($decision === User::STATUS_APPROVED
                ? new AccountApprovedNotification()
                : new AccountDisapprovedNotification());

            return true;
        } catch (\Throwable $e) {
            Log::error("Account {$decision} email failed for {$email}: ".$e->getMessage());

            return false;
        }
    }

    // PATCH /api/admin/users/{id}/verify
    public function verify(User $user): JsonResponse
    {
        return $this->approve($user);
    }

    // POST /api/admin/users/{id}/reset-password
    public function resetPassword(User $user): JsonResponse
    {
        $status = Password::sendResetLink(['email' => $user->email]);

        if ($status === Password::RESET_LINK_SENT) {
            $this->audit(
                AuditLog::ACTION_PASSWORD_RESET,
                "Password reset email sent to {$user->email} (user #{$user->id}).",
                AuditLog::STATUS_SUCCESS,
                null,
                $user->id,
                "user#{$user->id}",
            );

            return response()->json(['message' => 'Password reset email sent to ' . $user->email]);
        }

        $this->audit(
            AuditLog::ACTION_PASSWORD_RESET,
            "Failed to send password reset email to {$user->email} (user #{$user->id}).",
            AuditLog::STATUS_FAILED,
            null,
            $user->id,
            "user#{$user->id}",
        );

        return response()->json(['message' => 'Failed to send reset email.'], 422);
    }

    // DELETE /api/admin/users/{id}
    public function destroy(User $user): JsonResponse
    {
        if ($user->role === 'admin') {
            return response()->json(['message' => 'Cannot delete an admin account.'], 403);
        }

        $snapshot = "{$user->email} (ID #{$user->id})";

        $user->tokens()->delete();
        $user->delete();

        $this->audit(
            AuditLog::ACTION_USER_DELETED,
            "Soft-deleted user {$snapshot}. All tokens revoked.",
            AuditLog::STATUS_WARNING,
            null,
            $user->id,
            "user#{$user->id}",
        );

        return response()->json(['message' => 'User deleted successfully.']);
    }
}
