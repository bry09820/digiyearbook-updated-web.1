<?php

declare(strict_types=1);

namespace App\Http\Controllers\API\Student;

use App\Contracts\StorageServiceInterface;
use App\Exceptions\StorageLimitExceededException;
use App\Http\Controllers\Controller;
use App\Models\Album;
use App\Models\GalleryMedia;
use App\Models\Photo;
use App\Models\PostMedia;
use App\Models\TaggedPhoto;
use App\Models\User;
use App\Notifications\PhotoTaggedNotification;
use App\Services\Storage\LocalStorageService;
use App\Support\PostEngagementSummary;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

class ProfileController extends Controller
{
    public function __construct(
        private readonly StorageServiceInterface $storage
    ) {}


    // GET /api/students/{id}/posts
    public function getPosts(Request $request, int $id): JsonResponse
    {
        $isOwner      = Auth::id() === $id;
        $isSubscribed = $request->attributes->get('viewer_is_subscribed', false);
        $viewer       = Auth::user();
        $profileOwner = User::with('studentRecord')->findOrFail($id);
        $isBatchmate  = $viewer instanceof User && $profileOwner->sharesBatchYearWith($viewer);

        if (! $profileOwner->canBeViewedBy($viewer instanceof User ? $viewer : null)) {
            return response()->json(array_merge($profileOwner->visibilityDenialPayload(), [
                'success' => false,
                'data' => ['data' => []],
            ]), 403);
        }

        if (! $isOwner && ! $isSubscribed) {
            return response()->json([
                'success'    => true,
                'restricted' => true,
                'data'       => ['data' => []],
            ]);
        }

        $photos = Photo::where('user_id', $id)
            ->where('is_profile_post', true)
            ->when(! $isOwner, fn ($q) => $q
                ->where(function ($status) {
                    $status->where('status', 'approved')->orWhereNull('status');
                })
                ->where(function ($visibility) use ($isBatchmate) {
                    $visibility->where('visibility', 'public')
                        ->orWhereNull('visibility')
                        ->orWhere('visibility', '');

                    if ($isBatchmate) {
                        $visibility->orWhereIn('visibility', ['friends', 'batchmates']);
                    }
                }))
            ->with([
                'user:id,name',
                'user.studentRecord:id,course,photo',         
                'taggedUsers:id,name',
                'taggedUsers.studentRecord:id,course,photo',
                'taggedStudents:id,name',
                'taggedStudents.studentRecord:id,course,photo',
                'media',
            ])
            ->withCount('postViews as unique_views_count')
            ->latest()
            ->paginate(12);

        $summaries = PostEngagementSummary::forPhotoIds(
            $photos->getCollection()->pluck('id')->all(),
            Auth::id()
        );
        $photos->getCollection()->transform(
            fn ($p) => $this->formatPost($p, $summaries[(int) $p->id] ?? null)
        );

        return response()->json([
            'success'    => true,
            'restricted' => false,
            'data'       => $photos,
        ]);
    }

    // POST /api/profile/upload

