<?php

namespace App\Http\Controllers\API\Admin;

use App\Http\Controllers\Controller;
use App\Models\Album;
use App\Models\AuditLog;
use App\Models\Gallery;
use App\Models\GalleryMedia;
use App\Models\Photo;
use App\Models\PostMedia;
use App\Models\User;
use App\Models\VoiceNote;
use App\Models\TaggedPhoto;
use App\Notifications\MediaApprovedNotification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;


class MediaModerationController extends Controller
{

    // GET /api/albums-with-photos
    public function allAlbumsWithPhotos(Request $request): JsonResponse
    {
        $query = Album::with([
            'user:id,first_name,last_name,profile_picture',
            'galleries' => fn ($q) => $q->with('media')
                                         ->whereNotNull('user_id')
                                         ->where('status', 'approved')
                                         ->where(function ($visibility) {
                                             $visibility->where('visibility', 'public')
                                                 ->orWhereNull('visibility')
                                                 ->orWhere('visibility', '');
                                         })
                                         ->orderBy('created_at', 'desc'),
        ])
        ->whereNotNull('user_id')
        ->where('type', 'general')
        ->orderByDesc('created_at');

        if ($request->filled('user_id')) {
            $query->where('user_id', $request->user_id);
        }

        if ($request->filled('category')) {
            $query->where('category', $request->category);
        }

        $albums = $query->paginate($request->get('per_page', 18));

        $albums->getCollection()->transform(function (Album $album) {
            $photos = $album->galleries->map(fn ($p) => [
                'id'               => $p->id,
                'url'              => $this->mediaItemUrl($p),
                'caption'          => $p->caption,
                'visibility'       => $p->visibility ?? 'public',
                'status'           => $p->status,
                'file_type'        => $this->mediaItemType($p),
                'resource_type'    => $this->mediaItemType($p),
                'created_at'       => $p->created_at,
                'created_at_human' => $p->created_at
                    ? Carbon::parse($p->created_at)->diffForHumans() : null,
            ]);

            $coverUrl = $album->cover_image
                ? $this->resolveUrl($album->cover_image)
                : ($photos->isNotEmpty() ? $photos->first()['url'] : null);

            return [
                'id'               => $album->id,
                'title'            => $album->title,
                'description'      => $album->description ?? null,
                'category'         => $album->category ?? null,
                'event_date'       => $album->event_date?->format('Y-m-d'),
                'cover_url'        => $coverUrl,
                'photo_count'      => $photos->count(),
                'photos'           => $photos->values(),
                'owner'            => $album->user
                    ? "{$album->user->first_name} {$album->user->last_name}" : 'Unknown',
                'owner_avatar'     => $album->user->profile_picture ?? null,
                'owner_id'         => $album->user_id,
                'created_at'       => $album->created_at,
                'created_at_human' => $album->created_at
                    ? Carbon::parse($album->created_at)->diffForHumans() : null,
            ];
        });

        return response()->json($albums);
    }

    // GET /api/admin/moderation/counts
    public function counts(): JsonResponse
    {
        return response()->json([
            'photo'    => Album::whereNotNull('user_id')
                            ->where('type', 'general')
                            ->whereHas('galleries', fn ($q) => $q->where('status', 'pending')
                                ->whereNotNull('user_id')
                                ->whereHas('media', fn ($m) => $m->where('resource_type', 'image')))
                            ->count(),

            'video'    => PostMedia::where('resource_type', 'video')
                            ->where('status', 'pending')
                            ->whereNotNull('photo_id')
                            ->count()
                            + Gallery::where('status', 'pending')
                                ->whereNotNull('user_id')
                                ->whereHas('album', fn ($q) => $q->where('type', 'general'))
                                ->whereHas('media', fn ($q) => $q->where('resource_type', 'video'))
                                ->count(),

            'voice'    => VoiceNote::where('status', 'pending')->count(),

            'tagged'   => TaggedPhoto::where('status', 'pending')->count(),

            'reported' => PostMedia::where('is_reported', true)->count(),
        ]);
    }

    // GET /api/admin/moderation/queue?type=photo|video|voice|tagged|&status=pending
    public function queue(Request $request): JsonResponse
    {
        $type   = $request->get('type',   'photo');
        $status = $request->get('status', 'pending');

        if ($type === 'photo') {
            return $this->albumQueue($request, $status);
        }

        if ($type === 'video') {
            return $this->galleryVideoQueue($request, $status);
        }

        return $this->genericQueue($request, $type, $status);
    }

    private function albumQueue(Request $request, string $status): JsonResponse
    {
        $albums = Album::with([
            'user:id,first_name,last_name,profile_picture',
                'galleries' => fn ($q) => $q->with('media')
                                         ->where('status', $status)
                                         ->whereNotNull('user_id')
                                         ->whereHas('media', fn ($m) => $m->where('resource_type', 'image'))
                                         ->orderBy('created_at', 'desc'),
        ])
        ->whereNotNull('user_id')
        ->where('type', 'general')
        ->whereHas('galleries', fn ($q) => $q->where('status', $status)
            ->whereNotNull('user_id')
            ->whereHas('media', fn ($m) => $m->where('resource_type', 'image')))
        ->orderByDesc('updated_at')
        ->paginate($request->get('per_page', 12));

        $albums->getCollection()->transform(function (Album $album) use ($status) {
            $photos = $album->galleries->map(fn ($p) => [
                'id'               => $p->id,
                'url'              => $this->mediaItemUrl($p),
                'caption'          => $p->caption,
                'status'           => $p->status ?? 'pending',
                'file_type'        => $this->mediaItemType($p),
                'resource_type'    => $this->mediaItemType($p),
                'rejection_reason' => $p->rejection_reason,
                'ai_metadata'      => $p->ai_metadata,
                'created_at'       => $p->created_at,
                'created_at_human' => $p->created_at
                    ? Carbon::parse($p->created_at)->diffForHumans() : null,
            ]);

            $coverUrl = $album->cover_image
                ? $this->resolveUrl($album->cover_image)
                : ($photos->isNotEmpty() ? $photos->first()['url'] : null);

            return [
                'id'               => $album->id,
                'title'            => $album->title,
                'description'      => $album->description ?? null,
                'cover_url'        => $coverUrl,
                'photo_count'      => $photos->count(),
                'photos'           => $photos->values(),
                'status'           => $status,
                'uploader'         => $album->user
                    ? "{$album->user->first_name} {$album->user->last_name}" : 'Unknown',
                'uploader_avatar'  => $album->user->profile_picture ?? null,
                'created_at'       => $album->created_at,
                'created_at_human' => $album->created_at
                    ? Carbon::parse($album->created_at)->diffForHumans() : null,
            ];
        });

        return response()->json($albums);
    }

