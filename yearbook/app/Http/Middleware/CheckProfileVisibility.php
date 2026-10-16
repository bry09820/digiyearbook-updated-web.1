<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;

class CheckProfileVisibility
{
    public function handle(Request $request, Closure $next)
    {
        $profileId = $request->route('id');
        if (! $profileId) {
            return $next($request);
        }

        $profile = User::with(['section', 'studentRecord'])->find($profileId);
        if (! $profile) {
            return $next($request);
        }

        if ($profile->canBeViewedBy($request->user())) {
            return $next($request);
        }

        return response()->json($profile->visibilityDenialPayload(), 403);
    }
}
