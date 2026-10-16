<?php

namespace App\Http\Controllers\API\Admin;

use App\Http\Controllers\Controller;
use App\Models\Admin;
use App\Models\Gallery;
use App\Models\Subscription;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\PersonalAccessToken;

class AdminNotificationController extends Controller
{
    // GET /api/admin/notifications
    public function index(Request $request): JsonResponse
    {
        $admin = $this->admin($request);
        $items = $this->items();
        $read = $this->readKeys($admin);
        $unread = 0;

        $payload = array_map(function (array $item) use ($read, &$unread) {
            $item['unread'] = ! isset($read[$item['id']]);
            $item['read_at'] = $read[$item['id']] ?? null;
            if ($item['unread']) {
                $unread++;
            }

            return $item;
        }, $items);

        return response()->json([
            'unread_count' => $unread,
            'items' => $payload,
        ])->header('Cache-Control', 'no-store, private, max-age=0')
          ->header('Pragma', 'no-cache');
    }

    // POST /api/admin/notifications/read
    public function markRead(Request $request): JsonResponse
    {
        $admin = $this->admin($request);
        $known = collect($this->items())->pluck('id')->flip();
        $ids = collect($request->input('ids', []))
            ->map(fn ($id) => trim((string) $id))
            ->filter(fn ($id) => $id !== '' && $known->has($id))
            ->unique()
            ->take(100)
            ->values();

        $now = now();
        foreach ($ids as $id) {
            DB::table('admin_notification_reads')->updateOrInsert(
                [
                    'admin_id' => $admin->id,
                    'notification_key' => $id,
                ],
                [
                    'read_at' => $now,
                ]
            );
        }

        $read = $this->readKeys($admin);
        $unread = collect($this->items())->reject(fn (array $item) => isset($read[$item['id']]))->count();

        return response()->json([
            'unread_count' => $unread,
            'read' => $ids->map(fn (string $id) => [
                'id' => $id,
                'read_at' => $now->toIso8601String(),
            ])->values(),
        ])->header('Cache-Control', 'no-store, private, max-age=0')
          ->header('Pragma', 'no-cache');
    }

    private function items(): array
    {
        $items = [];

        User::query()
            ->latest('created_at')
            ->limit(6)
            ->get(['id', 'first_name', 'last_name', 'name', 'role', 'created_at'])
            ->each(function (User $user) use (&$items) {
                $items[] = $this->entry(
                    'user-'.$user->id,
                    'registration',
                    'New account',
                    $this->personName($user).' registered as '.$user->role,
                    $user->created_at,
                    '/users',
                );
            });

        Gallery::query()
            ->with(['user:id,first_name,last_name,name', 'album:id,name'])
            ->where('status', 'pending')
            ->latest('created_at')
            ->limit(6)
            ->get()
            ->each(function (Gallery $gallery) use (&$items) {
                $album = $gallery->album?->name;
                $items[] = $this->entry(
                    'gallery-'.$gallery->id,
                    'upload',
                    'Upload awaiting approval',
                    trim($this->personName($gallery->user).($album ? ' · '.$album : '')),
                    $gallery->created_at,
                    '/media-library',
                );
            });

        Subscription::query()
            ->with('user:id,first_name,last_name,name')
            ->latest('updated_at')
            ->limit(6)
            ->get()
            ->each(function (Subscription $subscription) use (&$items) {
                $plan = str_replace('_', ' ', (string) $subscription->plan);
                $items[] = $this->entry(
                    'subscription-'.$subscription->id,
                    'subscription',
                    'Subscription update',
                    $this->personName($subscription->user).' · '.$plan.' · '.$subscription->status,
                    $subscription->updated_at ?? $subscription->created_at,
                    '/subscriptions',
                );
            });

        usort($items, fn (array $a, array $b) => strcmp($b['created_at'], $a['created_at']));

        return array_slice($items, 0, 15);
    }

    private function entry(string $id, string $type, string $title, string $body, $at, string $href): array
    {
        $moment = $at ? Carbon::parse($at) : now();

        return [
            'id' => $id,
            'type' => $type,
            'title' => $title,
            'body' => $body,
            'href' => $href,
            'created_at' => $moment->toIso8601String(),
            'time' => $moment->diffForHumans(),
        ];
    }

    private function personName(?User $user): string
    {
        if (! $user) {
            return 'A user';
        }

        $name = trim(((string) $user->first_name).' '.((string) $user->last_name));

        return $name !== '' ? $name : (trim((string) $user->name) ?: 'A user');
    }

    /**
     * @return array<string, string> notification key => read_at ISO time
     */
    private function readKeys(Admin $admin): array
    {
        return DB::table('admin_notification_reads')
            ->where('admin_id', $admin->id)
            ->pluck('read_at', 'notification_key')
            ->map(fn ($readAt) => Carbon::parse($readAt)->toIso8601String())
            ->all();
    }

    private function admin(Request $request): Admin
    {
        $user = $request->user();
        if ($user instanceof Admin) {
            return $user;
        }

        $token = $request->bearerToken();
        $accessToken = $token ? PersonalAccessToken::findToken($token) : null;
        $admin = $accessToken?->tokenable;

        if (! $admin instanceof Admin) {
            abort(401, 'Unauthorized.');
        }

        Auth::setUser($admin);

        return $admin;
    }
}