    private function galleryVideoQueue(Request $request, string $status): JsonResponse
    {
        $galleryItems = Gallery::query()
            ->with([
                'user:id,first_name,last_name',
                'album:id,title',
                'media' => fn ($q) => $q->where('resource_type', 'video')->orderBy('sort_order'),
            ])
            ->where('status', $status)
            ->whereNotNull('user_id')
            ->whereHas('album', fn ($q) => $q->where('type', 'general'))
            ->whereHas('media', fn ($q) => $q->where('resource_type', 'video'))
            ->orderByDesc('created_at')
            ->get()
            ->map(function (Gallery $item) {
                $media = $item->media->first();
                $uploader = $item->user
                    ? "{$item->user->first_name} {$item->user->last_name}"
                    : 'Unknown';

                return [
                    'id'               => $item->id,
                    'source'           => 'gallery',
                    'url'              => $this->resolveUrl($media?->file_path),
                    'filename'         => $item->caption ?: ($item->album?->title ?? 'Gallery video'),
                    'title'            => $item->caption ?: ($item->album?->title ?? 'Gallery video'),
                    'caption'          => $item->caption,
                    'status'           => $item->status ?? 'pending',
                    'file_size'        => $media?->bytes,
                    'file_type'        => 'video',
                    'resource_type'    => 'video',
                    'rejection_reason' => $item->rejection_reason,
                    'uploader'         => $uploader,
                    'created_at'       => $item->created_at,
                    'created_at_human' => $item->created_at
                        ? Carbon::parse($item->created_at)->diffForHumans() : null,
                    'album_id'         => $item->album_id,
                    'album_title'      => $item->album?->title,
                    'bytes'            => $media?->bytes,
                    'width'            => $media?->width,
                    'height'           => $media?->height,
                    'is_reported'      => false,
                ];
            });

        $postItems = PostMedia::query()
            ->with('photo.user:id,first_name,last_name')
            ->where('resource_type', 'video')
            ->where('status', $status)
            ->whereNotNull('photo_id')
            ->orderByDesc('created_at')
            ->get()
            ->map(function (PostMedia $item) {
                $uploader = optional(optional($item->photo)->user)->first_name
                    ? "{$item->photo->user->first_name} {$item->photo->user->last_name}"
                    : 'Unknown';

                return [
                    'id'               => $item->id,
                    'source'           => 'post',
                    'url'              => $this->resolveUrl($item->file_path ?? null),
                    'filename'         => $item->resource_type ?? 'Video',
                    'title'            => $item->resource_type ?? 'Video',
                    'status'           => $item->status ?? 'pending',
                    'file_size'        => $item->file_size ?? null,
                    'file_type'        => 'video',
                    'resource_type'    => 'video',
                    'rejection_reason' => $item->rejection_reason ?? null,
                    'uploader'         => $uploader,
                    'created_at'       => $item->created_at,
                    'created_at_human' => $item->created_at
                        ? Carbon::parse($item->created_at)->diffForHumans() : null,
                    'bytes'            => $item->bytes ?? null,
                    'width'            => $item->width ?? null,
                    'height'           => $item->height ?? null,
                    'is_reported'      => $item->is_reported ?? false,
                ];
            });

        $merged = $galleryItems
            ->concat($postItems)
            ->sortByDesc(fn ($item) => optional($item['created_at'])->timestamp ?? 0)
            ->values();

        $perPage = (int) $request->get('per_page', 18);
        $page = LengthAwarePaginator::resolveCurrentPage();
        $items = new LengthAwarePaginator(
            $merged->forPage($page, $perPage)->values(),
            $merged->count(),
            $perPage,
            $page,
            ['path' => $request->url(), 'query' => $request->query()]
        );

        $items->getCollection()->transform(function ($item) {
            return [
                'id'               => $item['id'],
                'source'           => $item['source'],
                'url'              => $item['url'],
                'filename'         => $item['filename'],
                'title'            => $item['title'],
                'caption'          => $item['caption'] ?? null,
                'status'           => $item['status'],
                'file_size'        => $item['file_size'],
                'file_type'        => $item['file_type'],
                'resource_type'    => $item['resource_type'],
                'rejection_reason' => $item['rejection_reason'],
                'uploader'         => $item['uploader'],
                'created_at'       => $item['created_at'],
                'created_at_human' => $item['created_at_human'],
                'album_id'         => $item['album_id'] ?? null,
                'album_title'      => $item['album_title'] ?? null,
                'bytes'            => $item['bytes'],
                'width'            => $item['width'],
                'height'           => $item['height'],
                'is_reported'      => $item['is_reported'],
            ];
        });

        return response()->json($items);
    }

    private function genericQueue(Request $request, string $type, string $status): JsonResponse
    {
        $config    = $this->resolveType($type);
        $model     = $config['model'];
        $statusCol = $config['status_col'];
        $urlCol    = $config['url_col'];
        $nameCol   = $config['name_col'];

        $query = $model::query()->orderByDesc('created_at');

        if ($type === 'reported') {
            $query->where('is_reported', true);
        } else {
            $query->where($statusCol, $status);
        }

        if ($type === 'video') {
            $query->where('resource_type', 'video')
                  ->whereNotNull('photo_id')
                  ->with('photo.user:id,first_name,last_name');
        } elseif ($type === 'voice') {
            $query->with([
                'sender:id,first_name,last_name',
                'recipient:id,first_name,last_name',
            ]);
        } elseif ($config['user_fk']) {
            $query->with('user:id,first_name,last_name');
        }

        $items = $query->paginate($request->get('per_page', 18));

        $items->getCollection()->transform(function ($item) use ($type, $urlCol, $nameCol, $statusCol, $config) {
            if ($type === 'video') {
                $uploaderName = optional(optional($item->photo)->user)->first_name
                    ? "{$item->photo->user->first_name} {$item->photo->user->last_name}"
                    : 'Unknown';
            } elseif ($type === 'voice') {
                $uploaderName = $item->sender
                    ? "{$item->sender->first_name} {$item->sender->last_name}"
                    : 'Unknown';
            } else {
                $uploaderName = $item->user
                    ? "{$item->user->first_name} {$item->user->last_name}"
                    : 'Unknown';
            }

            return [
                'id'               => $item->id,
                'url'              => $this->resolveUrl($item->{$urlCol} ?? null),
                'filename'         => $item->{$nameCol} ?? null,
                'title'            => $item->{$nameCol} ?? null,
                'status'           => $item->{$statusCol} ?? 'pending',
                'file_size'        => $item->file_size ?? null,
                'file_type'        => $item->file_type ?? $item->resource_type ?? null,
                'rejection_reason' => $config['reason_col']
                    ? ($item->{$config['reason_col']} ?? null) : null,
                'uploader'         => $uploaderName,
                'created_at'       => $item->created_at,
                'created_at_human' => $item->created_at
                    ? Carbon::parse($item->created_at)->diffForHumans() : null,
            ];
        });

        return response()->json($items);
    }