    public function uploadMedia(Request $request): JsonResponse
    {
        $maxKb        = max(\App\Support\PlatformSettings::uploadMaxKilobytes(), 102400);
        $allowedMimes = array_values(array_unique(array_merge(
            \App\Support\PlatformSettings::allowedMimeTypes(),
            [
                'image/jpeg',
                'image/png',
                'image/gif',
                'image/webp',
                'image/heic',
                'image/heif',
                'video/mp4',
                'video/mpeg',
                'video/quicktime',
                'video/webm',
                'video/x-msvideo',
                'audio/mpeg',
                'audio/mp3',
                'audio/wav',
                'audio/x-wav',
                'audio/ogg',
                'application/pdf',
            ],
        )));

        if (! $request->hasFile('files') && $request->hasFile('photos')) {
            $request->files->set('files', $request->file('photos'));
        }

        $request->validate([
            'files'             => ['required', 'array', 'min:1', 'max:20'],
            'files.*'           => [
                'required', 'file',
                function ($attribute, $value, $fail) use ($allowedMimes) {
                    $mime = $value->getMimeType();
                    if (! in_array($mime, $allowedMimes, true)) {
                        $fail("File type [{$mime}] is not allowed.");
                    }
                },
                'max:' . $maxKb,
            ],
            'caption'           => ['nullable', 'string', 'max:255'],
            'visibility'        => ['nullable', 'in:public,batchmates,friends,private'],
            'tagged_user_ids'   => ['nullable', 'array'],
            'tagged_user_ids.*' => ['integer', 'exists:users,id'],
            'tagged_users'      => ['nullable', 'array'],
            'tagged_users.*'    => ['integer', 'exists:users,id'],
        ]);

        $user = Auth::user();

        // Subscription gate (skipped when premium billing is disabled globally)
        if (\App\Support\PlatformSettings::bool('enable_premium_subscription')) {
            if (! \App\Support\SubscriptionAccess::isStandard($user)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Uploading photos requires a Standard or Premium subscription.',
                    'code'    => 'UPGRADE_REQUIRED',
                ], 403);
            }
        }

        $files      = $request->file('files');
        $caption    = $request->input('caption', '');
        $visibility = $this->normalizeVisibility($request->input('visibility', 'public'));
        $tagIds     = $this->tagIdsFromRequest($request, (int) $user->id);

        try {
            $stored = [];
            foreach ($files as $index => $file) {
                $stored[] = [
                    'index'  => $index,
                    'file'   => $file,
                    'result' => $this->storeUpload($file, (int) $user->id),
                ];
            }

            $photo = DB::transaction(function () use ($user, $caption, $visibility, $files, $stored, $tagIds) {
                $album = Album::firstOrCreate(
                    ['user_id' => $user->id, 'title' => 'My Uploads'],
                    ['type' => 'profile', 'event_date' => now()->toDateString()]
                );

                $photo = Photo::create([
                    'album_id'        => $album->id,
                    'user_id'         => $user->id,
                    'file_path'       => '',
                    'public_id'       => '',
                    'caption'         => $caption,
                    'visibility'      => $visibility,
                    'is_profile_post' => true,
                    'status'          => 'approved',
                    'ai_metadata'     => [
                        'resource_type' => 'image',
                        'multi'         => count($files) > 1,
                        'media_count'   => count($files),
                    ],
                ]);

                foreach ($stored as $item) {
                    $file         = $item['file'];
                    $result       = $item['result'];
                    $index        = $item['index'];
                    $resourceType = str_starts_with((string) $file->getMimeType(), 'video/') ? 'video' : 'image';

                    PostMedia::create([
                        'photo_id'      => $photo->id,
                        'file_path'     => $result['secure_url'],
                        'public_id'     => $result['public_id'],
                        'resource_type' => $resourceType,
                        'bytes'         => $result['bytes']  ?? 0,
                        'width'         => $result['width']  ?? null,
                        'height'        => $result['height'] ?? null,
                        'sort_order'    => $index,
                    ]);

                    if ($index === 0) {
                        $photo->update([
                            'file_path'   => $result['secure_url'],
                            'public_id'   => $result['public_id'],
                            'ai_metadata' => [
                                'resource_type' => $resourceType,
                                'bytes'         => $result['bytes']  ?? 0,
                                'width'         => $result['width']  ?? null,
                                'height'        => $result['height'] ?? null,
                                'multi'         => count($files) > 1,
                                'media_count'   => count($files),
                            ],
                        ]);
                    }
                }

                if ($tagIds !== []) {
                    $this->saveTags($photo, $tagIds, $user);
                }

                return $photo;
            });

            if ($tagIds !== []) {
                $this->notifyTaggedUsers($photo, $tagIds, $user);
            }

            $photo->load([
                'media',
                'user:id,name,graduation_year,batch',
                'taggedUsers:id,name',
                'taggedUsers.studentRecord:id,photo',
                'taggedStudents:id,name',
                'taggedStudents.studentRecord:id,photo',
            ]);

            return response()->json([
                'success' => true,
                'message' => count($files) > 1
                    ? count($files) . ' photos uploaded as one post.'
                    : 'Photo uploaded successfully.',
                'data' => $this->formatPost($photo),
            ], 201);

        } catch (ValidationException $e) {
            throw $e;
        } catch (StorageLimitExceededException $e) {
            Log::error('uploadMedia storage limit', ['message' => $e->getMessage(), 'user_id' => $user->id]);

            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
                'errors'  => $e->toArray(),
                'code'    => 'STORAGE_LIMIT_EXCEEDED',
            ], 422);

        } catch (\Throwable $e) {
            Log::error('uploadMedia failed', [
                'message' => $e->getMessage(),
                'line'    => $e->getLine(),
                'file'    => $e->getFile(),
                'user_id' => $user->id,
            ]);

            return response()->json([
                'success' => false,
                'message' => $e->getMessage() ?: 'Upload failed.',
                'code'    => 'UPLOAD_FAILED',
            ], 500);
        }
    }

    public function searchClassmates(Request $request): JsonResponse
    {
        $query = trim((string) $request->get('q', ''));
        if (mb_strlen($query) < 1) {
            return response()->json(['data' => []]);
        }

        $viewerId = (int) Auth::id();
        $limit    = min(8, max(1, (int) $request->get('limit', 8)));

        $users = User::query()
            ->with('studentRecord:id,course,photo')
            ->where('id', '!=', $viewerId)
            ->whereIn('role', [User::ROLE_STUDENT, User::ROLE_ALUMNI])
            ->where(function ($inner) use ($query) {
                $inner->where('name', 'like', "%{$query}%")
                    ->orWhere('first_name', 'like', "%{$query}%")
                    ->orWhere('last_name', 'like', "%{$query}%")
                    ->orWhere('student_id', 'like', "%{$query}%");
            })
            ->orderBy('name')
            ->limit($limit)
            ->get()
            ->map(fn (User $person) => [
                'id'              => $person->id,
                'name'            => $person->name,
                'course'          => $person->course,
                'student_id'      => $person->student_id,
                'profile_picture' => $person->profile_picture,
            ]);

        return response()->json(['data' => $users]);
    }

    
    // GET /api/profile/posts/{photoId}
    public function getPost(int $photoId): JsonResponse
    {
        $photo = Photo::where('id', $photoId)
            ->where('is_profile_post', true)
            ->with([
                'media',
                'taggedStudents:id,name',
                'taggedStudents.studentRecord:id,photo', 
            ])
            ->firstOrFail();

        return response()->json([
            'success' => true,
            'data'    => $this->formatPost($photo, PostEngagementSummary::forPhoto($photo->id, Auth::id())),
        ]);
    }

    // PATCH /api/profile/posts/{photoId}
    public function updatePost(Request $request, int $photoId): JsonResponse
    {
        $photo = Photo::where('id', $photoId)
            ->where('user_id', Auth::id())
            ->where('is_profile_post', true)
            ->firstOrFail();

        $validated = $request->validate([
            'caption'           => ['nullable', 'string', 'max:255'],
            'visibility'        => ['nullable', 'in:public,batchmates,friends,private'],
            'tagged_user_ids'   => ['nullable', 'array'],
            'tagged_user_ids.*' => ['integer', 'exists:users,id'],
        ]);

        $photo->update([
            'caption'    => $validated['caption']    ?? $photo->caption,
            'visibility' => isset($validated['visibility']) ? $this->normalizeVisibility($validated['visibility']) : $photo->visibility,
        ]);

        if (array_key_exists('tagged_user_ids', $validated)) {
            $newIds      = $validated['tagged_user_ids'] ?? [];
            $existingIds = TaggedPhoto::where('photo_id', $photo->id)
                ->where('source', 'manual')->pluck('user_id')->toArray();
            $addedIds    = array_values(array_diff($newIds, $existingIds));

            TaggedPhoto::where('photo_id', $photo->id)->where('source', 'manual')->delete();
            $photo->taggedUsers()->detach();
            $this->saveTags($photo, $newIds, Auth::user());
            $this->notifyTaggedUsers($photo, $addedIds, Auth::user());
        }

        $photo->load([
            'media',
            'taggedStudents:id,name',
            'taggedStudents.studentRecord:id,photo',
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Post updated.',
            'data'    => $this->formatPost($photo),
        ]);
    }

    // POST /api/profile/posts/{photoId}/report
    public function reportPost(Request $request, int $photoId): JsonResponse
    {
        $request->validate([
            'reason' => ['nullable', 'string', 'max:255'],
        ]);

        $photo = Photo::where('id', $photoId)
            ->where('is_profile_post', true)
            ->where('user_id', '!=', Auth::id())
            ->with('media')
            ->firstOrFail();

        $photo->media()->update(['is_reported' => true]);
        $photo->load('media');

        return response()->json([
            'success' => true,
            'message' => 'Report submitted for review.',
            'data'    => [
                'id'          => $photo->id,
                'is_reported' => true,
                'media'       => $photo->media->map(fn ($media) => [
                    'id'          => $media->id,
                    'is_reported' => (bool) $media->is_reported,
                ])->values(),
            ],
        ]);
    }

    // GET /api/profile/storage-usage
    public function storageUsage(): JsonResponse
    {
        $user = Auth::user();

        $subscription = \App\Models\Subscription::where('user_id', $user->id)
            ->where('status', 'active')
            ->where(fn ($q) => $q->whereNull('expires_at')->orWhere('expires_at', '>', now()))
            ->latest()->first();

        $tierKey    = $subscription?->storage_tier_key ?? 'free';
        $tierConfig = config("cloudinary.tiers.{$tierKey}");

        if (! is_array($tierConfig)) $tierConfig = config('cloudinary.tiers.free');
        if (! is_array($tierConfig)) $tierConfig = [
            'storage_limit_bytes' => 500 * 1024 * 1024,
            'hd_enabled'          => false,
        ];

        $postBytes = (int) PostMedia::whereHas(
            'photo',
            fn ($q) => $q->where('user_id', $user->id)
        )->sum('bytes');

        $galleryBytes = (int) GalleryMedia::whereHas(
            'gallery',
            fn ($q) => $q->where('user_id', $user->id)
        )->sum('bytes');

        $usedBytes = $postBytes + $galleryBytes;

        return response()->json([
            'success' => true,
            'data'    => [
                'used_bytes'  => $usedBytes,
                'limit_bytes' => $subscription?->storage_limit_bytes ?? $tierConfig['storage_limit_bytes'],
                'tier'        => $tierKey,
                'tier_label'  => $subscription?->storage_tier_label ?? ucfirst($tierKey),
                'hd_enabled'  => $subscription?->hd_enabled ?? $tierConfig['hd_enabled'],
            ],
        ]);
    }

    // DELETE /api/profile/posts/{photoId}
    public function deletePost(int $photoId): JsonResponse
    {
        $photo = Photo::query()
            ->where('id', $photoId)
            ->where('user_id', Auth::id())
            ->with('media')
            ->first();

        if (! $photo) {
            return response()->json([
                'success' => false,
                'message' => 'Post not found.',
            ], 404);
        }

        foreach ($photo->media as $media) {
            if (! $media->public_id) {
                continue;
            }
            try {
                $this->storage->deletePhoto(
                    publicId:     $media->public_id,
                    resourceType: $media->resource_type ?: 'image',
                );
            } catch (\Throwable) {}
        }

        if ($photo->public_id) {
            try {
                $this->storage->deletePhoto(
                    publicId:     $photo->public_id,
                    resourceType: $photo->ai_metadata['resource_type'] ?? 'image',
                );
            } catch (\Throwable) {}
        }

        DB::transaction(function () use ($photo) {
            TaggedPhoto::where('photo_id', $photo->id)->delete();
            $photo->taggedUsers()->detach();
            $photo->media()->delete();
            $photo->forceDelete();
        });

        return response()->json(['success' => true, 'message' => 'Post deleted.']);
    }

    // PRIVATE HELPERS
    private function formatPost(Photo $photo, ?array $engagement = null): array
    {
        if (! array_key_exists('unique_views_count', $photo->getAttributes())) {
            $photo->loadCount('postViews as unique_views_count');
        }

        $media = $photo->relationLoaded('media') ? $photo->media : $photo->media()->get();

        // Backward compat: old posts have no PostMedia rows use file_path directly
        if ($media->isEmpty()) {
            $media = collect([[
                'file_path'     => $photo->file_path,
                'public_id'     => $photo->public_id,
                'resource_type' => $photo->ai_metadata['resource_type'] ?? 'image',
                'sort_order'    => 0,
            ]]);
        }

        $fromPivot = $photo->relationLoaded('taggedUsers')
            ? $photo->taggedUsers
            : $photo->taggedUsers()->get();
        $fromLegacy = $photo->relationLoaded('taggedStudents')
            ? $photo->taggedStudents
            : collect();
        $taggedStudents = $fromPivot->concat($fromLegacy)->unique('id')->values();

        return [
            'id'              => $photo->id,
            'views_count'     => (int) ($photo->unique_views_count ?? $photo->views_count ?? 0),
            'caption'         => $photo->caption,
            'visibility'      => $this->displayVisibility($photo->visibility),
            'created_at'      => $photo->created_at,
            'file_path'       => $photo->file_path,
            'ai_metadata'     => $photo->ai_metadata,
            'media_count'     => $media->count(),
            'media'           => $media->map(fn ($m) => [
                'id'            => is_array($m) ? ($m['id'] ?? null) : $m->id,
                'file_path'     => is_array($m) ? $m['file_path']     : $m->file_path,
                'public_id'     => is_array($m) ? $m['public_id']     : $m->public_id,
                'resource_type' => is_array($m) ? $m['resource_type'] : $m->resource_type,
                'sort_order'    => is_array($m) ? $m['sort_order']    : $m->sort_order,
                'is_reported'   => is_array($m) ? (bool) ($m['is_reported'] ?? false) : (bool) $m->is_reported,
            ])->values(),
            'is_reported'     => $media->contains(fn ($m) => is_array($m)
                ? (bool) ($m['is_reported'] ?? false)
                : (bool) $m->is_reported),
            // profile_picture accessor resolves correctly because studentRecord
            // is now eager-loaded with the 'photo' column everywhere this is called.
            'tagged_users'    => $taggedStudents->map(fn ($u) => [
                'id'              => $u->id,
                'name'            => $u->name,
                'profile_picture' => $u->profile_picture,
            ])->values(),
            'tagged_students' => $taggedStudents->values(),
            'reactions'       => $engagement['reactions'] ?? PostEngagementSummary::blank()['reactions'],
            'comments_count'  => $engagement['comments_count'] ?? 0,
        ];
    }

    private function tagIdsFromRequest(Request $request, int $viewerId): array
    {
        $ids = array_merge(
            array_map('intval', (array) $request->input('tagged_user_ids', [])),
            array_map('intval', (array) $request->input('tagged_users', [])),
        );

        return array_values(array_unique(array_filter(
            $ids,
            fn (int $id) => $id > 0 && $id !== $viewerId
        )));
    }

    private function storeUpload(\Illuminate\Http\UploadedFile $file, int $userId): array
    {
        $options = [
            'skip_mime_check' => true,
            'skip_size_check' => true,
        ];

        try {
            return $this->storage->uploadPhoto(
                file: $file,
                userId: $userId,
                folder: 'profile',
                options: $options,
            );
        } catch (\Throwable $e) {
            if (! app()->environment('local')) {
                throw $e;
            }

            Log::warning('Profile upload fell back to the local public disk', [
                'user_id' => $userId,
                'error'   => $e->getMessage(),
            ]);

            return app(LocalStorageService::class)->uploadPhoto($file, $userId, 'profile', $options);
        }
    }

    private function saveTags(Photo $photo, array $userIds, User $tagger): void
    {
        $attach = [];
        foreach ($userIds as $userId) {
            if ((int) $userId === (int) $tagger->id) {
                continue;
            }

            $attach[(int) $userId] = ['tagged_by' => $tagger->id];

            TaggedPhoto::firstOrCreate(
                [
                    'photo_id' => $photo->id,
                    'user_id'  => $userId,
                    'source'   => 'manual',
                ],
                [
                    'tagged_by'  => $tagger->id,
                    'similarity' => 100,
                    'confidence' => 100,
                    'status'     => 'approved',
                ]
            );
        }

        if ($attach !== []) {
            $photo->taggedUsers()->syncWithoutDetaching($attach);
        }
    }

    private function notifyTaggedUsers(Photo $photo, array $userIds, User $tagger): void
    {
        $photoUrl = $photo->media()->orderBy('sort_order')->value('file_path')
            ?? $photo->file_path
            ?? '';

        foreach ($userIds as $userId) {
            if ((int) $userId === (int) $tagger->id) {
                continue;
            }

            $taggedUser = User::find($userId);
            if (! $taggedUser || ! $photo->visibleTo($taggedUser)) {
                continue;
            }

            try {
                $actionUrl = rtrim((string) config('app.frontend_url'), '/') . '/profile/' . $photo->user_id . '?post=' . $photo->id;
                PhotoTaggedNotification::dispatchFor($taggedUser, $tagger, $photoUrl, $actionUrl, $photo->id, $photo->user_id);
            } catch (\Throwable $e) {
                Log::warning('Photo tag notification failed', [
                    'photo_id' => $photo->id,
                    'user_id'  => $userId,
                    'message'  => $e->getMessage(),
                ]);
            }
        }
    }

    private function normalizeVisibility(?string $visibility): string
    {
        return $visibility === 'batchmates' ? 'friends' : ($visibility ?: 'public');
    }

    private function displayVisibility(?string $visibility): string
    {
        return $visibility === 'friends' ? 'batchmates' : ($visibility ?: 'public');
    }

}
