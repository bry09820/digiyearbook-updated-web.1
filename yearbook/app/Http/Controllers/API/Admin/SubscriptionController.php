<?php

namespace App\Http\Controllers\API\Admin;

use App\Http\Controllers\Controller;
use App\Models\Subscription;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SubscriptionController extends Controller
{
    // GET /api/admin/subscriptions/stats
    public function stats(): JsonResponse
    {
        $active = Subscription::query()->withActiveStatus();
        $tiers = \App\Models\User::subscriptionTierCensus();

        return response()->json([
            'active_count'    => $tiers['premium_standard'] + $tiers['premium'],
            'total_users'     => $tiers['total_users'],
            'cancelled_count' => Subscription::where('status', 'cancelled')->whereHas('user')->count(),
            'total_revenue'   => (clone $active)->sum('amount_paid'),
            'expiring_soon'   => (clone $active)
                ->whereBetween('expires_at', [now(), now()->addDays(30)])
                ->count(),
            'tiers' => [
                'free'             => $tiers['free'],
                'premium_standard' => $tiers['premium_standard'],
                'premium'          => $tiers['premium'],
                'faculty'          => $tiers['faculty'],
                'admin'            => $tiers['admin'],
            ],
        ]);
    }

    // GET /api/admin/subscriptions
    public function index(Request $request): JsonResponse
    {
        $query = Subscription::with('user:id,first_name,last_name,email')
            ->whereHas('user')
            ->orderByDesc('created_at');

        if ($search = $request->get('search')) {
            $query->whereHas('user', fn ($q) =>
                $q->where('first_name', 'like', "%{$search}%")
                  ->orWhere('last_name',  'like', "%{$search}%")
                  ->orWhere('email',      'like', "%{$search}%")
            );
        }

        // Filter by plan group: 'standard' or 'premium'
        if ($plan = $request->get('plan')) {
            if ($plan === 'premium') {
                $query->premiumTier();
            } elseif ($plan === 'standard') {
                $query->standardTier();
            }
        }

        if ($status = $request->get('status')) {
            $query->where('status', $status);
        }

        return response()->json(
            $query->paginate($request->get('per_page', 15))
        );
    }

    // GET /api/admin/subscriptions/{subscription}
    public function show(Subscription $subscription): JsonResponse
    {
        $subscription->load('user:id,first_name,last_name,email');

        return response()->json([
            'data' => array_merge($subscription->toArray(), [
                'storage_tier_label' => $subscription->storage_tier_label,
                'storage_limit_bytes'=> $subscription->storage_limit_bytes,
                'hd_enabled'         => $subscription->hd_enabled,
                'bulk_upload_limit'  => $subscription->bulk_upload_limit,
            ]),
        ]);
    }

    // PATCH /api/admin/subscriptions/{subscription}/cancel
    public function cancel(Subscription $subscription): JsonResponse
    {
        if ($subscription->status !== 'active') {
            return response()->json(['message' => 'Subscription is not active.'], 422);
        }

        $subscription->update([
            'status'     => 'cancelled',
            'expires_at' => now(),
        ]);

        $admin = auth('sanctum')->user();

        DB::table('audit_logs')->insert([
            'admin_id'   => $admin?->id,
            'user_name'  => $admin?->email ?? 'admin',
            'action'     => 'cancel_subscription',
            'details'    => "Cancelled subscription #{$subscription->id} for user #{$subscription->user_id}",
            'ip_address' => request()->ip(),
            'status'     => 'Success',
            'logged_at'  => now(),
        ]);

        return response()->json(['message' => 'Subscription cancelled.']);
    }
}