    // MODERATION Show single item
    public function show(string $type, int $id): JsonResponse
    {
        if ($type === 'photo') {
            $album = Album::with([
                'user:id,first_name,last_name,profile_picture',
                'photos' => fn ($q) => $q->with('media')
                                         ->whereNotNull('user_id')
                                         ->whereHas('media', fn ($m) => $m->where('resource_type', 'image'))
                                         ->orderBy('created_at', 'desc'),
            ])
            ->whereNotNull('user_id')
            ->where('type', 'general')
            ->findOrFail($id);

            $photos = $album->photos->map(fn ($p) => [
                'id'               => $p->id,
                'url'              => $this->mediaItemUrl($p),
                'caption'          => $p->caption,
                'status'           => $p->status ?? 'pending',
                'file_type'        => $this->mediaItemType($p),
                'resource_type'    => $this->mediaItemType($p),
                'rejection_reason' => $p->rejection_reason,
                'ai_metadata'      => $p->ai_metadata,
                'created_at'       => $p->created_at,
                'created_at_human' => $p->created_at
                    ? Carbon::parse($p->created_at)->diffForHumans() : null,
            ]);

            $coverUrl = $album->cover_image
                ? $this->resolveUrl($album->cover_image)
                : ($photos->isNotEmpty() ? $photos->first()['url'] : null);

            return response()->json([
                'id'               => $album->id,
                'title'            => $album->title,
                'description'      => $album->description ?? null,
                'cover_url'        => $coverUrl,
                'photo_count'      => $photos->count(),
                'photos'           => $photos->values(),
                'status'           => $album->status ?? 'pending',
                'uploader'         => $album->user
                    ? "{$album->user->first_name} {$album->user->last_name}" : 'Unknown',
                'uploader_avatar'  => $album->user->profile_picture ?? null,
                'created_at'       => $album->created_at,
                'created_at_human' => $album->created_at
                    ? Carbon::parse($album->created_at)->diffForHumans() : null,
            ]);
        }

        $config    = $this->resolveType($type);
        $model     = $config['model'];
        $statusCol = $config['status_col'];
        $urlCol    = $config['url_col'];
        $nameCol   = $config['name_col'];

        $query = $model::query()->where('id', $id);

        if ($type === 'video') {
            $query->where('resource_type', 'video')
                  ->whereNotNull('photo_id')
                  ->with('photo.user:id,first_name,last_name');
        } elseif ($type === 'voice') {
            $query->with([
                'sender:id,first_name,last_name',
                'recipient:id,first_name,last_name',
            ]);
        } elseif ($config['user_fk']) {
            $query->with('user:id,first_name,last_name');
        }

        $item = $query->firstOrFail();

        if ($type === 'video') {
            $uploaderName = optional(optional($item->photo)->user)->first_name
                ? "{$item->photo->user->first_name} {$item->photo->user->last_name}"
                : 'Unknown';
        } elseif ($type === 'voice') {
            $uploaderName  = $item->sender
                ? "{$item->sender->first_name} {$item->sender->last_name}"
                : 'Unknown';
            $recipientName = $item->recipient
                ? "{$item->recipient->first_name} {$item->recipient->last_name}"
                : 'Unknown';
        } else {
            $uploaderName = $item->user
                ? "{$item->user->first_name} {$item->user->last_name}"
                : 'Unknown';
        }

        $data = [
            'id'               => $item->id,
            'url'              => $this->resolveUrl($item->{$urlCol} ?? null),
            'filename'         => $item->{$nameCol} ?? null,
            'title'            => $item->{$nameCol} ?? null,
            'status'           => $item->{$statusCol} ?? 'pending',
            'file_size'        => $item->file_size ?? null,
            'file_type'        => $item->file_type ?? $item->resource_type ?? null,
            'rejection_reason' => $config['reason_col']
                ? ($item->{$config['reason_col']} ?? null) : null,
            'uploader'         => $uploaderName,
            'created_at'       => $item->created_at,
            'created_at_human' => $item->created_at
                ? Carbon::parse($item->created_at)->diffForHumans() : null,
        ];

        if ($type === 'voice') {
            $data['recipient']        = $recipientName ?? 'Unknown';
            $data['duration_seconds'] = $item->duration_seconds ?? null;
            $data['audio_url']        = $item->audio_url ?? null;
        }

        if ($type === 'video' || $type === 'reported') {
            $data['bytes']       = $item->bytes ?? null;
            $data['width']       = $item->width ?? null;
            $data['height']      = $item->height ?? null;
            $data['is_reported'] = $item->is_reported ?? false;
        }

        if ($type === 'tagged') {
            $data['similarity'] = $item->similarity ?? null;
            $data['confidence'] = $item->confidence ?? null;
            $data['source']     = $item->source ?? null;
        }

        return response()->json($data);
    }

    // MODERATION Album approve / reject / revert

    public function approveAlbum(int $albumId): JsonResponse
    {
        Album::findOrFail($albumId);
        $pendingPhotos = Gallery::with(['album', 'media', 'user'])
            ->where('album_id', $albumId)
            ->where('status', 'pending')
            ->whereHas('media', fn ($m) => $m->where('resource_type', 'image'))
            ->get();

        $update = ['status' => 'approved', 'rejection_reason' => null];

        try {
            Gallery::where('album_id', $albumId)
                ->where('status', 'pending')
                ->whereHas('media', fn ($m) => $m->where('resource_type', 'image'))
                ->update(array_merge($update, [
                    'approved_at' => now(),
                    'approved_by' => auth('sanctum')->id(),
                ]));
        } catch (\Exception) {
            Gallery::where('album_id', $albumId)
                ->where('status', 'pending')
                ->whereHas('media', fn ($m) => $m->where('resource_type', 'image'))
                ->update($update);
        }

        $this->log('album', $albumId, 'approved');
        $pendingPhotos->each(fn (Gallery $gallery) => $this->notifyUploaderApproved($gallery));

        return response()->json(['message' => "All photos in album #{$albumId} approved."]);
    }

    public function rejectAlbum(Request $request, int $albumId): JsonResponse
    {
        $request->validate(['reason' => 'required|string|max:255']);

        Album::findOrFail($albumId);

        $update = ['status' => 'rejected', 'rejection_reason' => $request->reason];

        try {
            Gallery::where('album_id', $albumId)
                ->where('status', 'pending')
                ->whereHas('media', fn ($m) => $m->where('resource_type', 'image'))
                ->update(array_merge($update, [
                    'rejected_at' => now(),
                    'rejected_by' => auth('sanctum')->id(),
                ]));
        } catch (\Exception) {
            Gallery::where('album_id', $albumId)
                ->where('status', 'pending')
                ->whereHas('media', fn ($m) => $m->where('resource_type', 'image'))
                ->update($update);
        }

        $this->log('album', $albumId, 'rejected', $request->reason);

        return response()->json(['message' => "All photos in album #{$albumId} rejected."]);
    }

    public function revertAlbum(Request $request, int $albumId): JsonResponse
    {
        $request->validate([
            'status' => 'required|in:pending,approved,rejected',
            'note'   => 'nullable|string|max:500',
        ]);

        $album    = Album::findOrFail($albumId);
        $toStatus = $request->status;

        $photoUpdate = [
            'status'           => $toStatus,
            'rejection_reason' => $toStatus === 'rejected'
                ? ($request->note ?? 'Reverted by admin') : null,
        ];

        $albumUpdate = ['status' => $toStatus];

        match ($toStatus) {
            'approved' => $photoUpdate += ['approved_at' => now(), 'approved_by' => auth('sanctum')->id(), 'rejected_at' => null],
            'rejected' => $photoUpdate += ['rejected_at' => now(), 'rejected_by' => auth('sanctum')->id(), 'approved_at' => null],
            'pending'  => $photoUpdate += ['approved_at' => null, 'rejected_at' => null],
        };

        DB::transaction(function () use ($album, $albumUpdate, $photoUpdate) {
            try {
                $album->update(array_merge($albumUpdate, [
                    'approved_at' => $photoUpdate['approved_at'] ?? null,
                    'rejected_at' => $photoUpdate['rejected_at'] ?? null,
                ]));
            } catch (\Exception) {
                $album->update($albumUpdate);
            }

            try {
                Gallery::where('album_id', $album->id)
                    ->whereHas('media', fn ($m) => $m->where('resource_type', 'image'))
                    ->update($photoUpdate);
            } catch (\Exception) {
                Gallery::where('album_id', $album->id)
                    ->whereHas('media', fn ($m) => $m->where('resource_type', 'image'))
                    ->update([
                    'status'           => $photoUpdate['status'],
                    'rejection_reason' => $photoUpdate['rejection_reason'],
                ]);
            }
        });

        $this->logRevert('album', $albumId, 'various', $toStatus, $request->note);

        return response()->json([
            'message'   => "All photos in album #{$albumId} reverted to {$toStatus}.",
            'to_status' => $toStatus,
        ]);
    }

