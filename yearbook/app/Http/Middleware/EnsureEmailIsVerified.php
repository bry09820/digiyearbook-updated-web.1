<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Models\Admin;
use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureEmailIsVerified
{
    public function handle(Request $request, Closure $next): Response
    {
        $actor = $request->user();

        // Admins use a separate auth flow.
        if ($actor instanceof Admin) {
            return $next($request);
        }

        if ($actor instanceof User && ! $actor->isApproved()) {
            $request->user()?->currentAccessToken()?->delete();

            $disapproved = $actor->status === User::STATUS_DISAPPROVED;

            return response()->json([
                'message' => $disapproved
                    ? 'Your account was disapproved. Please contact an administrator.'
                    : 'Your account is pending admin approval.',
                'code'    => $disapproved ? 'ACCOUNT_DISAPPROVED' : 'ACCOUNT_PENDING',
            ], 403);
        }

        return $next($request);
    }
}