    // MODERATION Single photo approve / reject / revert

    public function approvePhoto(int $id): JsonResponse
    {
        $photo = Gallery::find($id) ?? Photo::findOrFail($id);
        $wasPendingGallery = $photo instanceof Gallery && $photo->status === 'pending';

        try {
            $photo->update([
                'status'      => 'approved',
                'approved_at' => now(),
                'approved_by' => auth('sanctum')->id(),
            ]);
        } catch (\Exception) {
            $photo->update(['status' => 'approved']);
        }

        $this->log('photo', $id, 'approved');
        if ($wasPendingGallery) {
            $this->notifyUploaderApproved($photo->fresh(['album', 'media', 'user']));
        }

        return response()->json(['message' => "Photo #{$id} approved."]);
    }

    public function rejectPhoto(Request $request, int $id): JsonResponse
    {
        $request->validate(['reason' => 'required|string|max:255']);

        $photo = Gallery::find($id) ?? Photo::findOrFail($id);

        try {
            $photo->update([
                'status'           => 'rejected',
                'rejection_reason' => $request->reason,
                'rejected_at'      => now(),
                'rejected_by'      => auth('sanctum')->id(),
            ]);
        } catch (\Exception) {
            $photo->update([
                'status'           => 'rejected',
                'rejection_reason' => $request->reason,
            ]);
        }

        $this->log('photo', $id, 'rejected', $request->reason);

        return response()->json(['message' => "Photo #{$id} rejected."]);
    }

    public function flagAvatar(Request $request, int $id): JsonResponse
    {
        $photo = Photo::with('user')->find($id);
        $user = $photo?->user;

        if (! $user) {
            $gallery = Gallery::with('user')->findOrFail($id);
            $user = $gallery->user;
            $gallery->update([
                'status' => 'pending',
                'rejection_reason' => 'Avatar flagged for admin review.',
            ]);
        } else {
            $photo->update([
                'status' => 'pending',
                'rejection_reason' => 'Avatar flagged for admin review.',
            ]);
        }

        abort_if(! $user, 404, 'Avatar owner not found.');

        User::whereKey($user->id)->update([
            'profile_picture' => null,
            'profile_picture_public_id' => null,
            'avatar' => null,
        ]);

        $this->log('avatar', $id, 'flagged', 'Avatar flagged for admin review.');

        return response()->json(['message' => 'Avatar flagged and reset to the default placeholder.']);
    }

    public function revertPhoto(Request $request, int $id): JsonResponse
    {
        $request->validate([
            'status' => 'required|in:pending,approved,rejected',
            'note'   => 'nullable|string|max:500',
        ]);

        $photo      = Gallery::find($id) ?? Photo::findOrFail($id);
        $fromStatus = $photo->status ?? 'pending';
        $toStatus   = $request->status;

        if ($fromStatus === $toStatus) {
            return response()->json(['message' => "Status is already {$toStatus}."], 422);
        }

        $update = [
            'status'           => $toStatus,
            'rejection_reason' => $toStatus === 'rejected'
                ? ($request->note ?? 'Reverted by admin') : null,
        ];

        match ($toStatus) {
            'approved' => $update += ['approved_at' => now(), 'approved_by' => auth('sanctum')->id(), 'rejected_at' => null],
            'rejected' => $update += ['rejected_at' => now(), 'rejected_by' => auth('sanctum')->id(), 'approved_at' => null],
            'pending'  => $update += ['approved_at' => null, 'rejected_at' => null],
        };

        try {
            $photo->update($update);
        } catch (\Exception) {
            $photo->update([
                'status'           => $toStatus,
                'rejection_reason' => $update['rejection_reason'],
            ]);
        }

        $this->logRevert('photo', $id, $fromStatus, $toStatus, $request->note);

        return response()->json([
            'message'     => "Photo #{$id} reverted from {$fromStatus} to {$toStatus}.",
            'from_status' => $fromStatus,
            'to_status'   => $toStatus,
        ]);
    }

    // MODERATION Generic item approve / reject / revert
    public function approveItem(Request $request, string $type, int $id): JsonResponse
    {
        if ($type === 'video' && $request->input('source') === 'gallery') {
            return $this->approveGalleryVideo($id);
        }

        $config = $this->resolveType($type);
        $item   = $config['model']::findOrFail($id);

        $update = [$config['status_col'] => 'approved'];
        if ($config['reason_col']) {
            $update[$config['reason_col']] = null;
        }

        $extra  = $config['approve_cols'];
        $update = array_merge($update, is_callable($extra) ? $extra() : $extra);

        try {
            $item->update($update);
        } catch (\Exception) {
            $item->update([$config['status_col'] => 'approved']);
        }

        $this->log($type, $id, 'approved');

        return response()->json(['message' => ucfirst($type) . " #{$id} approved."]);
    }

    public function rejectItem(Request $request, string $type, int $id): JsonResponse
    {
        $request->validate(['reason' => 'required|string|max:255']);

        if ($type === 'video' && $request->input('source') === 'gallery') {
            return $this->rejectGalleryVideo($request, $id);
        }

        $config = $this->resolveType($type);
        $item   = $config['model']::findOrFail($id);

        $update = [$config['status_col'] => 'rejected'];
        if ($config['reason_col']) {
            $update[$config['reason_col']] = $request->reason;
        }

        $extra  = $config['reject_cols'];
        $update = array_merge($update, is_callable($extra) ? $extra($request->reason) : $extra);

        try {
            $item->update($update);
        } catch (\Exception) {
            $item->update([$config['status_col'] => 'rejected']);
        }

        $this->log($type, $id, 'rejected', $request->reason);

        return response()->json(['message' => ucfirst($type) . " #{$id} rejected."]);
    }

    public function revertItem(Request $request, string $type, int $id): JsonResponse
    {
        $request->validate([
            'status' => 'required|in:pending,approved,rejected',
            'note'   => 'nullable|string|max:500',
        ]);

        if ($type === 'video' && $request->input('source') === 'gallery') {
            return $this->revertGalleryVideo($request, $id);
        }

        $config     = $this->resolveType($type);
        $item       = $config['model']::findOrFail($id);
        $fromStatus = $item->{$config['status_col']};
        $toStatus   = $request->status;

        if ($fromStatus === $toStatus) {
            return response()->json(['message' => "Status is already {$toStatus}."], 422);
        }

        $update = [$config['status_col'] => $toStatus];

        if ($config['reason_col']) {
            $update[$config['reason_col']] = $toStatus === 'rejected'
                ? ($request->note ?? 'Reverted by admin') : null;
        }

        match ($toStatus) {
            'approved' => $update += ['approved_at' => now(), 'approved_by' => auth('sanctum')->id(), 'rejected_at' => null],
            'rejected' => $update += ['rejected_at' => now(), 'rejected_by' => auth('sanctum')->id(), 'approved_at' => null],
            'pending'  => $update += ['approved_at' => null, 'rejected_at' => null],
        };

        try {
            $item->update($update);
        } catch (\Exception) {
            $item->update([$config['status_col'] => $toStatus]);
        }

        $this->logRevert($type, $id, $fromStatus, $toStatus, $request->note);

        return response()->json([
            'message'     => "Status reverted from {$fromStatus} to {$toStatus}.",
            'from_status' => $fromStatus,
            'to_status'   => $toStatus,
        ]);
    }


    // MODERATION Bulk approve / reject
    private function approveGalleryVideo(int $id): JsonResponse
    {
        $item = Gallery::with(['album', 'media', 'user'])
            ->whereHas('media', fn ($q) => $q->where('resource_type', 'video'))
            ->findOrFail($id);
        $wasPending = $item->status === 'pending';

        $item->update([
            'status'           => 'approved',
            'rejection_reason' => null,
            'approved_at'      => now(),
            'approved_by'      => auth('sanctum')->id(),
            'rejected_at'      => null,
        ]);

        $this->log('video', $id, 'approved');
        if ($wasPending) {
            $this->notifyUploaderApproved($item->fresh(['album', 'media', 'user']));
        }

        return response()->json(['message' => "Video #{$id} approved."]);
    }

    private function rejectGalleryVideo(Request $request, int $id): JsonResponse
    {
        $item = Gallery::whereHas('media', fn ($q) => $q->where('resource_type', 'video'))->findOrFail($id);

        $item->update([
            'status'           => 'rejected',
            'rejection_reason' => $request->reason,
            'rejected_at'      => now(),
            'rejected_by'      => auth('sanctum')->id(),
            'approved_at'      => null,
        ]);

        $this->log('video', $id, 'rejected', $request->reason);

        return response()->json(['message' => "Video #{$id} rejected."]);
    }

    private function revertGalleryVideo(Request $request, int $id): JsonResponse
    {
        $item = Gallery::whereHas('media', fn ($q) => $q->where('resource_type', 'video'))->findOrFail($id);
        $fromStatus = $item->status;
        $toStatus = $request->status;

        if ($fromStatus === $toStatus) {
            return response()->json(['message' => "Status is already {$toStatus}."], 422);
        }

        $update = [
            'status'           => $toStatus,
            'rejection_reason' => $toStatus === 'rejected'
                ? ($request->note ?? 'Reverted by admin') : null,
        ];

        match ($toStatus) {
            'approved' => $update += ['approved_at' => now(), 'approved_by' => auth('sanctum')->id(), 'rejected_at' => null],
            'rejected' => $update += ['rejected_at' => now(), 'rejected_by' => auth('sanctum')->id(), 'approved_at' => null],
            'pending'  => $update += ['approved_at' => null, 'rejected_at' => null],
        };

        $item->update($update);
        $this->logRevert('video', $id, $fromStatus, $toStatus, $request->note);

        return response()->json([
            'message'     => "Status reverted from {$fromStatus} to {$toStatus}.",
            'from_status' => $fromStatus,
            'to_status'   => $toStatus,
        ]);
    }

    public function bulkApprove(Request $request): JsonResponse
    {
        $request->validate([
            'type'  => 'required|string',
            'ids'   => 'required|array|min:1',
            'ids.*' => 'integer',
        ]);

        if ($request->type === 'photo') {
            $pendingPhotos = Gallery::with(['album', 'media', 'user'])
                ->whereIn('album_id', $request->ids)
                ->where('status', 'pending')
                ->whereNotNull('user_id')
                ->whereHas('media', fn ($m) => $m->where('resource_type', 'image'))
                ->get();

            Gallery::whereIn('album_id', $request->ids)
                ->where('status', 'pending')
                ->whereNotNull('user_id')
                ->whereHas('media', fn ($m) => $m->where('resource_type', 'image'))
                ->update([
                    'status'           => 'approved',
                    'rejection_reason' => null,
                    'approved_at'      => now(),
                    'approved_by'      => auth('sanctum')->id(),
                ]);

            $pendingPhotos->each(fn (Gallery $gallery) => $this->notifyUploaderApproved($gallery));

            return response()->json(['message' => count($request->ids) . ' albums approved.']);
        }

        if ($request->type === 'video') {
            $pendingVideos = Gallery::with(['album', 'media', 'user'])
                ->whereIn('id', $request->ids)
                ->where('status', 'pending')
                ->whereHas('media', fn ($m) => $m->where('resource_type', 'video'))
                ->get();

            $updated = Gallery::whereIn('id', $request->ids)
                ->where('status', 'pending')
                ->whereHas('media', fn ($m) => $m->where('resource_type', 'video'))
                ->update([
                    'status'           => 'approved',
                    'rejection_reason' => null,
                    'approved_at'      => now(),
                    'approved_by'      => auth('sanctum')->id(),
                ]);

            if ($updated > 0) {
                $pendingVideos->each(fn (Gallery $gallery) => $this->notifyUploaderApproved($gallery));

                return response()->json(['message' => $updated . ' videos approved.']);
            }
        }

        $config = $this->resolveType($request->type);
        $extra  = $config['approve_cols'];

        $update = array_merge(
            [$config['status_col'] => 'approved'],
            is_callable($extra) ? $extra() : $extra
        );

        if ($config['reason_col']) {
            $update[$config['reason_col']] = null;
        }

        try {
            $config['model']::whereIn('id', $request->ids)->update($update);
        } catch (\Exception) {
            $config['model']::whereIn('id', $request->ids)
                ->update([$config['status_col'] => 'approved']);
        }

        return response()->json(['message' => count($request->ids) . ' items approved.']);
    }

    public function bulkReject(Request $request): JsonResponse
    {
        $request->validate([
            'type'   => 'required|string',
            'ids'    => 'required|array|min:1',
            'ids.*'  => 'integer',
            'reason' => 'required|string|max:255',
        ]);

        if ($request->type === 'photo') {
            Gallery::whereIn('album_id', $request->ids)
                ->where('status', 'pending')
                ->whereNotNull('user_id')
                ->whereHas('media', fn ($m) => $m->where('resource_type', 'image'))
                ->update([
                    'status'           => 'rejected',
                    'rejection_reason' => $request->reason,
                    'rejected_at'      => now(),
                    'rejected_by'      => auth('sanctum')->id(),
                ]);

            return response()->json(['message' => count($request->ids) . ' albums rejected.']);
        }

        if ($request->type === 'video') {
            $updated = Gallery::whereIn('id', $request->ids)
                ->where('status', 'pending')
                ->whereHas('media', fn ($m) => $m->where('resource_type', 'video'))
                ->update([
                    'status'           => 'rejected',
                    'rejection_reason' => $request->reason,
                    'rejected_at'      => now(),
                    'rejected_by'      => auth('sanctum')->id(),
                ]);

            if ($updated > 0) {
                return response()->json(['message' => $updated . ' videos rejected.']);
            }
        }

        $config = $this->resolveType($request->type);
        $extra  = $config['reject_cols'];

        $update = array_merge(
            [$config['status_col'] => 'rejected'],
            is_callable($extra) ? $extra($request->reason) : $extra
        );

        if ($config['reason_col']) {
            $update[$config['reason_col']] = $request->reason;
        }

        try {
            $config['model']::whereIn('id', $request->ids)->update($update);
        } catch (\Exception) {
            $config['model']::whereIn('id', $request->ids)
                ->update([$config['status_col'] => 'rejected']);
        }

        return response()->json(['message' => count($request->ids) . ' items rejected.']);
    }

    // MODERATION Status history
    public function statusHistory(string $type, int $id): JsonResponse
    {
        $rows = DB::table('audit_logs')
            ->where('subject_id', $id)
            ->where('subject_name', 'like', "{$type}#{$id}")
            ->orderByDesc('created_at')
            ->limit(50)
            ->get();

        $logs = $rows->map(function ($row) {
            $fromStatus = null;
            $toStatus   = null;

            if (preg_match('/(\w+)→(\w+)/', $row->details ?? '', $m)) {
                $fromStatus = $m[1];
                $toStatus   = $m[2];
            } elseif (preg_match('/Admin (\w+) \w+ #\d+/', $row->details ?? '', $m)) {
                $toStatus = in_array($m[1], ['approved', 'rejected', 'reverted'])
                    ? $m[1] : null;
            }

            $adminName = null;
            if ($row->created_by ?? null) {
                $user = DB::table('users')
                    ->where('id', $row->created_by)
                    ->first(['first_name', 'last_name']);
                $adminName = $user
                    ? "{$user->first_name} {$user->last_name}"
                    : "Admin #{$row->created_by}";
            }

            return [
                'id'               => $row->id,
                'action'           => $row->action    ?? 'action',
                'from_status'      => $fromStatus,
                'to_status'        => $toStatus,
                'note'             => $row->note       ?? null,
                'reason'           => $row->reason     ?? null,
                'admin_name'       => $adminName,
                'created_at'       => $row->created_at,
                'created_at_human' => $row->created_at
                    ? Carbon::parse($row->created_at)->diffForHumans() : null,
            ];
        });

        return response()->json($logs);
    }

    // MEDIA LIBRARY Stats
    public function mediaStats(): JsonResponse
    {
        return response()->json([
            'albums'        => Album::whereNotNull('user_id')
                                ->where('type', 'general')
                                ->count(),

            'photos'        => Gallery::whereNotNull('user_id')
                                ->whereHas('media', fn ($q) => $q->where('resource_type', 'image'))
                                ->count(),

            'videos'        => PostMedia::where('resource_type', 'video')
                                ->whereNotNull('photo_id')
                                ->count()
                                + Gallery::whereNotNull('user_id')
                                    ->whereHas('album', fn ($q) => $q->where('type', 'general'))
                                    ->whereHas('media', fn ($q) => $q->where('resource_type', 'video'))
                                    ->count(),

            'voice_notes'   => VoiceNote::count(),

            'tagged_photos' => TaggedPhoto::count(),
        ]);
    }

    // MEDIA LIBRARY Albums
    public function mediaAlbums(Request $request): JsonResponse
    {
        $query = Album::query()
            ->with([
                'user:id,first_name,last_name',
                'galleries' => fn ($q) => $q
                    ->whereHas('media', fn ($mq) => $mq->where('resource_type', 'image'))
                    ->with(['media' => fn ($mq) => $mq
                        ->where('resource_type', 'image')
                        ->orderBy('sort_order')])
                    ->orderBy('sort_order'),
            ])
            ->withCount(['galleries as photos_count' => fn ($q) => $q
                ->whereHas('media', fn ($mq) => $mq->where('resource_type', 'image'))])
            ->whereNotNull('user_id')
            ->where('type', 'general')
            ->orderByDesc('created_at');

        if ($request->filled('category')) {
            $query->where('category', $request->category);
        }

        $items = $query->paginate($request->get('per_page', 18));

        $items->getCollection()->transform(function ($album) {
            $firstImage = $album->galleries
                ->flatMap(fn ($gallery) => $gallery->media)
                ->first();

            $coverUrl = $album->cover_image
                ? $this->resolveUrl($album->cover_image)
                : $this->resolveUrl($firstImage?->file_path);

            return [
                'id'               => $album->id,
                'title'            => $album->title,
                'description'      => $album->description,
                'type'             => $album->type,
                'category'         => $album->category,
                'event_date'       => $album->event_date?->format('Y-m-d'),
                'cover_photo_url'  => $coverUrl,
                'cover_resource_type' => $coverUrl ? 'image' : null,
                'photo_count'      => $album->photos_count,
                'owner'            => $album->user
                    ? "{$album->user->first_name} {$album->user->last_name}" : 'Unknown',
                'created_at_human' => Carbon::parse($album->created_at)->diffForHumans(),
            ];
        });

        return response()->json($items);
    }

    public function albumPhotos(Request $request, int $id): JsonResponse
    {
        $album = Album::whereNotNull('user_id')
            ->where('type', 'general')
            ->findOrFail($id);

        $query = Gallery::where('album_id', $album->id)
            ->whereNotNull('user_id')
            ->whereHas('media', fn ($q) => $q->where('resource_type', 'image'))
            ->with(['user:id,first_name,last_name', 'media' => fn ($q) => $q->where('resource_type', 'image')->orderBy('sort_order')])
            ->orderBy('created_at', 'desc');

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('visibility')) {
            $query->where('visibility', $request->visibility);
        }

        $photos = $query->paginate($request->get('per_page', 48));

        $photos->getCollection()->transform(fn (Gallery $p) => [
            'id'               => $p->media->first()?->id ?? $p->id,
            'gallery_id'       => $p->id,
            'url'              => $this->mediaItemUrl($p),
            'file_path'        => $this->mediaItemUrl($p),
            'caption'          => $p->caption,
            'visibility'       => $p->visibility ?? 'public',
            'status'           => $p->status ?? 'pending',
            'rejection_reason' => $p->rejection_reason,
            'ai_metadata'      => $p->ai_metadata,
            'is_profile_post'  => $p->is_profile_post ?? false,
            'uploader'         => $p->user
                ? "{$p->user->first_name} {$p->user->last_name}" : 'Unknown',
            'created_at'       => $p->created_at,
            'created_at_human' => $p->created_at
                ? Carbon::parse($p->created_at)->diffForHumans() : null,
        ]);

        return response()->json($photos);
    }

    public function storeAlbum(Request $request): JsonResponse
    {
        $data = $request->validate([
            'title'       => 'required|string|max:255',
            'description' => 'nullable|string',
            'type'        => 'nullable|in:general,graduation,profile',
            'category'    => 'nullable|in:photos,videos,program,archive',
            'event_date'  => 'nullable|date',
            'user_id'     => 'nullable|exists:users,id',
        ]);

        $album = Album::create($data);

        return response()->json($album, 201);
    }

    public function updateAlbum(Request $request, int $id): JsonResponse
    {
        $album = Album::findOrFail($id);

        $data = $request->validate([
            'title'       => 'sometimes|required|string|max:255',
            'description' => 'nullable|string',
            'type'        => 'nullable|in:general,graduation,profile',
            'category'    => 'nullable|in:photos,videos,program,archive',
            'event_date'  => 'nullable|date',
        ]);

        $album->update($data);

        return response()->json(['message' => 'Album updated.']);
    }

    /**
     * Soft-delete an album.
     */
    public function destroyAlbum(int $id): JsonResponse
    {
        $album = Album::findOrFail($id);
        $album->delete(); // soft delete

        return response()->json(['message' => 'Album moved to trash.']);
    }

    // MEDIA LIBRARY Photos
    public function mediaPhotos(Request $request): JsonResponse
    {
        $query = GalleryMedia::query()
            ->where('resource_type', 'image')
            ->whereHas('gallery', fn ($q) => $q->whereNotNull('user_id'))
            ->with([
                'gallery' => fn ($q) => $q
                    ->select(['id', 'album_id', 'user_id', 'caption', 'visibility', 'status', 'ai_metadata', 'created_at'])
                    ->with('user:id,first_name,last_name'),
            ])
            ->orderByDesc('created_at');

        if ($request->filled('album_id')) {
            $query->whereHas('gallery', fn ($q) => $q->where('album_id', $request->album_id));
        }

        if ($request->filled('visibility')) {
            $query->whereHas('gallery', fn ($q) => $q->where('visibility', $request->visibility));
        }

        $items = $query->paginate($request->get('per_page', 24));

        $items->getCollection()->transform(fn (GalleryMedia $photo) => [
            'id'               => $photo->id,
            'gallery_id'       => $photo->gallery_id,
            'file_path'        => $this->resolveUrl($photo->file_path),
            'caption'          => $photo->gallery?->caption,
            'visibility'       => $photo->gallery?->visibility ?? 'public',
            'status'           => $photo->gallery?->status ?? 'pending',
            'is_profile_post'  => false,
            'ai_metadata'      => $photo->gallery?->ai_metadata,
            'uploader'         => $photo->gallery?->user
                ? "{$photo->gallery->user->first_name} {$photo->gallery->user->last_name}" : 'Unknown',
            'created_at_human' => Carbon::parse($photo->created_at)->diffForHumans(),
        ]);

        return response()->json($items);
    }

    public function destroyPhoto(int $id): JsonResponse
    {
        if ($media = GalleryMedia::with('gallery')->find($id)) {
            $gallery = $media->gallery;
            $media->delete();

            if ($gallery && $gallery->media()->count() === 0) {
                $gallery->delete();
            }

            return response()->json(['message' => 'Photo moved to trash.']);
        }

        if ($gallery = Gallery::find($id)) {
            $gallery->delete();

            return response()->json(['message' => 'Photo moved to trash.']);
        }

        Photo::findOrFail($id)->delete(); // soft delete

        return response()->json(['message' => 'Photo moved to trash.']);
    }

    // MEDIA LIBRARY Videos

    public function updatePhotoVisibility(Request $request, int $id): JsonResponse
    {
        $data = $request->validate([
            'visibility' => ['required', 'in:public,batchmates,friends,private'],
        ]);

        $visibility = $this->normalizeGalleryVisibility($data['visibility']);

        if ($media = GalleryMedia::with('gallery')->find($id)) {
            $gallery = $media->gallery;

            if (! $gallery) {
                return response()->json(['message' => 'Gallery record not found.'], 404);
            }

            $gallery->update(['visibility' => $visibility]);

            return response()->json([
                'message' => 'Photo visibility updated.',
                'data' => [
                    'id' => $media->id,
                    'gallery_id' => $gallery->id,
                    'visibility' => $gallery->visibility,
                ],
            ]);
        }

        if ($gallery = Gallery::find($id)) {
            $gallery->update(['visibility' => $visibility]);

            return response()->json([
                'message' => 'Photo visibility updated.',
                'data' => [
                    'id' => $gallery->id,
                    'gallery_id' => $gallery->id,
                    'visibility' => $gallery->visibility,
                ],
            ]);
        }

        $photo = Photo::findOrFail($id);
        $photo->update(['visibility' => $visibility]);

        return response()->json([
            'message' => 'Photo visibility updated.',
            'data' => [
                'id' => $photo->id,
                'visibility' => $photo->visibility,
            ],
        ]);
    }

    private function normalizeGalleryVisibility(?string $visibility): string
    {
        return $visibility === 'batchmates' ? 'friends' : ($visibility ?: 'public');
    }

    public function mediaVideos(Request $request): JsonResponse
    {
        $source = $request->get('source', 'all');

        $galleryItems = collect();
        if ($source === 'all' || $source === 'graduation') {
            $galleryItems = Gallery::query()
                ->with([
                    'user:id,first_name,last_name',
                    'album:id,title,type',
                    'media' => fn ($q) => $q->where('resource_type', 'video')->orderBy('sort_order'),
                ])
                ->whereNotNull('user_id')
                ->whereHas('album', fn ($q) => $q->where('type', 'general'))
                ->whereHas('media', fn ($q) => $q->where('resource_type', 'video'))
                ->get()
                ->map(function (Gallery $item) {
                    $media = $item->media->first();
                    $uploader = $item->user
                        ? "{$item->user->first_name} {$item->user->last_name}"
                        : 'Unknown';

                    return [
                        'id'               => $item->id,
                        'source'           => 'graduation',
                        'file_path'        => $this->resolveUrl($media?->file_path),
                        'filename'         => $item->caption ?: ($item->album?->title ?? "video_{$item->id}"),
                        'resource_type'    => 'video',
                        'status'           => $item->status,
                        'is_reported'      => false,
                        'rejection_reason' => $item->rejection_reason,
                        'bytes'            => $media?->bytes,
                        'width'            => $media?->width,
                        'height'           => $media?->height,
                        'uploader'         => $uploader,
                        'created_at_human' => $item->created_at ? Carbon::parse($item->created_at)->diffForHumans() : null,
                        'created_at'       => $item->created_at,
                    ];
                });
        }

        $postItems = collect();
        if ($source === 'all' || $source === 'post') {
            $postItems = PostMedia::where('resource_type', 'video')
                ->whereNotNull('photo_id')
                ->with('photo.user:id,first_name,last_name')
                ->get()
                ->map(fn ($media) => [
                    'id'               => $media->id,
                    'source'           => 'post',
                    'file_path'        => $this->resolveUrl($media->file_path),
                    'filename'         => $media->file_path
                        ? basename($media->file_path) : "video_{$media->id}",
                    'resource_type'    => 'video',
                    'status'           => $media->status,
                    'is_reported'      => $media->is_reported,
                    'rejection_reason' => $media->rejection_reason,
                    'bytes'            => $media->bytes,
                    'width'            => $media->width,
                    'height'           => $media->height,
                    'uploader'         => optional(optional($media->photo)->user)->first_name
                        ? "{$media->photo->user->first_name} {$media->photo->user->last_name}"
                        : 'Unknown',
                    'created_at_human' => $media->created_at ? Carbon::parse($media->created_at)->diffForHumans() : null,
                    'created_at'       => $media->created_at,
                ]);
        }

        $merged = $galleryItems
            ->concat($postItems)
            ->sortByDesc(fn ($item) => optional($item['created_at'])->timestamp ?? 0)
            ->values();

        $perPage = (int) $request->get('per_page', 18);
        $page = LengthAwarePaginator::resolveCurrentPage();
        $items = new LengthAwarePaginator(
            $merged->forPage($page, $perPage)->values(),
            $merged->count(),
            $perPage,
            $page,
            ['path' => $request->url(), 'query' => $request->query()]
        );

        return response()->json($items);
    }

    /**
     * Soft-delete a video (PostMedia record).
     */
    public function destroyVideo(Request $request, int $id): JsonResponse
    {
        if ($request->get('source') === 'graduation') {
            $gallery = Gallery::whereHas('media', fn ($q) => $q->where('resource_type', 'video'))->findOrFail($id);
            $gallery->delete();

            return response()->json(['message' => 'Video moved to trash.']);
        }

        PostMedia::findOrFail($id)->delete(); // soft delete

        return response()->json(['message' => 'Video moved to trash.']);
    }

    // MEDIA LIBRARY Voice Notes

    public function mediaVoiceNotes(Request $request): JsonResponse
    {
        $query = VoiceNote::query()
            ->with([
                'sender:id,first_name,last_name',
                'recipient:id,first_name,last_name',
            ])
            ->orderByDesc('created_at');

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        $items = $query->paginate($request->get('per_page', 18));

        $items->getCollection()->transform(fn ($vn) => [
            'id'               => $vn->id,
            'title'            => $vn->title,
            'audio_url'        => $vn->audio_url,
            'duration_seconds' => $vn->duration_seconds,
            'status'           => $vn->status,
            'reject_reason'    => $vn->reject_reason,
            'sender'           => $vn->sender
                ? "{$vn->sender->first_name} {$vn->sender->last_name}" : 'Unknown',
            'recipient'        => $vn->recipient
                ? "{$vn->recipient->first_name} {$vn->recipient->last_name}" : 'Unknown',
            'created_at_human' => Carbon::parse($vn->created_at)->diffForHumans(),
        ]);

        return response()->json($items);
    }

    /**
     * Soft-delete a voice note.
     */
    public function destroyVoiceNote(int $id): JsonResponse
    {
        VoiceNote::findOrFail($id)->delete(); // soft delete

        return response()->json(['message' => 'Voice note moved to trash.']);
    }

    // MEDIA LIBRARY Tagged Photos

    public function mediaTaggedPhotos(Request $request): JsonResponse
    {
        $query = TaggedPhoto::query()
            ->with([
                'user:id,first_name,last_name',
                'uploader:id,first_name,last_name',
            ])
            ->orderByDesc('created_at');

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        $items = $query->paginate($request->get('per_page', 24));

        $items->getCollection()->transform(fn ($tp) => [
            'id'               => $tp->id,
            'photo_url'        => $tp->photo_url ?? $this->resolveUrl($tp->photo_path ?? null),
            'caption'          => $tp->caption,
            'similarity'       => $tp->similarity,
            'confidence'       => $tp->confidence,
            'source'           => $tp->source,
            'status'           => $tp->status,
            'tagged_user'      => $tp->user
                ? "{$tp->user->first_name} {$tp->user->last_name}" : 'Unknown',
            'uploaded_by'      => $tp->uploader
                ? "{$tp->uploader->first_name} {$tp->uploader->last_name}" : 'Unknown',
            'created_at_human' => Carbon::parse($tp->created_at)->diffForHumans(),
        ]);

        return response()->json($items);
    }

    /**
     * Soft-delete a tagged photo record.
     * No Cloudinary asset to purge (photo_path is not a public_id).
     */
    public function destroyTaggedPhoto(int $id): JsonResponse
    {
        TaggedPhoto::findOrFail($id)->delete(); // soft delete

        return response()->json(['message' => 'Tagged photo moved to trash.']);
    }

    // PRIVATE HELPERS

    private function resolveUrl(?string $path): ?string
    {
        if (! $path) return null;

        return str_starts_with($path, 'http')
            ? $path
            : asset('storage/' . $path);
    }

    private function mediaItemUrl($item): ?string
    {
        $path = $item->file_path ?? $item->cover ?? null;

        if (! $path && method_exists($item, 'relationLoaded') && $item->relationLoaded('media')) {
            $path = $item->media->first()?->file_path;
        }

        return $this->resolveUrl($path);
    }

    private function mediaItemType($item): string
    {
        if (($item->ai_metadata['resource_type'] ?? null) === 'video') {
            return 'video';
        }

        if (method_exists($item, 'relationLoaded') && $item->relationLoaded('media')) {
            return $item->media->first()?->resource_type ?? 'image';
        }

        return 'image';
    }

    private function resolveType(string $type): array
    {
        $adminId = auth('sanctum')->id();

        return match ($type) {
            'photo' => [
                'model'        => Photo::class,
                'status_col'   => 'status',
                'reason_col'   => 'rejection_reason',
                'url_col'      => 'file_path',
                'name_col'     => 'caption',
                'user_fk'      => 'user_id',
                'approve_cols' => ['approved_at' => now(), 'approved_by' => $adminId],
                'reject_cols'  => fn ($r) => ['rejected_at' => now(), 'rejected_by' => $adminId],
            ],
            'video' => [
                'model'        => PostMedia::class,
                'status_col'   => 'status',
                'reason_col'   => 'rejection_reason',
                'url_col'      => 'file_path',
                'name_col'     => 'resource_type',
                'user_fk'      => null,
                'approve_cols' => ['approved_at' => now(), 'approved_by' => $adminId],
                'reject_cols'  => fn ($r) => ['rejected_at' => now(), 'rejected_by' => $adminId],
            ],
            'voice' => [
                'model'        => VoiceNote::class,
                'status_col'   => 'status',
                'reason_col'   => 'reject_reason',
                'url_col'      => 'audio_url',
                'name_col'     => 'title',
                'user_fk'      => 'sender_id',
                'approve_cols' => ['reviewed_at' => now(), 'reviewed_by' => $adminId],
                'reject_cols'  => fn ($r) => ['reviewed_at' => now(), 'reviewed_by' => $adminId],
            ],
            'tagged' => [
                'model'        => TaggedPhoto::class,
                'status_col'   => 'status',
                'reason_col'   => null,
                'url_col'      => 'photo_path',
                'name_col'     => 'caption',
                'user_fk'      => 'uploaded_by',
                'approve_cols' => ['approved_at' => now(), 'approved_by' => $adminId],
                'reject_cols'  => fn ($r) => ['rejected_at' => now(), 'rejected_by' => $adminId],
            ],
            'reported' => [
                'model'        => PostMedia::class,
                'status_col'   => 'status',
                'reason_col'   => 'rejection_reason',
                'url_col'      => 'file_path',
                'name_col'     => 'resource_type',
                'user_fk'      => null,
                'approve_cols' => ['approved_at' => now(), 'approved_by' => $adminId],
                'reject_cols'  => fn ($r) => ['rejected_at' => now(), 'rejected_by' => $adminId],
            ],
            default => abort(422, "Unknown content type: {$type}"),
        };
    }

    private function notifyUploaderApproved(?Gallery $gallery): void
    {
        if (! $gallery?->user) {
            return;
        }

        try {
            $gallery->loadMissing(['album', 'media', 'user']);
            $gallery->user->notify(new MediaApprovedNotification($gallery));
        } catch (\Throwable $e) {
            Log::warning('Media approval notification failed.', [
                'gallery_id' => $gallery->id,
                'user_id' => $gallery->user_id,
                'error' => $e->getMessage(),
            ]);
        }
    }

    private function log(string $type, int $id, string $action, ?string $reason = null): void
    {
        try {
            AuditLog::moderation(
                $type,
                $id,
                $action,
                auth('sanctum')->user(),
                $reason
            );
        } catch (\Exception $e) {
            Log::warning("AuditLog::moderation failed: {$e->getMessage()}");
        }
    }

    private function logRevert(
        string  $type,
        int     $id,
        string  $from,
        string  $to,
        ?string $note = null
    ): void {
        try {
            AuditLog::revert(
                $type,
                $id,
                $from,
                $to,
                auth('sanctum')->user(),
                $note
            );
        } catch (\Exception $e) {
            Log::warning("AuditLog::revert failed: {$e->getMessage()}");
        }
    }
}
